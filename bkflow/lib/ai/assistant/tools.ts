import { BoardMemberRole } from "@/types";
import "server-only";

import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { tool } from "ai";
import { z } from "zod";

const isAssignableBoardMemberRole = (_role?: unknown) => true;
import {
  triggerCardCreated,
  triggerCardDeleted,
  triggerCardMoved,
  triggerChecklistCreated,
  triggerChecklistItemCreated,
} from "@/lib/boards/realtime";
import { validateCardDateRange } from "@/lib/cards/card-date-rules";
import { updateCardService } from "@/lib/cards/card-update-service";
import {
  triggerCardUpdated,
  triggerRelatedDependencyCardsUpdated,
} from "@/lib/cards/realtime";
import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { BOARD_EDITOR_REQUIRED_ERROR, requireBoardEditor } from "@/lib/permissions";
import type { CardUpdatedField } from "@/lib/realtime/types";

import {
  type AssistantCard,
  type AssistantSession,
  loadBoardSnapshot,
  serializeCard,
} from "./board-data";
import { ASSISTANT_LIMITS } from "./config";
import { createChecklistItemTool } from "./checklist-tool";
import { createWorkspaceTools } from "./workspace-tools";
import {
  formatZonedDateTime,
  getWeekdayIndex,
  getWeekdayName,
  getZonedDayStart,
  getZonedTimeOnDay,
  getZonedWeekStart,
  parseIsoDateTime,
} from "./time";

/**
 * Danh sách các khoảng thời gian lọc hạn chót được Trợ lý AI hỗ trợ tra cứu.
 */
const DEADLINE_RANGES = [
  "overdue",
  "today",
  "tomorrow",
  "this_week",
  "next_7_days",
  "upcoming",
  "no_due_date",
  "all",
] as const;

/**
 * Kiểu dữ liệu đại diện cho khoảng thời gian lọc hạn chót.
 */
type DeadlineRange = (typeof DEADLINE_RANGES)[number];

/**
 * Zod schema xác thực chuỗi ngày giờ định dạng ISO 8601 KÈM offset múi giờ của người dùng.
 * Ví dụ hợp lệ: `2026-10-11T23:59:00+07:00`.
 */
const isoDateTime = z
  .string()
  .describe("Thời điểm ISO 8601 KÈM múi giờ của người dùng, ví dụ 2026-10-11T23:59:00+07:00");

/**
 * Cấu trúc dữ liệu thẻ hành động (Action Card) trả về từ các công cụ mutation,
 * phục vụ việc render widget trực quan (Action Card preview) trong tin nhắn của Trợ lý AI.
 */
export type AssistantActionCard = {
  /** ID định danh duy nhất của thẻ */
  id: string;
  /** Tiêu đề công việc */
  title: string;
  /** ID bảng làm việc */
  boardId: string;
  /** Tên danh sách/cột đang chứa thẻ */
  list: string;
  /** Hạn chót dạng chuỗi định dạng địa phương hoặc null */
  dueDate: string | null;
  /** Ngày bắt đầu dạng chuỗi định dạng địa phương hoặc null */
  startDate: string | null;
  /** Cờ trạng thái đã hoàn thành hay chưa */
  isCompleted: boolean;
  /** Danh sách tên các thành viên được giao việc */
  assignees: string[];
};

/**
 * Kết quả trả về có cấu trúc từ các công cụ làm thay đổi dữ liệu (mutations) của Agent.
 * Dùng để đồng bộ trạng thái UI và thông báo cho người dùng.
 */
export type AssistantMutationOutput =
  | { ok: true; action: "checklist_item_updated"; card: { id: string; title: string }; item: { id: string; title: string; isCompleted: boolean; dueDate: string | null } }
  | { ok: true; action: "created" | "updated"; card: AssistantActionCard; changes?: string[] }
  | { ok: true; action: "batch_created"; cards: AssistantActionCard[]; summary: string }
  | { ok: true; action: "moved"; card: AssistantActionCard; fromList: string; toList: string }
  | { ok: true; action: "archived"; cardTitle: string }
  | { ok: true; action: "checklist_created"; card: AssistantActionCard; checklistTitle: string; items: string[] }
  | {
      ok: true;
      action: "dependency_created";
      blockerCard: { id: string; title: string };
      blockedCard: { id: string; title: string };
      message: string;
    }
  | {
      ok: true;
      action: "dependency_deleted";
      blockerCard: { id: string; title: string };
      blockedCard: { id: string; title: string };
      message: string;
    }
  | { ok: false; error: string };

/**
 * Lọc danh sách thẻ theo khoảng thời gian hạn chót và múi giờ địa phương của người dùng.
 *
 * @param cards - Danh sách thẻ cần lọc.
 * @param range - Khoảng thời gian yêu cầu lọc (thuộc {@link DeadlineRange}).
 * @param now - Thời điểm hiện tại làm mốc tính toán.
 * @param timeZone - Múi giờ IANA của client.
 * @returns Danh sách các thẻ thỏa mãn điều kiện lọc thời gian.
 */
const filterByRange = (
  cards: AssistantCard[],
  range: DeadlineRange,
  now: Date,
  timeZone: string,
): AssistantCard[] => {
  const todayStart = getZonedDayStart(now, timeZone);
  const tomorrowStart = getZonedDayStart(now, timeZone, 1);
  const dayAfterTomorrow = getZonedDayStart(now, timeZone, 2);
  const nextWeekStart = new Date(getZonedWeekStart(now, timeZone).getTime() + 7 * 86_400_000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 86_400_000);

  const inRange = (date: Date | null, from: Date, to: Date) =>
    Boolean(date && date >= from && date < to);

  switch (range) {
    case "overdue":
      return cards.filter((card) => card.dueDate && !card.isCompleted && card.dueDate < now);
    case "today":
      return cards.filter((card) => inRange(card.dueDate, todayStart, tomorrowStart));
    case "tomorrow":
      return cards.filter((card) => inRange(card.dueDate, tomorrowStart, dayAfterTomorrow));
    case "this_week":
      return cards.filter((card) => inRange(card.dueDate, todayStart, nextWeekStart));
    case "next_7_days":
      return cards.filter((card) => inRange(card.dueDate, now, sevenDaysLater));
    case "upcoming":
      return cards.filter((card) => card.dueDate && card.dueDate >= now);
    case "no_due_date":
      return cards.filter((card) => !card.dueDate);
    case "all":
    default:
      return cards;
  }
};

/**
 * Sắp xếp danh sách thẻ theo thứ tự hạn chót tăng dần (thẻ có hạn sớm nhất xếp trước;
 * thẻ không có hạn chót được đưa xuống cuối cùng).
 *
 * @param cards - Mảng thẻ cần sắp xếp.
 * @returns Bản sao mảng thẻ đã được sắp xếp ổn định theo hạn chót.
 */
const sortByDueDate = (cards: AssistantCard[]): AssistantCard[] =>
  [...cards].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

/**
 * Chuyển đổi dữ liệu thẻ từ Prisma thành đối tượng `AssistantActionCard` an toàn
 * với các trường ngày giờ đã được chuyển sang múi giờ người dùng.
 *
 * @param card - Thực thể thẻ rút gọn từ cơ sở dữ liệu.
 * @param extra - Thông tin bổ sung gồm boardId, tên cột và danh sách tên thành viên được giao việc.
 * @param timeZone - Múi giờ IANA của client.
 * @returns Đối tượng {@link AssistantActionCard}.
 */
const toActionCard = (
  card: {
    id: string;
    title: string;
    dueDate: Date | null;
    startDate: Date | null;
    isCompleted: boolean;
  },
  extra: { boardId: string; list: string; assignees: string[] },
  timeZone: string,
): AssistantActionCard => ({
  id: card.id,
  title: card.title,
  boardId: extra.boardId,
  list: extra.list,
  dueDate: formatZonedDateTime(card.dueDate, timeZone),
  startDate: formatZonedDateTime(card.startDate, timeZone),
  isCompleted: card.isCompleted,
  assignees: extra.assignees,
});

/**
 * Chuẩn hóa chuỗi văn bản phục vụ cho việc tìm kiếm mềm (bỏ dấu tiếng Việt, chữ thường, bỏ ký tự đặc biệt).
 *
 * @param value - Chuỗi ký tự cần chuẩn hóa.
 * @returns Chuỗi ký tự ASCII không dấu, viết thường, đã loại bỏ khoảng trắng thừa.
 */
const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

