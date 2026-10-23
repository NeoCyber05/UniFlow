import { Prisma } from "@prisma/client";
import { z } from "zod";

import { CreateSmartCaptureCards } from "@/actions/cards/create-smart-capture-card/schema";
import { CAPTURE_ALREADY_PROCESSED, CAPTURE_REJECTED } from "@/lib/cards/capture-error-codes";
import { validateReminderConfig } from "@/lib/cards/card-date-rules";
import type { TaskDeadline, TaskSchedule } from "@/lib/cards/task-schedule";
import { serializeTaskDates, toTaskDeadlineStorage, toTaskScheduleStorage } from "@/lib/cards/task-schedule-storage";
import { db } from "@/lib/db";
import { syncCardReminder } from "@/lib/notifications/reminder-deliveries";
import type { CardWithAssignees } from "@/types";

type Database = typeof db;
type Client = Database | Prisma.TransactionClient;

export type CapturedCardDrafts = z.input<typeof CreateSmartCaptureCards>["drafts"];

export { CAPTURE_ALREADY_PROCESSED, CAPTURE_REJECTED };

export class CapturedCardsError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

const GENERIC_ERROR = "Không thể tạo thẻ với mã này. Vui lòng thử lại.";
const ALREADY_PROCESSED = "Yêu cầu này đã được xử lý trước đó. Vui lòng gửi lại như một yêu cầu mới.";

const normalizeChecklistItems = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const title = item.replace(/\s+/g, " ").trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    result.push(title);
  }
  return result;
};

