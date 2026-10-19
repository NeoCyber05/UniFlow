import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";
import { BoardMemberRole } from "@/types";
import "server-only";

import { db } from "@/lib/db";

import { ASSISTANT_LIMITS } from "./config";
import type { AssistantContext } from "./context";
import type { AiOperation } from "./policy";
import { formatZonedDateTime } from "./time";

/**
 * Thông tin ngữ cảnh phiên làm việc của người dùng đang tương tác với Trợ lý AI Agent.
 */
export type AssistantSession = {
  /** Định danh duy nhất (UUID) của bảng làm việc hiện tại */
  boardId: string;
  /** Định danh người dùng gửi yêu cầu chat */
  userId: string;
  /** Định danh thành viên bảng (tùy chọn / legacy) */
  boardMemberId?: string;
  /** Vai trò quyền hạn của người dùng trên bảng (ADMIN, MEMBER, hoặc VIEWER) */
  role: BoardMemberRole;
  /** Chuỗi định danh múi giờ IANA của client (ví dụ: "Asia/Ho_Chi_Minh") */
  timeZone: string;
  /** Ngữ cảnh đã kiểm quyền, chụp lại lúc gửi request. */
  context?: AssistantContext;
  /** Operation do thao tác UI/lệnh xác định; thiếu = hỏi đáp/đề xuất. */
  operation?: AiOperation;
};

/**
 * Cấu trúc dữ liệu thẻ công việc được làm phẳng và chuẩn hóa dành riêng cho Trợ lý Agent.
 */
export type AssistantCard = {
  /** ID duy nhất của thẻ */
  id: string;
  /** Tiêu đề công việc/deadline */
  title: string;
  /** ID của danh sách/cột chứa thẻ */
  listId: string;
  /** Tên danh sách/cột chứa thẻ (ví dụ: "Cần làm", "Đang làm") */
  listTitle: string;
  /** Tên môn học hoặc mã học phần kèm tên môn (null nếu là thẻ cá nhân) */
  course: string | null;
  /** Ngày giờ bắt đầu thực hiện (nếu có) */
  startDate: Date | null;
  /** Hạn chót hoàn thành công việc (nếu có) */
  dueDate: Date | null;
  /** Trạng thái đã hoàn thành hay chưa */
  isCompleted: boolean;
  /** Danh sách thành viên được phân công chịu trách nhiệm thẻ */
  assignees: { boardMemberId: string; userId: string; name: string }[];
  /** Danh sách nhãn nhãn dán (labels) được gắn vào thẻ */
  labels: string[];
  /** Thống kê tiến độ công việc con: số việc đã xong và tổng số việc con */
  checklist: { done: number; total: number };
};

/**
 * Tải toàn bộ ảnh chụp (snapshot) dữ liệu của một bảng làm việc từ cơ sở dữ liệu
 * nhằm cung cấp ngữ cảnh đầy đủ cho Trợ lý AI Agent.
 *
 * @remarks
 * Hàm thực hiện truy vấn quan hệ sâu qua Prisma:
 * - Thông tin bảng: tiêu đề, loại bảng (`boardType`), học kỳ (`semester`).
 * - Danh mục môn học (`courses`): mã môn, tên môn, số tín chỉ.
 * - Danh sách thành viên bảng (`members`): tên, quyền hạn (`role`).
 * - Danh sách cột (`lists`) và các thẻ (`cards`) còn hiệu lực (chưa bị xóa/lưu trữ).
 * - Tiến độ checklist con của từng thẻ.
 *
 * @param boardId - Định danh bảng làm việc cần tải dữ liệu (UUID).
 * @returns Đối tượng ảnh chụp bảng gồm thông tin chung, danh sách cột, thành viên và mảng thẻ đã làm phẳng;
 *          trả về `null` nếu không tìm thấy bảng trong cơ sở dữ liệu.
 */