/**
 * Khởi tạo tập hợp toàn bộ các công cụ (Tool Definitions) cung cấp cho Trợ lý AI Agent
 * dựa trên phiên làm việc của người dùng hiện tại.
 *
 * @remarks
 * Tập công cụ bao gồm:
 * 1. **Tra cứu & Phân tích**: `getDeadlines`, `getBoardProgress`, `findCards`, `getCardDetails`.
 * 2. **Tạo dữ liệu**: `createDeadlineCard`, `createRecurringSchedule`, `batchCreateCards`, `createCardChecklist`.
 * 3. **Cập nhật & Quản lý**: `updateCardDeadline`, `moveCard`, `updateCardDetails`, `archiveCard`.
 *
 * Mọi thao tác làm thay đổi dữ liệu đều được bảo vệ bởi hàm kiểm tra phân quyền nội bộ (`ensureEditor`),
 * tự động ghi Audit Log và bắn sự kiện Realtime (Pusher / Supabase Realtime) đồng bộ giao diện cho các thành viên khác.
 *
 * @param session - Ngữ cảnh phiên làm việc chứa boardId, orgId, userId, boardMemberId, vai trò và múi giờ.
 * @returns Đối tượng chứa các tool tuân thủ giao thức Vercel AI SDK Core.
 */