const normalizeDueDate = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const CARD_INCLUDE = {
  list: { select: { boardId: true, board: { select: { userId: true } } } },
  userStates: { select: { userId: true, isImportant: true, myDayAt: true } },
  labels: { include: { label: true }, orderBy: { createdAt: "asc" } },
  checklists: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.CardInclude;

type LoadedCard = Prisma.CardGetPayload<{ include: typeof CARD_INCLUDE }>;

const loadCards = (client: Client, ids: string[]) =>
  client.card.findMany({ where: { id: { in: ids } }, include: CARD_INCLUDE });

const toCardWithAssignees = ({ list: _list, userStates: _userStates, ...card }: LoadedCard): CardWithAssignees => {
  const items = card.checklists.flatMap((checklist) => checklist.items);
  return {
    ...card,
    checklists: card.checklists.map((checklist) => ({
      items: checklist.items.map((item) => ({ isCompleted: item.isCompleted })),
    })),
    assignees: [],
    checklistProgress: { total: items.length, completed: items.filter((i) => i.isCompleted).length },
    unresolvedBlockerCount: 0,
  } as unknown as CardWithAssignees;
};

type NormalizedDraft = ReturnType<typeof normalizeDrafts>[number];

const normalizeDrafts = (
  drafts: z.output<typeof CreateSmartCaptureCards>["drafts"],
  valid: { labels: Set<string>; courses: Set<string> },
) =>
  drafts.map((draft) => {
    const labelIds = Array.from(new Set(draft.labelIds));
    // Course/label sai quyền hoặc đã xóa là lỗi, không âm thầm bỏ rồi báo thành công.
    if (labelIds.some((id) => !valid.labels.has(id))) {
      throw new CapturedCardsError("Không tìm thấy một hoặc nhiều nhãn.");
    }
    if (draft.courseId && !valid.courses.has(draft.courseId)) {
      throw new CapturedCardsError("Danh mục không hợp lệ.");
    }
    const dueDateValue = normalizeDueDate(draft.dueDate);
    const deadline: TaskDeadline = {
      dueDate: dueDateValue?.toISOString() ?? null,
      deadlineOn: dueDateValue ? null : draft.deadlineOn ?? null,
    };
    const schedule: TaskSchedule = {
      scheduledOn: draft.scheduledOn ?? null,
      scheduledStartAt: draft.scheduledStartAt ? new Date(draft.scheduledStartAt).toISOString() : null,
      scheduledEndAt: draft.scheduledEndAt ? new Date(draft.scheduledEndAt).toISOString() : null,
    };
    const hasDeadline = Boolean(deadline.dueDate || deadline.deadlineOn);
    return {
      ...draft,
      myDay: Boolean(draft.myDay),
      dueDateValue,
      deadline,
      schedule,
      reminder: hasDeadline && draft.reminder && draft.reminder !== "none" ? draft.reminder : null,
      // Kỳ sau tính từ hạn nộp, không có hạn thì không lặp
      repeat: hasDeadline ? draft.repeat ?? null : null,
      checklistItems: normalizeChecklistItems(draft.checklistItems),
      labelIds,
      courseId: draft.courseId ?? null,
    };
  });

const sameContent = (card: LoadedCard, draft: NormalizedDraft, userId: string) => {
  const titles = card.checklists.flatMap((checklist) => checklist.items.map((i) => i.title));
  const labelIds = card.labels.map((l) => l.labelId).sort();
  const state = card.userStates.find((s) => s.userId === userId);
  return (
    card.title === draft.title &&
    (card.description ?? "") === draft.description &&
    card.listId === draft.listId &&
    (card.courseId ?? null) === draft.courseId &&
    JSON.stringify(serializeTaskDates(card)) === JSON.stringify({ ...draft.deadline, ...draft.schedule }) &&
    (card.reminder ?? null) === draft.reminder &&
    (card.repeatUnit ?? null) === (draft.repeat?.unit ?? null) &&
    Boolean(state?.isImportant) === draft.isImportant &&
    Boolean(state?.myDayAt) === draft.myDay &&
    labelIds.join() === [...draft.labelIds].sort().join() &&
    titles.join("\n") === draft.checklistItems.join("\n")
  );
};

/**
 * Replay check. Returns the existing cards when every creationId already exists in this
 * user/board scope with the same content, null when none exist, and throws otherwise.
 * Foreign or partial ids give a generic error so nothing about other users' cards leaks.
 */
const findReplay = async (
  client: Client,
  scope: { userId: string; boardId: string },
  drafts: NormalizedDraft[],
) => {
  const existing = await loadCards(client, drafts.map((d) => d.creationId));
  if (existing.length === 0) return null;
  const inScope = existing.every(
    (c) => c.list.boardId === scope.boardId && c.list.board.userId === scope.userId,
  );
  if (!inScope || existing.length !== drafts.length) throw new CapturedCardsError(GENERIC_ERROR);
  const byId = new Map(existing.map((c) => [c.id, c]));
  const ordered = drafts.map((d) => byId.get(d.creationId)!);
  if (!ordered.every((card, i) => sameContent(card, drafts[i], scope.userId))) {
    throw new CapturedCardsError(ALREADY_PROCESSED, CAPTURE_ALREADY_PROCESSED);
  }
  return ordered.map(toCardWithAssignees);
};

const isUniqueConflict = (error: unknown) =>
  (error as { code?: string } | null)?.code === "P2002";

/**
 * Atomically creates cards (+labels, +checklist todos, +reminder deliveries) for a board.
 * Idempotent per creationId: a retry with identical content replays, changed content conflicts.
 * The caller does the editor permission check and realtime; `createdIds` tells it which
 * cards are new (not replayed).
 */
export const createCapturedCardsWithStatus = async (
  input: { userId: string; boardId: string; drafts: CapturedCardDrafts },
  database: Database = db,
): Promise<{ cards: CardWithAssignees[]; createdIds: Set<string> }> => {
  const parsed = CreateSmartCaptureCards.safeParse({ boardId: input.boardId, drafts: input.drafts });
  if (!parsed.success) {
    throw new CapturedCardsError(parsed.error.issues[0]?.message ?? "Dữ liệu thẻ không hợp lệ.");
  }
  const { userId } = input;
  const { boardId, drafts } = parsed.data;
  const scope = { userId, boardId };

  const requestedListIds = Array.from(new Set(drafts.map((d) => d.listId)));
  const requestedLabelIds = Array.from(new Set(drafts.flatMap((d) => d.labelIds)));
  const requestedCourseIds = Array.from(
    new Set(drafts.flatMap((d) => (d.courseId ? [d.courseId] : []))),
  );

  const [lists, labels, courses] = await Promise.all([
    database.list.findMany({
      where: { id: { in: requestedListIds }, archivedAt: null, board: { id: boardId, userId } },
      select: { id: true },
    }),
    requestedLabelIds.length > 0
      ? database.label.findMany({
          where: { id: { in: requestedLabelIds }, boardId, board: { userId } },
          select: { id: true },
        })
      : [],
    requestedCourseIds.length > 0
      ? database.course.findMany({
          where: { id: { in: requestedCourseIds }, boardId, board: { userId } },
          select: { id: true },
        })
      : [],
  ]);

  const listIds = new Set(lists.map((l) => l.id));
  if (requestedListIds.some((id) => !listIds.has(id))) {
    throw new CapturedCardsError("Không tìm thấy một hoặc nhiều danh sách.");
  }

  const normalized = normalizeDrafts(drafts, {
    labels: new Set(labels.map((l) => l.id)),
    courses: new Set(courses.map((c) => c.id)),
  });

  const replayed = await findReplay(database, scope, normalized);
  if (replayed) return { cards: replayed, createdIds: new Set() };

  // Sau replay: retry của bản đã lưu không được hỏng chỉ vì mốc nhắc giờ đã qua.
  for (const draft of normalized) {
    const reminderError = validateReminderConfig({
      dueDate: draft.dueDateValue,
      deadlineOn: draft.deadline.deadlineOn,
      reminder: draft.reminder,
    });
    if (reminderError) throw new CapturedCardsError(reminderError);
  }
  const now = new Date();

  try {
    const cards = await database.$transaction(
      async (tx) => {
        const cursor = new Map<string, number>();
        for (const listId of requestedListIds) {
          const last = await tx.card.findFirst({
            where: { listId, archivedAt: null },
            orderBy: { order: "desc" },
            select: { order: true },
          });
          cursor.set(listId, last ? last.order : 0);
        }

        for (const draft of normalized) {
          const order = (cursor.get(draft.listId) ?? 0) + 1;
          cursor.set(draft.listId, order);

          await tx.card.create({
            data: {
              id: draft.creationId,
              title: draft.title,
              description: draft.description,
              listId: draft.listId,
              order,
              courseId: draft.courseId,
              ...toTaskDeadlineStorage(draft.deadline),
              ...toTaskScheduleStorage(draft.schedule),
              ...(draft.reminder ? { reminder: draft.reminder, reminderSetAt: now } : {}),
              ...(draft.repeat ? { repeatUnit: draft.repeat.unit, repeatEvery: draft.repeat.every } : {}),
              ...(draft.isImportant || draft.myDay
                ? { userStates: { create: { userId, isImportant: draft.isImportant, myDayAt: draft.myDay ? now : null } } }
                : {}),
            },
          });

          if (draft.labelIds.length > 0) {
            await tx.cardLabel.createMany({
              data: draft.labelIds.map((labelId) => ({ cardId: draft.creationId, labelId })),
              skipDuplicates: true,
            });
          }

          if (draft.checklistItems.length > 0) {
            const checklist = await tx.checklist.create({
              data: { cardId: draft.creationId, title: "Việc cần làm", order: 0 },
            });
            await tx.checklistItem.createMany({
              data: draft.checklistItems.map((title, index) => ({
                checklistId: checklist.id,
                title,
                order: index,
                isCompleted: false,
              })),
            });
          }

          if (draft.reminder) {
            await syncCardReminder(tx, { cardId: draft.creationId, now });
          }
        }

        const created = await loadCards(tx, normalized.map((d) => d.creationId));
        const byId = new Map(created.map((c) => [c.id, c]));
        return normalized.map((d) => toCardWithAssignees(byId.get(d.creationId)!));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    return { cards, createdIds: new Set(cards.map((c) => c.id)) };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    // A concurrent request with the same creationId won the primary key: replay its result,
    // but only if complete, in scope and identical; never report a partial batch.
    const winner = await findReplay(database, scope, normalized);
    if (!winner) throw new CapturedCardsError(GENERIC_ERROR);
    return { cards: winner, createdIds: new Set() };
  }
};

export const createCapturedCards = async (
  input: { userId: string; boardId: string; drafts: CapturedCardDrafts },
  database: Database = db,
) => (await createCapturedCardsWithStatus(input, database)).cards;