export const loadBoardSnapshot = async (boardId: string) => {
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      title: true,
      boardType: true,
      courses: {
        select: { id: true, name: true, code: true, credits: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      semester: { select: { title: true, startDate: true, endDate: true } },
      lists: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          cards: {
            where: { archivedAt: null },
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              startDate: true,
              dueDate: true,
              deadlineOn: true,
              isCompleted: true,
              course: { select: { name: true, code: true } },
              labels: { select: { label: { select: { title: true } } } },
              checklists: {
                select: { items: { select: { isCompleted: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!board) {
    return null;
  }

  // Làm phẳng dữ liệu các thẻ từ tất cả các cột thành một danh sách duy nhất để Agent dễ duyệt
  const cards: AssistantCard[] = board.lists.flatMap((list) =>
    list.cards.map((card) => {
      const items = card.checklists.flatMap((checklist) => checklist.items);

      return {
        id: card.id,
        title: card.title,
        listId: list.id,
        listTitle: list.title,
        course: card.course
          ? card.course.code ? `${card.course.code} ${card.course.name}` : card.course.name
          : null,
        startDate: card.startDate,
        // shortcut: hạn chỉ-ngày hiện ra như 23:59 VN cuối ngày hạn, đủ cho lọc/quá hạn; hiển thị giờ chỉ mang tính xấp xỉ
        dueDate: getTaskDeadlineAt({ dueDate: card.dueDate, deadlineOn: card.deadlineOn?.toISOString().slice(0, 10) ?? null }),
        isCompleted: card.isCompleted,
        assignees: [],
        labels: card.labels.map(({ label }) => label.title).filter(Boolean),
        checklist: {
          done: items.filter((item) => item.isCompleted).length,
          total: items.length,
        },
      };
    }),
  );

  return {
    board,
    lists: board.lists.map((list) => ({ id: list.id, title: list.title, cardCount: list.cards.length })),
    members: [] as { id: string; userId: string; userName: string; role: BoardMemberRole }[],
    cards,
  };
};

/**
 * Kiểu dữ liệu ảnh chụp bảng hoàn chỉnh (được suy diễn từ kết quả không null của `loadBoardSnapshot`).
 */
export type BoardSnapshot = NonNullable<Awaited<ReturnType<typeof loadBoardSnapshot>>>;

/**
 * Chuyển đổi dữ liệu thẻ nội bộ (`AssistantCard`) thành cấu trúc hiển thị dạng chuỗi an toàn
 * kèm theo thời gian đã chuyển đổi sang múi giờ địa phương và cờ cảnh báo quá hạn.
 *
 * @param card - Dữ liệu thẻ nội bộ.
 * @param timeZone - Múi giờ IANA của người dùng để định dạng ngày giờ.
 * @param now - Thời điểm hiện tại làm mốc để xác định thẻ có bị quá hạn hay không (mặc định: `new Date()`).
 * @returns Đối tượng thẻ được serialize cho kết quả gọi công cụ (tool output) của Agent.
 */
export const serializeCard = (card: AssistantCard, timeZone: string, now = new Date()) => ({
  id: card.id,
  title: card.title,
  list: card.listTitle,
  course: card.course,
  dueDate: formatZonedDateTime(card.dueDate, timeZone),
  startDate: formatZonedDateTime(card.startDate, timeZone),
  isCompleted: card.isCompleted,
  isOverdue: Boolean(card.dueDate && !card.isCompleted && card.dueDate.getTime() < now.getTime()),
  assignees: card.assignees.map((assignee) => assignee.name),
  labels: card.labels,
  checklist: card.checklist.total > 0 ? `${card.checklist.done}/${card.checklist.total}` : null,
});

/**
 * Tổng hợp ảnh chụp bảng thu gọn (Compact Board Snapshot) dưới dạng văn bản Markdown
 * để nhúng trực tiếp vào System Prompt của Agent trước mỗi lượt hội thoại.
 *
 * @remarks
 * - Các thẻ được sắp xếp ưu tiên: Thẻ chưa xong lên trước; Thẻ có hạn chót gần nhất xếp trên;
 * - Số lượng thẻ nhúng trực tiếp vào prompt bị chặn bởi ngưỡng `ASSISTANT_LIMITS.contextCards`
 *   nhằm tiết kiệm token ngữ cảnh. Nếu số thẻ vượt quá ngưỡng, hệ thống sẽ chèn dòng lưu ý
 *   hướng dẫn Agent sử dụng công cụ tra cứu (`findCards` hoặc `getDeadlines`).
 *
 * @param snapshot - Dữ liệu ảnh chụp bảng từ `loadBoardSnapshot`.
 * @param session - Phiên làm việc của người dùng hiện tại (chứa thông tin vai trò, múi giờ).
 * @param now - Thời điểm hiện tại để tính toán cảnh báo quá hạn.
 * @returns Chuỗi văn bản Markdown chứa toàn bộ thông tin tổng quan và danh sách thẻ của bảng.
 */
export const buildBoardContext = (
  snapshot: BoardSnapshot,
  session: AssistantSession,
  now: Date,
): string => {
  const { board, lists, members, cards } = snapshot;
  const me = members.find((member) => member.userId === session.userId);

  // Sắp xếp: Ưu tiên thẻ chưa xong -> thẻ có hạn chót sớm hơn
  const sortedCards = [...cards].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

  // Giới hạn số lượng thẻ trong context prompt để tối ưu token
  const cardLines = sortedCards.slice(0, ASSISTANT_LIMITS.contextCards).map((card) => {
    const due = card.dueDate ? formatZonedDateTime(card.dueDate, session.timeZone) : "không có hạn";
    const overdue = card.dueDate && !card.isCompleted && card.dueDate < now ? " ⚠️QUÁ HẠN" : "";
    const status = card.isCompleted ? "✅ xong" : "⏳ chưa xong";
    const assignees = card.assignees.length > 0
      ? card.assignees.map((assignee) => assignee.name).join(", ")
      : "chưa giao";
    const checklist = card.checklist.total > 0 ? ` | checklist ${card.checklist.done}/${card.checklist.total}` : "";

    return `- [${card.id}] "${card.title}" | môn: ${card.course ?? "cá nhân"} | cột: ${card.listTitle} | hạn: ${due}${overdue} | ${status} | giao cho: ${assignees}${checklist}`;
  });

  const omitted = cards.length - cardLines.length;

  return [
    `Bảng: "${board.title}"`,
    `Loại bảng: ${board.boardType}`,
    board.semester ? `Học kỳ: ${board.semester.title}` : null,
    board.courses.length > 0
      ? `Môn học: ${board.courses
          .map((course) =>
            `${course.code ? `${course.code} ` : ""}${course.name}${course.credits !== null ? ` (${course.credits} TC)` : ""}`,
          )
          .join("; ")}`
      : null,
    `Người đang chat: ${me?.userName ?? "Người dùng"}`,
    `Các cột (theo thứ tự): ${lists.map((list) => `"${list.title}" [${list.id}]`).join(", ") || "chưa có cột nào"}`,
    "",
    `Thẻ (${cards.length} thẻ, sắp xếp theo hạn chót):`,
    ...(cardLines.length > 0 ? cardLines : ["(bảng chưa có thẻ nào)"]),
    omitted > 0 ? `... còn ${omitted} thẻ khác, dùng công cụ để tra cứu.` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
};