export const createAssistantTools = (session: AssistantSession) => {
  const { boardId, userId, timeZone } = session;
  const canEdit = session.role !== BoardMemberRole.VIEWER;

  /**
   * Kiểm tra quyền biên tập của người dùng trên bảng làm việc.
   * Chặn hoàn toàn các thành viên có vai trò VIEWER hoặc không có quyền ghi.
   *
   * @returns Thông báo lỗi nếu bị từ chối quyền; `null` nếu có quyền hợp lệ.
   */
  const ensureEditor = async (): Promise<string | null> => {
    if (!canEdit) {
      return BOARD_EDITOR_REQUIRED_ERROR;
    }

    const permission = await requireBoardEditor({ boardId, userId });

    return permission.error;
  };

  return {
    ...createWorkspaceTools(session),
    updateChecklistItem: createChecklistItemTool(session),
    /**
     * Công cụ: getDeadlines
     * Mục đích: Tra cứu danh sách thẻ/deadline theo các khoảng thời gian tương đối
     * (quá hạn, hôm nay, ngày mai, tuần này, 7 ngày tới...) và theo phạm vi phụ trách ("mine" hoặc "all").
     *
     * Ràng buộc dữ liệu (Input constraints):
     * - `range`: Phải thuộc danh mục `DEADLINE_RANGES`.
     * - `scope`: "mine" (chỉ việc của người đang chat) hoặc "all" (mọi thẻ trên bảng).
     * - `includeCompleted`: boolean, mặc định false.
     * - `courseId`: string optional (lọc theo môn học cụ thể).
     *
     * Kết quả trả về:
     * - Danh sách thẻ serialize kèm tổng số lượng (`total`), số lượng trả về tối đa 25 (`returned`).
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Trả về `{ ok: false, error: "Bảng không tồn tại." }` nếu snapshot không tìm thấy bảng.
     */
    getDeadlines: tool({
      description:
        "Tra cứu danh sách thẻ theo hạn chót trên bảng hiện tại: quá hạn, hôm nay, ngày mai, tuần này, 7 ngày tới, sắp tới, chưa có hạn. Dùng khi người dùng hỏi hôm nay/tuần này cần làm gì, việc nào gấp, việc nào trễ hạn.",
      inputSchema: z.object({
        range: z.enum(DEADLINE_RANGES).describe("Khoảng thời gian cần lọc theo hạn chót"),
        scope: z
          .enum(["mine", "all"])
          .default("all")
          .describe("'mine' = chỉ thẻ được giao cho người đang chat; 'all' = mọi thẻ trên bảng"),
        includeCompleted: z.boolean().default(false).describe("Có tính cả thẻ đã hoàn thành không"),
        courseId: z.string().optional().describe("Lọc theo ID môn học nếu có"),
      }),
      execute: async ({ range, scope, includeCompleted, courseId }) => {
        const snapshot = await loadBoardSnapshot(boardId);

        if (!snapshot) {
          return { ok: false, error: "Bảng không tồn tại." };
        }

        const now = new Date();
        let list = snapshot.cards;

        if (!includeCompleted) {
          list = list.filter((card) => !card.isCompleted);
        }

        if (scope === "mine") {
          list = list.filter((card) => card.assignees.some((a) => a.userId === userId));
        }

        if (courseId) {
          list = list.filter((card) => card.course && card.course.includes(courseId));
        }

        const filtered = sortByDueDate(filterByRange(list, range, now, timeZone));
        const total = filtered.length;
        const serialized = filtered
          .slice(0, ASSISTANT_LIMITS.toolResultCards)
          .map((card) => serializeCard(card, timeZone, now));

        return {
          ok: true,
          range,
          scope,
          total,
          returned: serialized.length,
          cards: serialized,
        };
      },
    }),

    /**
     * Công cụ: getBoardProgress
     * Mục đích: Thống kê định lượng tổng quan tiến độ của bảng (tổng số việc, việc đã xong,
     * việc quá hạn, việc đến hạn trong 7 ngày tới, tỷ lệ hoàn thành %, tiến độ phân bổ theo cột và môn học).
     *
     * Ràng buộc dữ liệu:
     * - Không yêu cầu tham số đầu vào (empty object).
     *
     * Kết quả trả về:
     * - Các chỉ số KPI tổng thể (`totalCards`, `completedCards`, `overdueCards`, `dueSoonCards`, `completionRate`),
     *   mảng thống kê theo từng danh sách (`lists`) và từng môn học (`courses`).
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Trả về `{ ok: false, error: "Bảng không tồn tại." }` nếu snapshot bảng không tìm thấy.
     */
    getBoardProgress: tool({
      description:
        "Thống kê tổng quan tiến độ của bảng: tổng số thẻ, đã hoàn thành, quá hạn, đến hạn trong 7 ngày tới, phân bổ theo cột và môn học.",
      inputSchema: z.object({}),
      execute: async () => {
        const snapshot = await loadBoardSnapshot(boardId);

        if (!snapshot) {
          return { ok: false, error: "Bảng không tồn tại." };
        }

        const now = new Date();
        const cards = snapshot.cards;
        const totalCards = cards.length;
        const completedCards = cards.filter((c) => c.isCompleted).length;
        const overdueCards = cards.filter((c) => c.dueDate && !c.isCompleted && c.dueDate < now).length;
        const next7DaysStart = now;
        const next7DaysEnd = new Date(now.getTime() + 7 * 86_400_000);
        const dueSoonCards = cards.filter(
          (c) => c.dueDate && !c.isCompleted && c.dueDate >= next7DaysStart && c.dueDate <= next7DaysEnd,
        ).length;

        const byList = snapshot.lists.map((list) => {
          const listCards = cards.filter((c) => c.listId === list.id);

          return {
            title: list.title,
            total: listCards.length,
            completed: listCards.filter((c) => c.isCompleted).length,
          };
        });

        const byCourse: Record<string, { total: number; completed: number }> = {};

        cards.forEach((c) => {
          const key = c.course ?? "Khác";

          if (!byCourse[key]) {
            byCourse[key] = { total: 0, completed: 0 };
          }

          byCourse[key].total += 1;

          if (c.isCompleted) {
            byCourse[key].completed += 1;
          }
        });

        return {
          ok: true,
          boardTitle: snapshot.board.title,
          totalCards,
          completedCards,
          overdueCards,
          dueSoonCards,
          completionRate: totalCards > 0 ? `${Math.round((completedCards / totalCards) * 100)}%` : "0%",
          lists: byList,
          courses: Object.entries(byCourse).map(([course, stats]) => ({ course, ...stats })),
        };
      },
    }),

    /**
     * Công cụ: findCards
     * Mục đích: Tìm kiếm thẻ trên bảng theo từ khóa mềm không dấu trong tiêu đề, tên môn học,
     * tên thành viên phụ trách hoặc nhãn dán. Dùng trước khi gọi các tool sửa/xóa nếu chưa có `cardId`.
     *
     * Ràng buộc dữ liệu:
     * - `query`: Chuỗi từ khóa tìm kiếm tiếng Việt có/không dấu, độ dài tối thiểu 1 ký tự.
     *
     * Kết quả trả về:
     * - `total`: Tổng số thẻ khớp từ khóa.
     * - `cards`: Danh sách tối đa 25 thẻ serialize khớp kết quả.
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Trả về `{ ok: false, error: "Bảng không tồn tại." }` nếu snapshot bảng không tìm thấy.
     */
    findCards: tool({
      description:
        "Tìm kiếm thẻ trên bảng theo từ khóa trong tiêu đề, tên môn học hoặc tên người phụ trách. Dùng trước khi muốn cập nhật thẻ mà chưa chắc chắn ID.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Từ khóa tìm kiếm (tiếng Việt có/không dấu)"),
      }),
      execute: async ({ query }) => {
        const snapshot = await loadBoardSnapshot(boardId);

        if (!snapshot) {
          return { ok: false, error: "Bảng không tồn tại." };
        }

        const needle = normalize(query);
        const matches = snapshot.cards.filter((card) => {
          if (normalize(card.title).includes(needle)) return true;
          if (card.course && normalize(card.course).includes(needle)) return true;
          if (card.assignees.some((a) => normalize(a.name).includes(needle))) return true;
          if (card.labels.some((l) => normalize(l).includes(needle))) return true;
          return false;
        });

        const now = new Date();

        return {
          ok: true,
          total: matches.length,
          cards: matches
            .slice(0, ASSISTANT_LIMITS.toolResultCards)
            .map((card) => serializeCard(card, timeZone, now)),
        };
      },
    }),

    /**
     * Công cụ: getCardDetails
     * Mục đích: Truy vấn thông tin chi tiết đầy đủ của một thẻ cụ thể: mô tả nội dung dài,
     * các checklists con (tiến độ, các việc con đã xong / chưa xong, hạn chót từng việc con),
     * tên môn học, người phụ trách và nhãn dán.
     *
     * Ràng buộc dữ liệu:
     * - `cardId`: Chuỗi UUID định danh thẻ hợp lệ, độ dài tối thiểu 1.
     *
     * Kết quả trả về:
     * - Chi tiết thẻ dạng object đầy đủ thông tin hoặc thông báo lỗi nếu không tìm thấy.
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Trả về `{ ok: false, error: "Không tìm thấy thẻ có ID..." }` nếu thẻ không tồn tại trên bảng hoặc đã bị lưu trữ.
     */
    getCardDetails: tool({
      description:
        "Xem chi tiết đầy đủ của một thẻ: mô tả nội dung, checklists con (các việc đã xong / chưa xong), môn học, người phụ trách, nhãn dán.",
      inputSchema: z.object({
        cardId: z.string().min(1).describe("ID thẻ cần xem chi tiết"),
      }),
      execute: async ({ cardId }) => {
        const card = await db.card.findFirst({
          where: { id: cardId, list: { boardId }, archivedAt: null },
          include: {
            list: { select: { id: true, title: true } },
            course: { select: { id: true, name: true, code: true } },
            labels: { select: { label: { select: { id: true, title: true, color: true } } } },
            checklists: {
              orderBy: { order: "asc" },
              include: {
                items: {
                  orderBy: { order: "asc" },
                  select: { id: true, title: true, isCompleted: true, dueDate: true },
                },
              },
            },
          },
        });

        if (!card) {
          return { ok: false, error: `Không tìm thấy thẻ có ID "${cardId}".` };
        }

        const now = new Date();

        return {
          ok: true,
          card: {
            id: card.id,
            title: card.title,
            description: card.description ?? "(Chưa có mô tả)",
            list: card.list.title,
            course: card.course
              ? `${card.course.code ? `${card.course.code} ` : ""}${card.course.name}`
              : null,
            dueDate: formatZonedDateTime(card.dueDate, timeZone),
            startDate: formatZonedDateTime(card.startDate, timeZone),
            isCompleted: card.isCompleted,
            isOverdue: Boolean(card.dueDate && !card.isCompleted && card.dueDate < now),
            assignees: [],
            labels: card.labels.map((l) => l.label.title),
            checklists: card.checklists.map((cl) => ({
              id: cl.id,
              title: cl.title,
              progress: `${cl.items.filter((i) => i.isCompleted).length}/${cl.items.length}`,
              items: cl.items.map((i) => ({
                id: i.id,
                title: i.title,
                isCompleted: i.isCompleted,
                dueDate: formatZonedDateTime(i.dueDate, timeZone),
              })),
            })),
          },
        };
      },
    }),

    /**
     * Công cụ: createDeadlineCard
     * Mục đích: Tạo một thẻ công việc / hạn chót mới trên bảng hiện tại.
     * Tự động xác định cột đích (ưu tiên listId -> listTitle -> cột đầu tiên),
     * tính toán thứ tự sắp xếp (order), liên kết môn học và tự động phân công nếu yêu cầu.
     *
     * Ràng buộc dữ liệu (Input constraints):
     * - `title`: Tiêu đề công việc, bắt buộc, độ dài từ 1 đến 200 ký tự.
     * - `dueDate`: Hạn chót dạng ISO 8601 kèm offset múi giờ (tùy chọn).
     * - `startDate`: Ngày bắt đầu dạng ISO 8601 kèm offset múi giờ (tùy chọn).
     * - Ràng buộc ngày: `startDate` không được phép diễn ra sau `dueDate`.
     * - `listId`: UUID cột đích (tùy chọn).
     * - `listTitle`: Tên cột đích nếu không biết ID (tùy chọn).
     * - `courseId`: UUID môn học thuộc bảng (tùy chọn).
     * - `description`: Mô tả chi tiết công việc (tùy chọn).
     * - `assignee`: "me" (tự động giao cho người đang chat) hoặc "none" (không giao việc).
     *
     * Kết quả trả về:
     * - Đối tượng {@link AssistantMutationOutput} với `action: "created"` và dữ liệu thẻ vừa tạo.
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Trả về `{ ok: false, error: ... }` khi:
     *   + Người dùng không có quyền biên tập (VIEWER).
     *   + Bảng chưa có cột nào để tạo thẻ.
     *   + Định dạng `dueDate` hoặc `startDate` không thể parse thành Date hợp lệ.
     *   + `startDate` lớn hơn `dueDate`.
     */
    createDeadlineCard: tool({
      description:
        "Tạo một thẻ nhắc hẹn / deadline mới trên bảng hiện tại. Chỉ dùng khi người dùng yêu cầu tạo việc/nhắc hạn. Cần ít nhất tiêu đề.",
      inputSchema: z.object({
        title: z.string().min(1).max(200).describe("Tiêu đề thẻ / việc cần làm"),
        dueDate: isoDateTime.optional().describe("Hạn chót dạng ISO 8601 kèm múi giờ"),
        startDate: isoDateTime.optional().describe("Ngày bắt đầu dạng ISO 8601 kèm múi giờ"),
        listId: z.string().optional().describe("ID cột chứa thẻ; mặc định là cột đầu tiên của bảng"),
        listTitle: z.string().optional().describe("Tên cột muốn đưa thẻ vào (nếu không có ID)"),
        courseId: z.string().optional().describe("ID môn học muốn gán thẻ"),
        description: z.string().optional().describe("Mô tả hoặc ghi chú chi tiết cho thẻ"),
        assignee: z
          .enum(["me", "none"])
          .default("none")
          .describe("'me' = tự động giao thẻ cho người đang chat, 'none' = không giao"),
      }),
      execute: async ({ title, dueDate, startDate, listId, listTitle, courseId, description, assignee }): Promise<AssistantMutationOutput> => {
        const permissionError = await ensureEditor();

        if (permissionError) {
          return { ok: false, error: permissionError };
        }

        const snapshot = await loadBoardSnapshot(boardId);

        if (!snapshot || snapshot.lists.length === 0) {
          return { ok: false, error: "Bảng chưa có cột nào để tạo thẻ." };
        }

        let targetList = snapshot.lists[0];

        if (listId) {
          const found = snapshot.lists.find((l) => l.id === listId);

          if (found) targetList = found;
        } else if (listTitle) {
          const needle = normalize(listTitle);
          const found = snapshot.lists.find((l) => normalize(l.title).includes(needle));

          if (found) targetList = found;
        }

        const parsedDue = dueDate ? parseIsoDateTime(dueDate) : null;
        const parsedStart = startDate ? parseIsoDateTime(startDate) : null;

        if (dueDate && !parsedDue) {
          return { ok: false, error: "Định dạng hạn chót (dueDate) không hợp lệ." };
        }

        if (startDate && !parsedStart) {
          return { ok: false, error: "Định dạng ngày bắt đầu (startDate) không hợp lệ." };
        }

        const dateRangeError = validateCardDateRange(parsedStart, parsedDue);

        if (dateRangeError) {
          return { ok: false, error: dateRangeError };
        }

        const lastCard = await db.card.findFirst({
          where: { listId: targetList.id, archivedAt: null },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        const newOrder = lastCard ? lastCard.order + 1 : 1;

        const card = await db.card.create({
          data: {
            title: title.trim(),
            listId: targetList.id,
            order: newOrder,
            startDate: parsedStart,
            dueDate: parsedDue,
            description: description?.trim() || null,
            courseId: courseId ?? null,
          },
          include: {
            list: { select: { title: true } },
          },
        });

        const assignedNames: string[] = [];


        await createAuditLog({
          entityId: card.id,
          entityType: ENTITY_TYPE.CARD,
          entityTitle: card.title,
          action: ACTION.CREATE,
          eventType: AUDIT_EVENT_TYPE.CREATE,
          boardId,
          cardId: card.id,
        });

        triggerCardCreated({
          boardId,
          listId: targetList.id,
          cardId: card.id,
          actorUserId: session.userId,
        }).catch((error) => logger.warn("assistant:triggerCardCreated", { error }));

        return {
          ok: true,
          action: "created",
          card: toActionCard(
            card,
            { boardId, list: card.list.title, assignees: assignedNames },
            timeZone,
          ),
        };
      },
    }),

    /**
     * Công cụ: updateCardDeadline
     * Mục đích: Cập nhật thời hạn (dueDate), ngày bắt đầu (startDate) hoặc thay đổi
     * trạng thái hoàn thành (isCompleted) của một thẻ trên bảng.
     *
     * Ràng buộc dữ liệu (Input constraints):
     * - `cardId`: UUID của thẻ cần cập nhật, bắt buộc.
     * - `dueDate`: Chuỗi ISO 8601 kèm múi giờ, `null` (nếu muốn xóa hạn), hoặc `undefined` (nếu giữ nguyên).
     * - `startDate`: Chuỗi ISO 8601 kèm múi giờ, `null` (nếu muốn xóa ngày bắt đầu), hoặc `undefined` (nếu giữ nguyên).
     * - `isCompleted`: boolean (đánh dấu hoàn thành hoặc mở lại thẻ).
     * - Ràng buộc ngày: Sau khi cập nhật, `startDate` không được lớn hơn `dueDate`.
     *
     * Kết quả trả về:
     * - Đối tượng {@link AssistantMutationOutput} với `action: "updated"`, danh sách các thay đổi (`changes`) và thẻ đã cập nhật.
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Người dùng thiếu quyền biên tập.
     * - Thẻ không tồn tại trên bảng hiện tại.
     * - Định dạng chuỗi ngày tháng không hợp lệ.
     * - Ngày bắt đầu sau hạn chót.
     * - Lỗi xử lý từ `updateCardService`.
     */
    updateCardDeadline: tool({
      description:
        "Cập nhật hạn chót, ngày bắt đầu, hoặc đánh dấu hoàn thành một thẻ trên bảng. Dùng findCards trước nếu chưa có cardId.",
      inputSchema: z.object({
        cardId: z.string().min(1).describe("ID thẻ cần cập nhật"),
        dueDate: isoDateTime
          .nullable()
          .optional()
          .describe("Hạn chót mới (null nếu muốn xóa hạn)"),
        startDate: isoDateTime
          .nullable()
          .optional()
          .describe("Ngày bắt đầu mới (null nếu muốn xóa)"),
        isCompleted: z.boolean().optional().describe("Đánh dấu hoàn thành / chưa hoàn thành"),
      }),
      execute: async ({ cardId, dueDate, startDate, isCompleted }): Promise<AssistantMutationOutput> => {
        const permissionError = await ensureEditor();

        if (permissionError) {
          return { ok: false, error: permissionError };
        }

        const existing = await db.card.findFirst({
          where: { id: cardId, list: { boardId } },
          include: {
            list: { select: { title: true } },
          },
        });

        if (!existing) {
          return { ok: false, error: `Không tìm thấy thẻ có ID "${cardId}" trên bảng.` };
        }

        const nextDue =
          dueDate === undefined
            ? existing.dueDate
            : dueDate === null
              ? null
              : parseIsoDateTime(dueDate);

        const nextStart =
          startDate === undefined
            ? existing.startDate
            : startDate === null
              ? null
              : parseIsoDateTime(startDate);

        if (dueDate && !nextDue) {
          return { ok: false, error: "Định dạng hạn chót (dueDate) không hợp lệ." };
        }

        if (startDate && !nextStart) {
          return { ok: false, error: "Định dạng ngày bắt đầu (startDate) không hợp lệ." };
        }

        const dateRangeError = validateCardDateRange(nextStart, nextDue);

        if (dateRangeError) {
          return { ok: false, error: dateRangeError };
        }

        const result = await updateCardService({
          userId,
          data: {
            id: cardId,
            boardId,
            ...(dueDate !== undefined ? { dueDate: nextDue } : {}),
            ...(startDate !== undefined ? { startDate: nextStart } : {}),
            ...(isCompleted !== undefined ? { isCompleted } : {}),
          },
        });

        if (result.error || !result.data) {
          return { ok: false, error: result.error ?? "Cập nhật thẻ thất bại." };
        }

        const changes: string[] = [];

        if (dueDate !== undefined) {
          changes.push(
            nextDue ? `Hạn chót mới: ${formatZonedDateTime(nextDue, timeZone)}` : "Đã xóa hạn chót",
          );
        }

        if (startDate !== undefined) {
          changes.push(
            nextStart ? `Ngày bắt đầu mới: ${formatZonedDateTime(nextStart, timeZone)}` : "Đã xóa ngày bắt đầu",
          );
        }

        if (isCompleted !== undefined) {
          changes.push(isCompleted ? "Đã đánh dấu hoàn thành" : "Đã mở lại thẻ (chưa xong)");
        }

        return {
          ok: true,
          action: "updated",
          changes,
          card: toActionCard(
            result.data,
            {
              boardId,
              list: existing.list.title,
              assignees: [],
            },
            timeZone,
          ),
        };
      },
    }),

    /**
     * Công cụ: createRecurringSchedule
     * Mục đích: Tạo chuỗi lịch lặp lại định kỳ (ví dụ: "học bài 5h sáng mỗi ngày",
     * "ôn thi 20h các ngày trong tuần", "tập gym thứ 2, 4, 6").
     * BẮT BUỘC gọi công cụ này khi người dùng yêu cầu việc lặp lại, thay vì chỉ tạo 1 thẻ đơn lẻ.
     * Tự động tính toán mốc giờ địa phương chính xác và sinh chuỗi thẻ kèm tên thứ trong ngoặc.
     *
     * Ràng buộc dữ liệu (Input constraints):
     * - `title`: Tiêu đề buổi học/công việc, độ dài [1..200 ký tự].
     * - `time`: Giờ diễn ra định dạng 24h `HH:mm` (regex: `^([01]\d|2[0-3]):[0-5]\d$`, ví dụ: "05:00", "19:30").
     * - `frequency`: "daily" (mỗi ngày), "weekdays" (thứ 2 đến thứ 6), hoặc "custom_days" (các thứ chỉ định).
     * - `daysOfWeek`: Mảng số nguyên [0..6] (0 = Chủ Nhật, 1 = Thứ 2, ..., 6 = Thứ 7). Bắt buộc nếu chọn "custom_days".
     * - `daysCount`: Số buổi cần lên lịch, số nguyên trong khoảng [1..14], mặc định 7 buổi.
     * - `listId` / `listTitle`: Cột đích đưa thẻ vào.
     * - `courseId`: UUID môn học muốn gán.
     * - `assignee`: "me" (mặc định) hoặc "none".
     * - `description`: Ghi chú hoặc mô tả cho chuỗi buổi học.
     *
     * Kết quả trả về:
     * - Đối tượng {@link AssistantMutationOutput} với `action: "batch_created"`, tóm tắt số buổi và danh sách các thẻ vừa tạo.
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Người dùng thiếu quyền biên tập.
     * - Bảng chưa có cột nào để tạo thẻ.
     * - Không tìm thấy ngày nào thỏa mãn điều kiện lặp lại trong phạm vi 35 ngày tới.
     */
    createRecurringSchedule: tool({
      description:
        "Tạo chuỗi lịch lặp lại (ví dụ: 'tạo lịch học 5h mỗi ngày', 'lịch ôn thi 20h các ngày trong tuần', 'lịch làm bài tập thứ 2, 4, 6'). BẮT BUỘC dùng công cụ này khi người dùng yêu cầu công việc lặp lại 'mỗi ngày', 'hàng ngày', 'thứ X hàng tuần', thay vì chỉ tạo 1 thẻ đơn lẻ. Tự động tạo chuỗi các thẻ tương ứng cho các ngày tới kèm hạn chót chuẩn xác.",
      inputSchema: z.object({
        title: z.string().min(1).max(200).describe("Tiêu đề buổi học/công việc (ví dụ: 'Học bài buổi sáng', 'Ôn thi Giải tích')"),
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe("Giờ diễn ra theo định dạng 24h HH:mm (ví dụ: '05:00', '08:30', '19:00')"),
        frequency: z.enum(["daily", "weekdays", "custom_days"]).default("daily").describe("'daily' = hàng ngày; 'weekdays' = thứ Hai đến thứ Sáu; 'custom_days' = các thứ cụ thể"),
        daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().describe("Nếu custom_days: 0=Chủ nhật, 1=Thứ 2, ..., 6=Thứ 7"),
        daysCount: z.number().int().min(1).max(14).default(7).describe("Số buổi cần lên lịch (mặc định 7 buổi, tối đa 14)"),
        listId: z.string().optional().describe("ID cột chứa thẻ"),
        listTitle: z.string().optional().describe("Tên cột muốn đưa thẻ vào"),
        courseId: z.string().optional().describe("ID môn học muốn gán thẻ"),
        assignee: z.enum(["me", "none"]).default("me").describe("'me' = tự động giao cho người đang chat, 'none' = không giao"),
        description: z.string().optional().describe("Mô tả hoặc nội dung ghi chú cho buổi học"),
      }),
      execute: async ({
        title,
        time,
        frequency,
        daysOfWeek,
        daysCount,
        listId,
        listTitle,
        courseId,
        assignee,
        description,
      }): Promise<AssistantMutationOutput> => {
        const permissionError = await ensureEditor();

        if (permissionError) {
          return { ok: false, error: permissionError };
        }

        const snapshot = await loadBoardSnapshot(boardId);

        if (!snapshot || snapshot.lists.length === 0) {
          return { ok: false, error: "Bảng chưa có cột nào để tạo thẻ." };
        }

        let targetList = snapshot.lists[0];

        if (listId) {
          const found = snapshot.lists.find((l) => l.id === listId);

          if (found) targetList = found;
        } else if (listTitle) {
          const needle = normalize(listTitle);
          const found = snapshot.lists.find((l) => normalize(l.title).includes(needle));

          if (found) targetList = found;
        }

        const [hourStr, minStr] = time.split(":");
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minStr, 10);
        const now = new Date();

        const todayAtTargetTime = getZonedTimeOnDay(now, timeZone, 0, hour, minute);
        const startOffset = todayAtTargetTime.getTime() > now.getTime() ? 0 : 1;

        const targetDates: Date[] = [];
        let dayOffset = startOffset;

        while (targetDates.length < daysCount && dayOffset < 35) {
          const candidateDate = getZonedTimeOnDay(now, timeZone, dayOffset, hour, minute);
          const weekday = getWeekdayIndex(candidateDate, timeZone);

          let match = false;

          if (frequency === "daily") {
            match = true;
          } else if (frequency === "weekdays") {
            match = weekday >= 1 && weekday <= 5;
          } else if (frequency === "custom_days" && daysOfWeek && daysOfWeek.length > 0) {
            match = daysOfWeek.includes(weekday);
          }

          if (match) {
            targetDates.push(candidateDate);
          }

          dayOffset += 1;
        }

        if (targetDates.length === 0) {
          return { ok: false, error: "Không tìm thấy ngày nào phù hợp với yêu cầu lặp lại." };
        }

        const lastCard = await db.card.findFirst({
          where: { listId: targetList.id, archivedAt: null },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        let currentOrder = lastCard ? lastCard.order + 1 : 1;
        const createdActionCards: AssistantActionCard[] = [];
        const assignedNames: string[] = [];

        const me = snapshot.members.find((m) => m.id === session.boardMemberId);

        if (assignee === "me" && me) {
          assignedNames.push(me.userName);
        }

        for (const targetDate of targetDates) {
          const dayName = getWeekdayName(targetDate, timeZone);
          const cardTitle = `${title.trim()} (${dayName})`;

          const card = await db.card.create({
            data: {
              title: cardTitle,
              listId: targetList.id,
              order: currentOrder++,
              dueDate: targetDate,
              description: description?.trim() || null,
              courseId: courseId ?? null,
            },
            include: {
              list: { select: { title: true } },
            },
          });


          await createAuditLog({
            entityId: card.id,
            entityType: ENTITY_TYPE.CARD,
            entityTitle: card.title,
            action: ACTION.CREATE,
            eventType: AUDIT_EVENT_TYPE.CREATE,
            boardId,
            cardId: card.id,
          });

          triggerCardCreated({
            boardId,
            listId: targetList.id,
            cardId: card.id,
            actorUserId: session.userId,
          }).catch((error) => logger.warn("assistant:triggerCardCreated", { error }));

          createdActionCards.push(
            toActionCard(
              card,
              { boardId, list: card.list.title, assignees: assignedNames },
              timeZone,
            ),
          );
        }

        return {
          ok: true,
          action: "batch_created",
          summary: `Đã tạo chuỗi ${createdActionCards.length} lịch học "${title}" lúc ${time} cho các ngày tới`,
          cards: createdActionCards,
        };
      },
    }),

    /**
     * Công cụ: batchCreateCards
     * Mục đích: Tạo hàng loạt từ 1 đến 15 thẻ công việc cùng một lúc.
     * Sử dụng khi sinh viên nhờ lập kế hoạch học tập nhiều bước, chia nhỏ đồ án,
     * hoặc tạo danh sách việc cần làm theo tuần.
     *
     * Ràng buộc dữ liệu (Input constraints):
     * - `cards`: Mảng từ 1 đến 15 thẻ, mỗi phần tử gồm:
     *   + `title`: [1..200 ký tự].
     *   + `dueDate` / `startDate`: ISO 8601 kèm múi giờ (tùy chọn).
     *   + `listTitle`: Tên cột muốn đưa vào (tùy chọn, mặc định cột đầu tiên).
     *   + `courseId`: UUID môn học (tùy chọn).
     *   + `assignee`: "me" hoặc "none" (mặc định "me").
     *   + `description`: Mô tả chi tiết (tùy chọn).
     *
     * Kết quả trả về:
     * - Đối tượng {@link AssistantMutationOutput} với `action: "batch_created"` và danh sách Action Card vừa tạo.
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Người dùng thiếu quyền biên tập.
     * - Bảng chưa có cột nào để tạo thẻ.
     */
    batchCreateCards: tool({
      description:
        "Tạo hàng loạt nhiều thẻ công việc cùng một lúc. Dùng khi lập kế hoạch học tập, lộ trình ôn thi nhiều giai đoạn, các mốc đồ án / bài tập lớn.",
      inputSchema: z.object({
        cards: z
          .array(
            z.object({
              title: z.string().min(1).max(200).describe("Tiêu đề thẻ"),
              dueDate: isoDateTime.optional().describe("Hạn chót ISO 8601 kèm múi giờ"),
              startDate: isoDateTime.optional().describe("Ngày bắt đầu ISO 8601 kèm múi giờ"),
              listTitle: z.string().optional().describe("Tên cột muốn đưa vào"),
              courseId: z.string().optional().describe("ID môn học"),
              assignee: z.enum(["me", "none"]).default("me").describe("Giao cho người chat hay không"),
              description: z.string().optional().describe("Mô tả công việc"),
            }),
          )
          .min(1)
          .max(15)
          .describe("Danh sách các thẻ cần tạo"),
      }),
      execute: async ({ cards }): Promise<AssistantMutationOutput> => {
        const permissionError = await ensureEditor();

        if (permissionError) {
          return { ok: false, error: permissionError };
        }

        const snapshot = await loadBoardSnapshot(boardId);

        if (!snapshot || snapshot.lists.length === 0) {
          return { ok: false, error: "Bảng chưa có cột nào để tạo thẻ." };
        }

        const createdActionCards: AssistantActionCard[] = [];
        const me = snapshot.members.find((m) => m.id === session.boardMemberId);

        for (const cardItem of cards) {
          let targetList = snapshot.lists[0];

          if (cardItem.listTitle) {
            const needle = normalize(cardItem.listTitle);
            const found = snapshot.lists.find((l) => normalize(l.title).includes(needle));

            if (found) targetList = found;
          }

          const parsedDue = cardItem.dueDate ? parseIsoDateTime(cardItem.dueDate) : null;
          const parsedStart = cardItem.startDate ? parseIsoDateTime(cardItem.startDate) : null;

          const lastCard = await db.card.findFirst({
            where: { listId: targetList.id, archivedAt: null },
            orderBy: { order: "desc" },
            select: { order: true },
          });

          const newOrder = lastCard ? lastCard.order + 1 : 1;

          const card = await db.card.create({
            data: {
              title: cardItem.title.trim(),
              listId: targetList.id,
              order: newOrder,
              startDate: parsedStart,
              dueDate: parsedDue,
              description: cardItem.description?.trim() || null,
              courseId: cardItem.courseId ?? null,
            },
            include: { list: { select: { title: true } } },
          });

          const assignedNames: string[] = [];


          await createAuditLog({
            entityId: card.id,
            entityType: ENTITY_TYPE.CARD,
            entityTitle: card.title,
            action: ACTION.CREATE,
            eventType: AUDIT_EVENT_TYPE.CREATE,
            boardId,
            cardId: card.id,
          });

          triggerCardCreated({
            boardId,
            listId: targetList.id,
            cardId: card.id,
            actorUserId: session.userId,
          }).catch((error) => logger.warn("assistant:triggerCardCreated", { error }));

          createdActionCards.push(
            toActionCard(
              card,
              { boardId, list: targetList.title, assignees: assignedNames },
              timeZone,
            ),
          );
        }

        return {
          ok: true,
          action: "batch_created",
          summary: `Đã tạo thành công ${createdActionCards.length} thẻ công việc`,
          cards: createdActionCards,
        };
      },
    }),

    /**
     * Công cụ: createCardChecklist
     * Mục đích: Tạo danh sách các công việc con (Checklist) cho một thẻ đã có trên bảng.
     * Thường dùng khi cần chia nhỏ các bước thực hiện của một bài tập lớn hoặc đồ án.
     *
     * Ràng buộc dữ liệu (Input constraints):
     * - `cardId`: UUID định danh thẻ hợp lệ.
     * - `title`: Tiêu đề danh sách checklist, độ dài [1..100 ký tự], mặc định "Checklist".
     * - `items`: Mảng chứa từ 1 đến 20 việc con, mỗi việc con có tiêu đề từ 1 đến 250 ký tự.
     *
     * Kết quả trả về:
     * - Đối tượng {@link AssistantMutationOutput} với `action: "checklist_created"` và danh sách việc con vừa tạo.
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Người dùng thiếu quyền biên tập.
     * - Không tìm thấy thẻ có ID chỉ định trên bảng hiện tại.
     */
    createCardChecklist: tool({
      description:
        "Tạo danh sách công việc con (Checklist) cho một thẻ đã có trên bảng. Dùng khi muốn chia nhỏ bài tập, đồ án, hoặc tạo checklist theo dõi.",
      inputSchema: z.object({
        cardId: z.string().min(1).describe("ID thẻ cần thêm checklist"),
        title: z.string().min(1).max(100).default("Checklist").describe("Tiêu đề checklist (ví dụ: 'Các bước thực hiện', 'Nội dung cần ôn')"),
        items: z.array(z.string().min(1).max(250)).min(1).max(20).describe("Danh sách các đầu việc con"),
      }),
      execute: async ({ cardId, title, items }): Promise<AssistantMutationOutput> => {
        const permissionError = await ensureEditor();

        if (permissionError) {
          return { ok: false, error: permissionError };
        }

        const card = await db.card.findFirst({
          where: { id: cardId, list: { boardId }, archivedAt: null },
          include: {
            list: { select: { title: true } },
            
          },
        });

        if (!card) {
          return { ok: false, error: `Không tìm thấy thẻ có ID "${cardId}".` };
        }

        const lastChecklist = await db.checklist.findFirst({
          where: { cardId },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        const newOrder = lastChecklist ? lastChecklist.order + 1 : 1;

        const checklist = await db.checklist.create({
          data: {
            cardId,
            title: title.trim(),
            order: newOrder,
            items: {
              create: items.map((item, index) => ({
                title: item.trim(),
                order: index + 1,
                isCompleted: false,
              })),
            },
          },
          include: {
            items: true,
          },
        });

        await createAuditLog({
          entityId: checklist.id,
          entityType: ENTITY_TYPE.CHECKLIST,
          entityTitle: checklist.title,
          action: ACTION.CREATE,
          eventType: AUDIT_EVENT_TYPE.CHECKLIST,
          boardId,
          cardId,
        });

        triggerChecklistCreated({
          boardId,
          actorUserId: session.userId,
          cardId,
          checklistId: checklist.id,
        }).catch((error) => logger.warn("assistant:triggerChecklistCreated", { error }));

        for (const item of checklist.items) {
          triggerChecklistItemCreated({
            boardId,
            actorUserId: session.userId,
            cardId,
            checklistId: checklist.id,
            checklistItemId: item.id,
          }).catch((error) => logger.warn("assistant:triggerChecklistItemCreated", { error }));
        }

        return {
          ok: true,
          action: "checklist_created",
          checklistTitle: checklist.title,
          items: checklist.items.map((i) => i.title),
          card: toActionCard(
            card,
            { boardId, list: card.list.title, assignees: [], },
            timeZone,
          ),
        };
      },
    }),

    /**
     * Công cụ: moveCard
     * Mục đích: Di chuyển một thẻ sang cột khác (ví dụ: chuyển sang cột "Đang làm" hoặc "Hoàn thành").
     *
     * Ràng buộc dữ liệu (Input constraints):
     * - `cardId`: UUID thẻ cần di chuyển.
     * - `destinationListId`: UUID cột đích (nếu biết).
     * - `destinationListTitle`: Tên cột đích (tìm kiếm mềm nếu không có ID).
     *
     * Kết quả trả về:
     * - Đối tượng {@link AssistantMutationOutput} với `action: "moved"`, tên cột xuất phát và cột đích.
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Người dùng thiếu quyền biên tập.
     * - Không tìm thấy thẻ trên bảng.
     * - Không tìm thấy cột đích phù hợp.
     * - Thẻ hiện đã nằm sẵn ở cột đích đó.
     */
    moveCard: tool({
      description:
        "Di chuyển một thẻ sang cột khác (ví dụ: chuyển từ 'Cần làm' sang 'Đang làm' hoặc 'Hoàn thành'). Dùng findCards nếu chưa rõ ID.",
      inputSchema: z.object({
        cardId: z.string().min(1).describe("ID thẻ cần chuyển"),
        destinationListTitle: z.string().optional().describe("Tên cột đích (ví dụ: 'Đang làm', 'Hoàn thành')"),
        destinationListId: z.string().optional().describe("ID cột đích (nếu có)"),
      }),
      execute: async ({ cardId, destinationListTitle, destinationListId }): Promise<AssistantMutationOutput> => {
        const permissionError = await ensureEditor();

        if (permissionError) {
          return { ok: false, error: permissionError };
        }

        const snapshot = await loadBoardSnapshot(boardId);

        if (!snapshot || snapshot.lists.length === 0) {
          return { ok: false, error: "Bảng không tồn tại." };
        }

        const card = await db.card.findFirst({
          where: { id: cardId, list: { boardId }, archivedAt: null },
          include: {
            list: { select: { id: true, title: true } },
            
          },
        });

        if (!card) {
          return { ok: false, error: `Không tìm thấy thẻ có ID "${cardId}".` };
        }

        let targetList: (typeof snapshot.lists)[number] | undefined;

        if (destinationListId) {
          targetList = snapshot.lists.find((l) => l.id === destinationListId);
        } else if (destinationListTitle) {
          const needle = normalize(destinationListTitle);
          targetList = snapshot.lists.find((l) => normalize(l.title).includes(needle));
        }

        if (!targetList) {
          return { ok: false, error: `Không tìm thấy cột đích "${destinationListTitle || destinationListId}".` };
        }

        if (targetList.id === card.listId) {
          return { ok: false, error: `Thẻ hiện đã nằm ở cột "${targetList.title}" rồi.` };
        }

        const lastCard = await db.card.findFirst({
          where: { listId: targetList.id, archivedAt: null },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        const newOrder = lastCard ? lastCard.order + 1 : 1;

        const updated = await db.card.update({
          where: { id: cardId },
          data: {
            listId: targetList.id,
            order: newOrder,
          },
          include: {
            list: { select: { title: true } },
          },
        });

        await createAuditLog({
          entityId: card.id,
          entityType: ENTITY_TYPE.CARD,
          entityTitle: card.title,
          action: ACTION.UPDATE,
          eventType: AUDIT_EVENT_TYPE.MOVE,
          boardId,
          cardId: card.id,
        });

        triggerCardMoved({
          boardId,
          actorUserId: session.userId,
          cardId: card.id,
          sourceListId: card.listId,
          destinationListId: targetList.id,
        }).catch((error) => logger.warn("assistant:triggerCardMoved", { error }));

        return {
          ok: true,
          action: "moved",
          fromList: card.list.title,
          toList: targetList.title,
          card: toActionCard(
            updated,
            { boardId, list: targetList.title, assignees: [], },
            timeZone,
          ),
        };
      },
    }),

    /**
     * Công cụ: updateCardDetails
     * Mục đích: Cập nhật các thông tin mô tả chi tiết của thẻ: đổi tiêu đề, cập nhật mô tả markdown,
     * hoặc thay đổi / gỡ bỏ liên kết môn học (`courseId`).
     *
     * Ràng buộc dữ liệu (Input constraints):
     * - `cardId`: UUID định danh thẻ.
     * - `title`: Tiêu đề mới, độ dài [1..200 ký tự] (tùy chọn).
     * - `description`: Nội dung mô tả mới, độ dài tối đa 5000 ký tự (tùy chọn).
     * - `courseId`: UUID môn học mới, hoặc `null` nếu muốn gỡ môn (tùy chọn).
     *
     * Kết quả trả về:
     * - Đối tượng {@link AssistantMutationOutput} với `action: "updated"` và mảng thay đổi `changes`.
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Người dùng thiếu quyền biên tập.
     * - Không tìm thấy thẻ có ID chỉ định.
     * - Không có thông tin nào thay đổi so với dữ liệu hiện tại trong DB.
     */
    updateCardDetails: tool({
      description:
        "Cập nhật thông tin chi tiết của thẻ: đổi tiêu đề, cập nhật mô tả, hoặc gán môn học.",
      inputSchema: z.object({
        cardId: z.string().min(1).describe("ID thẻ cần cập nhật"),
        title: z.string().min(1).max(200).optional().describe("Tiêu đề mới"),
        description: z.string().max(5000).optional().describe("Mô tả nội dung mới"),
        courseId: z.string().nullable().optional().describe("ID môn học mới (truyền null nếu muốn gỡ môn)"),
      }),
      execute: async ({ cardId, title, description, courseId }): Promise<AssistantMutationOutput> => {
        const permissionError = await ensureEditor();

        if (permissionError) {
          return { ok: false, error: permissionError };
        }

        const existing = await db.card.findFirst({
          where: { id: cardId, list: { boardId }, archivedAt: null },
          include: {
            list: { select: { title: true } },
            
          },
        });

        if (!existing) {
          return { ok: false, error: `Không tìm thấy thẻ có ID "${cardId}".` };
        }

        const changes: string[] = [];
        const changedFields: CardUpdatedField[] = [];
        const updateData: Record<string, unknown> = {};

        if (title !== undefined && title.trim() !== existing.title) {
          updateData.title = title.trim();
          changes.push(`Đổi tiêu đề: "${title.trim()}"`);
          changedFields.push("title");
        }

        if (description !== undefined) {
          updateData.description = description.trim() || null;
          updateData.descriptionUpdatedAt = new Date();
          changes.push("Đã cập nhật mô tả");
          changedFields.push("description");
        }

        if (courseId !== undefined && courseId !== existing.courseId) {
          updateData.courseId = courseId;
          changes.push(courseId ? "Đã gán môn học mới" : "Đã gỡ môn học");
          changedFields.push("courseId");
        }

        if (Object.keys(updateData).length === 0) {
          return { ok: false, error: "Không có thông tin nào thay đổi." };
        }

        const updated = await db.card.update({
          where: { id: cardId },
          data: updateData,
          include: { list: { select: { title: true } } },
        });

        await createAuditLog({
          entityId: cardId,
          entityType: ENTITY_TYPE.CARD,
          entityTitle: updated.title,
          action: ACTION.UPDATE,
          eventType: AUDIT_EVENT_TYPE.UPDATE,
          boardId,
          cardId,
        });

        triggerCardUpdated({
          boardId,
          cardId,
          actorUserId: session.userId,
          changedFields,
          card: updated,
          updatedAt: new Date(),
        }).catch((error) => logger.warn("assistant:triggerCardUpdated", { error }));

        return {
          ok: true,
          action: "updated",
          changes,
          card: toActionCard(
            updated,
            { boardId, list: existing.list.title, assignees: [], },
            timeZone,
          ),
        };
      },
    }),

    /**
     * Công cụ: archiveCard
     * Mục đích: Lưu trữ (xóa mềm) một thẻ khỏi bảng khi người dùng yêu cầu xóa hoặc cất đi.
     * Cập nhật thời điểm `archivedAt` và danh sách nguồn `archivedByListId`.
     *
     * Ràng buộc dữ liệu (Input constraints):
     * - `cardId`: UUID của thẻ cần lưu trữ.
     *
     * Kết quả trả về:
     * - Đối tượng {@link AssistantMutationOutput} với `action: "archived"` và tiêu đề thẻ `cardTitle`.
     *
     * Trường hợp ngoại lệ / lỗi:
     * - Người dùng thiếu quyền biên tập.
     * - Không tìm thấy thẻ có ID chỉ định trên bảng hiện tại.
     */
    archiveCard: tool({
      description:
        "Lưu trữ (xóa) một thẻ khỏi bảng khi người dùng yêu cầu xóa hoặc lưu trữ. Dùng findCards trước nếu chưa rõ ID.",
      inputSchema: z.object({
        cardId: z.string().min(1).describe("ID thẻ cần lưu trữ"),
      }),
      execute: async ({ cardId }): Promise<AssistantMutationOutput> => {
        const permissionError = await ensureEditor();

        if (permissionError) {
          return { ok: false, error: permissionError };
        }

        const card = await db.card.findFirst({
          where: { id: cardId, list: { boardId }, archivedAt: null },
          include: { list: { select: { title: true } } },
        });

        if (!card) {
          return { ok: false, error: `Không tìm thấy thẻ có ID "${cardId}".` };
        }

        await db.card.update({
          where: { id: cardId },
          data: {
            archivedAt: new Date(),
            archivedByListId: card.listId,
          },
        });

        await createAuditLog({
          entityId: card.id,
          entityType: ENTITY_TYPE.CARD,
          entityTitle: card.title,
          action: ACTION.DELETE,
          eventType: AUDIT_EVENT_TYPE.DELETE,
          boardId,
          cardId: card.id,
        });

        triggerCardDeleted({
          boardId,
          listId: card.listId,
          cardId: card.id,
          actorUserId: session.userId,
        }).catch((error) => logger.warn("assistant:triggerCardDeleted", { error }));

        return {
          ok: true,
          action: "archived",
          cardTitle: card.title,
        };
      },
    }),

    /**
     * Công cụ: createCardDependency
     * Mục đích: Thiết lập quan hệ phụ thuộc giữa 2 thẻ công việc trên bảng.
     * Thẻ blockerCard (làm trước) phải xong thì thẻ blockedCard (làm sau) mới được thực hiện.
     * Có thể truyền ID hoặc Tên thẻ (hệ thống tự động tra cứu trên bảng).
     */
    createCardDependency: tool({
      description:
        "Thiết lập quan hệ phụ thuộc giữa 2 thẻ (Thẻ A phải hoàn thành trước thẻ B). Có thể truyền ID hoặc TÊN THẺ (hệ thống tự tìm thẻ theo tên). Dùng khi người dùng yêu cầu: 'thẻ A là tiền đề của thẻ B', 'thẻ B phụ thuộc vào thẻ A', 'thẻ B bị chặn bởi thẻ A', hoặc 'nối phụ thuộc giữa A và B'.",
      inputSchema: z.object({
        blockerCard: z
          .string()
          .min(1)
          .describe("ID hoặc Tên của thẻ phải làm xong trước (thẻ chặn / tiền đề)"),
        blockedCard: z
          .string()
          .min(1)
          .describe("ID hoặc Tên của thẻ làm sau (thẻ bị chặn / phụ thuộc)"),
      }),
      execute: async ({ blockerCard, blockedCard }): Promise<AssistantMutationOutput> => {
        const permissionError = await ensureEditor();

        if (permissionError) {
          return { ok: false, error: permissionError };
        }

        const resolveCard = async (query: string) => {
          const q = query.trim();
          // 1. Thử tìm theo ID
          let card = await db.card.findFirst({
            where: { id: q, list: { boardId }, archivedAt: null },
            select: { id: true, title: true },
          });
          if (card) return card;

          // 2. Thử tìm theo tên chính xác
          card = await db.card.findFirst({
            where: {
              title: { equals: q },
              list: { boardId },
              archivedAt: null,
            },
            select: { id: true, title: true },
          });
          if (card) return card;

          // 3. Thử tìm theo tên chứa từ khóa
          card = await db.card.findFirst({
            where: {
              title: { contains: q },
              list: { boardId },
              archivedAt: null,
            },
            select: { id: true, title: true },
          });
          return card;
        };

        const [resolvedBlocker, resolvedBlocked] = await Promise.all([
          resolveCard(blockerCard),
          resolveCard(blockedCard),
        ]);

        if (!resolvedBlocker) {
          return {
            ok: false,
            error: `Không tìm thấy thẻ tiền đề (thẻ chặn) nào phù hợp với "${blockerCard}" trên bảng này.`,
          };
        }

        if (!resolvedBlocked) {
          return {
            ok: false,
            error: `Không tìm thấy thẻ phụ thuộc (thẻ bị chặn) nào phù hợp với "${blockedCard}" trên bảng này.`,
          };
        }

        if (resolvedBlocker.id === resolvedBlocked.id) {
          return {
            ok: false,
            error: "Một thẻ không thể thiết lập phụ thuộc vào chính nó.",
          };
        }

        // Kiểm tra xem liên kết phụ thuộc đã tồn tại chưa
        const existing = await db.cardDependency.findUnique({
          where: {
            blockerCardId_blockedCardId: {
              blockerCardId: resolvedBlocker.id,
              blockedCardId: resolvedBlocked.id,
            },
          },
        });

        if (existing) {
          return {
            ok: true,
            action: "dependency_created",
            blockerCard: { id: resolvedBlocker.id, title: resolvedBlocker.title },
            blockedCard: { id: resolvedBlocked.id, title: resolvedBlocked.title },
            message: `Liên kết phụ thuộc giữa thẻ "${resolvedBlocker.title}" và thẻ "${resolvedBlocked.title}" đã tồn tại từ trước.`,
          };
        }

        // Kiểm tra chu trình phụ thuộc (Cycle check bằng BFS)
        const dependencies = await db.cardDependency.findMany({
          where: {
            blockerCard: {
              list: { boardId },
            },
          },
          select: {
            blockerCardId: true,
            blockedCardId: true,
          },
        });

        const blockedCardsByBlockerId = new Map<string, string[]>();
        for (const dep of dependencies) {
          const list = blockedCardsByBlockerId.get(dep.blockerCardId) ?? [];
          list.push(dep.blockedCardId);
          blockedCardsByBlockerId.set(dep.blockerCardId, list);
        }

        const queue = [resolvedBlocked.id];
        const visited = new Set<string>(queue);
        let createsCycle = false;

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (current === resolvedBlocker.id) {
            createsCycle = true;
            break;
          }
          const nexts = blockedCardsByBlockerId.get(current) ?? [];
          for (const next of nexts) {
            if (!visited.has(next)) {
              visited.add(next);
              queue.push(next);
            }
          }
        }

        if (createsCycle) {
          return {
            ok: false,
            error: `Không thể tạo phụ thuộc vì sẽ gây vòng lặp luồng: thẻ "${resolvedBlocker.title}" đã trực tiếp hoặc gián tiếp phụ thuộc vào thẻ "${resolvedBlocked.title}".`,
          };
        }

        const dependency = await db.cardDependency.create({
          data: {
            blockerCardId: resolvedBlocker.id,
            blockedCardId: resolvedBlocked.id,
          },
        });

        await createAuditLog({
          entityId: dependency.id,
          entityType: ENTITY_TYPE.CARD,
          entityTitle: `detail:Trợ lý AI đã thiết lập liên kết phụ thuộc: thẻ [card:${resolvedBlocked.id}|${resolvedBlocked.title}] phụ thuộc vào thẻ [card:${resolvedBlocker.id}|${resolvedBlocker.title}]`,
          action: ACTION.UPDATE,
          eventType: AUDIT_EVENT_TYPE.DEPENDENCY,
          boardId,
          cardId: resolvedBlocked.id,
        });

        triggerRelatedDependencyCardsUpdated({
          boardId,
          sourceCardId: resolvedBlocker.id,
          relatedCardIds: [resolvedBlocker.id, resolvedBlocked.id],
          actorUserId: session.userId,
        }).catch((error) => logger.warn("assistant:triggerRelatedDependencyCardsUpdated", { error }));

        return {
          ok: true,
          action: "dependency_created",
          blockerCard: { id: resolvedBlocker.id, title: resolvedBlocker.title },
          blockedCard: { id: resolvedBlocked.id, title: resolvedBlocked.title },
          message: `Đã thiết lập liên kết phụ thuộc thành công: thẻ "${resolvedBlocked.title}" phụ thuộc vào thẻ "${resolvedBlocker.title}" (cần hoàn thành "${resolvedBlocker.title}" trước). Bạn có thể xem liên kết này trên chế độ Bảng, Tiến độ hoặc Sơ đồ phụ thuộc.`,
        };
      },
    }),

    /**
     * Công cụ: deleteCardDependency
     * Mục đích: Gỡ bỏ quan hệ phụ thuộc giữa 2 thẻ công việc trên bảng.
     */
    deleteCardDependency: tool({
      description:
        "Gỡ bỏ hoặc xóa quan hệ phụ thuộc giữa 2 thẻ công việc trên bảng. Có thể truyền ID hoặc Tên thẻ.",
      inputSchema: z.object({
        blockerCard: z.string().min(1).describe("ID hoặc Tên của thẻ chặn (tiền đề)"),
        blockedCard: z.string().min(1).describe("ID hoặc Tên của thẻ bị chặn (phụ thuộc)"),
      }),
      execute: async ({ blockerCard, blockedCard }): Promise<AssistantMutationOutput> => {
        const permissionError = await ensureEditor();

        if (permissionError) {
          return { ok: false, error: permissionError };
        }

        const resolveCard = async (query: string) => {
          const q = query.trim();
          let card = await db.card.findFirst({
            where: { id: q, list: { boardId }, archivedAt: null },
            select: { id: true, title: true },
          });
          if (card) return card;

          card = await db.card.findFirst({
            where: {
              title: { equals: q },
              list: { boardId },
              archivedAt: null,
            },
            select: { id: true, title: true },
          });
          if (card) return card;

          card = await db.card.findFirst({
            where: {
              title: { contains: q },
              list: { boardId },
              archivedAt: null,
            },
            select: { id: true, title: true },
          });
          return card;
        };

        const [resolvedBlocker, resolvedBlocked] = await Promise.all([
          resolveCard(blockerCard),
          resolveCard(blockedCard),
        ]);

        if (!resolvedBlocker || !resolvedBlocked) {
          return {
            ok: false,
            error: "Không tìm thấy thẻ phù hợp trên bảng để gỡ bỏ liên kết phụ thuộc.",
          };
        }

        const deleted = await db.cardDependency.deleteMany({
          where: {
            blockerCardId: resolvedBlocker.id,
            blockedCardId: resolvedBlocked.id,
          },
        });

        if (deleted.count === 0) {
          return {
            ok: false,
            error: `Không tìm thấy liên kết phụ thuộc nào giữa thẻ "${resolvedBlocker.title}" và thẻ "${resolvedBlocked.title}".`,
          };
        }

        await createAuditLog({
          entityId: resolvedBlocked.id,
          entityType: ENTITY_TYPE.CARD,
          entityTitle: `detail:Trợ lý AI đã gỡ bỏ liên kết phụ thuộc giữa thẻ [card:${resolvedBlocked.id}|${resolvedBlocked.title}] và thẻ [card:${resolvedBlocker.id}|${resolvedBlocker.title}]`,
          action: ACTION.UPDATE,
          eventType: AUDIT_EVENT_TYPE.DEPENDENCY,
          boardId,
          cardId: resolvedBlocked.id,
        });

        triggerRelatedDependencyCardsUpdated({
          boardId,
          sourceCardId: resolvedBlocker.id,
          relatedCardIds: [resolvedBlocker.id, resolvedBlocked.id],
          actorUserId: session.userId,
        }).catch((error) => logger.warn("assistant:triggerRelatedDependencyCardsUpdated", { error }));

        return {
          ok: true,
          action: "dependency_deleted",
          blockerCard: { id: resolvedBlocker.id, title: resolvedBlocker.title },
          blockedCard: { id: resolvedBlocked.id, title: resolvedBlocked.title },
          message: `Đã gỡ bỏ thành công liên kết phụ thuộc giữa thẻ "${resolvedBlocker.title}" và thẻ "${resolvedBlocked.title}".`,
        };
      },
    }),
  };
};
