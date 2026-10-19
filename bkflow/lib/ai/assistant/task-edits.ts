import "server-only";

import { createHash } from "node:crypto";
import { Prisma, type Card } from "@prisma/client";
import { z } from "zod";

import { triggerChecklistCreated, triggerChecklistDeleted } from "@/lib/boards/realtime";
import {
  CARD_CONFLICT_ERROR_CODE,
  DESCRIPTION_CONFLICT_ERROR_CODE,
  updateCardService,
  type CardUpdateEffects,
} from "@/lib/cards/card-update-service";
import { TaskDeadlineSchema, TaskScheduleSchema } from "@/lib/cards/task-schedule";
import { serializeTaskDates } from "@/lib/cards/task-schedule-storage";
import type { UpdateCardInput } from "@/lib/cards/update-card-contract";
import { createChecklistWithItems } from "@/lib/checklists/checklist-mutations";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireBoardEditor } from "@/lib/permissions";
import { requiresContentConfirmation } from "./content-confirmation";

/** The only task operations AI may write; a multi-task change is a list of these, one request per task. */
export const TaskEditSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("edit_task_content"), payload: z.strictObject({ description: z.string().max(5000) }) }),
  z.object({
    operation: z.literal("add_checklist"),
    payload: z.strictObject({
      title: z.string().trim().min(1).max(100),
      items: z.array(z.string().trim().min(1).max(250)).min(1).max(20),
    }),
  }),
  // Explicit desired state (whole schedule block / whole deadline), never a toggle or relative change.
  z.object({ operation: z.literal("set_schedule"), payload: TaskScheduleSchema }),
  z.object({ operation: z.literal("set_deadline"), payload: TaskDeadlineSchema }),
]);
export type TaskEdit = z.infer<typeof TaskEditSchema>;
type TaskEditOperation = TaskEdit["operation"];
type CardFieldOperation = Exclude<TaskEditOperation, "add_checklist">;

export const AiTaskEditRequest = TaskEditSchema.and(z.object({
  requestId: z.string().uuid(),
  cardId: z.string().min(1).max(100),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  confirmed: z.boolean().optional(),
}));
export type AiTaskEditInput = z.infer<typeof AiTaskEditRequest> & { userId: string };

const Iso = z.string();
// before/after snapshots: exactly the fields an operation owns, plus the revisions undo must re-check.
const Snapshots = {
  edit_task_content: z.object({ description: z.string().nullable(), descriptionUpdatedAt: Iso }),
  set_schedule: z.object({ scheduledOn: Iso.nullable(), scheduledStartAt: Iso.nullable(), scheduledEndAt: Iso.nullable() }),
  set_deadline: z.object({ dueDate: Iso.nullable(), deadlineOn: Iso.nullable() }),
  add_checklist: z.object({
    checklistId: z.string(), checklistUpdatedAt: Iso, orderVersion: z.number(),
    items: z.array(z.object({ id: z.string(), updatedAt: Iso })),
  }),
};

export type TaskEditTarget = Pick<Card, "id" | "title" | "updatedAt" | "description" | "descriptionUpdatedAt" |
  "dueDate" | "deadlineOn" | "scheduledOn" | "scheduledStartAt" | "scheduledEndAt">;

const cardSnapshot = (operation: CardFieldOperation, card: Omit<TaskEditTarget, "id" | "title" | "updatedAt">) => {
  if (operation === "edit_task_content") {
    return { description: card.description, descriptionUpdatedAt: card.descriptionUpdatedAt.toISOString() };
  }
  const { dueDate, deadlineOn, scheduledOn, scheduledStartAt, scheduledEndAt } = serializeTaskDates(card);
  return operation === "set_schedule" ? { scheduledOn, scheduledStartAt, scheduledEndAt } : { dueDate, deadlineOn };
};

/** Current values shown as "before" in a preview; null for add_checklist (nothing is replaced). */
export const taskEditBefore = (operation: TaskEditOperation, card: TaskEditTarget) =>
  operation === "add_checklist" ? null : cardSnapshot(operation, card);

/** Turns a mutation tool call into a task edit, or null when it is outside the supported operations. */
export const toTaskEdit = (tool: string, input: Record<string, unknown>): TaskEdit | null => {
  const touched = (keys: string[]) => keys.some((key) => input[key] !== undefined);
  const scheduleKeys = ["scheduledOn", "scheduledStartAt", "scheduledEndAt"];
  const deadlineKeys = ["dueDate", "deadlineOn"];
  let candidate: unknown = null;
  if (tool === "updateCardDetails" && !touched(["title", "courseId"])) {
    candidate = { operation: "edit_task_content", payload: { description: input.description } };
  } else if (tool === "createCardChecklist") {
    candidate = { operation: "add_checklist", payload: { title: input.title, items: input.items } };
  } else if (tool === "updateCardDeadline" && input.isCompleted === undefined) {
    // Missing fields become null: the schedule (or deadline) is replaced as one block, as in the card UI.
    if (touched(scheduleKeys) && !touched(deadlineKeys)) {
      candidate = { operation: "set_schedule", payload: Object.fromEntries(scheduleKeys.map((key) => [key, input[key] ?? null])) };
    } else if (touched(deadlineKeys) && !touched(scheduleKeys)) {
      candidate = { operation: "set_deadline", payload: Object.fromEntries(deadlineKeys.map((key) => [key, input[key] ?? null])) };
    }
  }
  const parsed = candidate ? TaskEditSchema.safeParse(candidate) : null;
  return parsed?.success ? parsed.data : null;
};

export class TaskEditError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const NOT_FOUND = "Không tìm thấy thẻ hoặc bạn không có quyền sửa.";
const STALE = "Thẻ đã thay đổi sau khi AI đề xuất. Thay đổi chưa được áp dụng; hãy tải lại rồi thử lại.";
const UNDO_CONFLICT = "Thẻ đã có chỉnh sửa mới hơn sau thay đổi AI. Bản mới được giữ nguyên nên không thể hoàn tác tự động.";

export type TaskEditEffects = {
  card?: CardUpdateEffects;
  checklist: {
    triggerChecklistCreated: typeof triggerChecklistCreated;
    triggerChecklistDeleted: typeof triggerChecklistDeleted;
  };
};
const defaultEffects: TaskEditEffects = { checklist: { triggerChecklistCreated, triggerChecklistDeleted } };

type Client = Prisma.TransactionClient | typeof db;
const editSelect = { id: true, cardId: true, operation: true, createdAt: true, undoneAt: true } as const;
type EditView = Prisma.AiTaskEditGetPayload<{ select: typeof editSelect }>;

const findOwnedCard = (client: Client, userId: string, cardId: string) => client.card.findFirst({
  where: { id: cardId, archivedAt: null, list: { archivedAt: null, board: { userId } } },
  include: { list: { select: { boardId: true } } },
});

// Updating the guarded parent row takes its lock; a read alone cannot protect checklist child writes.
const claimParentRevision = async (tx: Prisma.TransactionClient, userId: string, cardId: string, expected: Date) => {
  const next = new Date(Math.max(Date.now(), expected.getTime() + 1));
  const result = await tx.card.updateMany({
    where: { id: cardId, updatedAt: expected, archivedAt: null, list: { archivedAt: null, board: { userId } } },
    data: { updatedAt: next },
  });
  if (result.count !== 1) throw new TaskEditError(STALE, 409);
  return next;
};

const fingerprintOf = (input: AiTaskEditInput) => createHash("sha256").update(JSON.stringify([
  input.cardId, input.operation, input.payload, new Date(input.expectedUpdatedAt).toISOString(), Boolean(input.confirmed),
])).digest("hex");

type ReceiptKey = { userId: string; requestId: string; cardId: string; fingerprint: string };

const replayOf = async (client: Client, key: ReceiptKey) => {
  const receipt = await client.aiTaskEdit.findFirst({
    where: { userId: key.userId, requestId: key.requestId },
    select: { ...editSelect, requestFingerprint: true },
  });
  if (!receipt) return null;
  if (receipt.cardId !== key.cardId || receipt.requestFingerprint !== key.fingerprint) {
    throw new TaskEditError("Mã yêu cầu này đã dùng cho một chỉnh sửa khác. Hãy gửi lại yêu cầu mới.", 409);
  }
  const edit = { id: receipt.id, cardId: receipt.cardId, operation: receipt.operation, createdAt: receipt.createdAt, undoneAt: receipt.undoneAt };
  return { edit, replayed: true };
};

const serviceErrorStatus = (errorCode?: string) =>
  errorCode === CARD_CONFLICT_ERROR_CODE || errorCode === DESCRIPTION_CONFLICT_ERROR_CODE ? 409 : 400;

const toCardPatch = (operation: CardFieldOperation, value: Record<string, unknown>): Partial<UpdateCardInput> => {
  if (operation === "edit_task_content") return { description: (value.description as string | null) ?? "" };
  if (operation === "set_schedule") {
    const { scheduledOn, scheduledStartAt, scheduledEndAt } = value as z.infer<typeof Snapshots.set_schedule>;
    return { scheduledOn, scheduledStartAt, scheduledEndAt };
  }
  const { dueDate, deadlineOn } = value as z.infer<typeof Snapshots.set_deadline>;
  return { dueDate: dueDate ? new Date(dueDate) : null, deadlineOn };
};

const runEffect = async (label: string, effect: () => Promise<unknown>) => {
  // Effects run after commit; a failure must not hide that the edit (and its receipt) were saved.
  try { await effect(); } catch (error) { logger.warn(`ai-task-edit:${label}`, { error }); }
};

/**
 * Applies one AI task edit through the shared card/checklist writers, with its receipt in the same
 * transaction. Retrying with the same requestId returns the stored receipt and never writes twice.
 */
export const applyAiTaskEdit = async (input: AiTaskEditInput, effects: TaskEditEffects = defaultEffects) => {
  const { userId, requestId, cardId } = input;
  const card = await findOwnedCard(db, userId, cardId);
  if (!card) throw new TaskEditError(NOT_FOUND, 404);
  const key: ReceiptKey = { userId, requestId, cardId, fingerprint: fingerprintOf(input) };
  const replay = await replayOf(db, key);
  if (replay) return replay;

  const expected = new Date(input.expectedUpdatedAt);
  if (card.updatedAt.getTime() !== expected.getTime()) throw new TaskEditError(STALE, 409);
  if (input.operation === "edit_task_content" && requiresContentConfirmation(card.description, input.payload.description) && !input.confirmed) {
    throw new TaskEditError("Cần xem trước và xác nhận thay đổi lớn trước khi sửa nội dung.", 400);
  }
  const boardId = card.list.boardId;
  const receipt = { userId, cardId, requestId, requestFingerprint: key.fingerprint, operation: input.operation };

  if (input.operation === "add_checklist") {
    const permission = await requireBoardEditor({ boardId, userId });
    if (permission.error) throw new TaskEditError(permission.error, 403);
    const { title, items: titles } = input.payload;
    try {
      const result = await db.$transaction(async (tx) => {
        const again = await replayOf(tx, key);
        if (again) return again;
        // Checklist writes do not bump Card.updatedAt, so the revision is re-checked inside the transaction.
        const current = await findOwnedCard(tx, userId, cardId);
        if (!current || current.updatedAt.getTime() !== expected.getTime()) throw new TaskEditError(STALE, 409);
        const appliedUpdatedAt = await claimParentRevision(tx, userId, cardId, expected);
        const { checklist, items } = await createChecklistWithItems(tx, { cardId, title, titles });
        const after = {
          checklistId: checklist.id, checklistUpdatedAt: checklist.updatedAt.toISOString(), orderVersion: checklist.orderVersion,
          items: items.map((item) => ({ id: item.id, updatedAt: item.updatedAt.toISOString() })),
        };
        const edit = await tx.aiTaskEdit.create({
          data: { ...receipt, before: {}, after, appliedUpdatedAt },
          select: editSelect,
        });
        return { edit, replayed: false, checklistId: checklist.id };
      });
      if ("checklistId" in result) {
        const { checklistId } = result;
        await runEffect("realtime", () => effects.checklist.triggerChecklistCreated({ boardId, cardId, checklistId, actorUserId: userId }));
      }
      return { edit: result.edit, replayed: result.replayed };
    } catch (error) {
      // A concurrent request with the same requestId committed first; unique(userId, requestId) rolled this one back.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await replayOf(db, key);
        if (winner) return winner;
      }
      throw error;
    }
  }

  const operation = input.operation;
  let created = null as EditView | null;
  const result = await updateCardService({
    userId,
    data: {
      id: cardId, boardId, expectedUpdatedAt: input.expectedUpdatedAt,
      ...(operation === "edit_task_content"
        ? { description: input.payload.description, descriptionBaseUpdatedAt: card.descriptionUpdatedAt.toISOString() }
        : toCardPatch(operation, input.payload)),
    },
  }, db, effects.card, async (tx) => {
    const next = await tx.card.findFirstOrThrow({ where: { id: cardId } });
    created = await tx.aiTaskEdit.create({
      data: { ...receipt, before: cardSnapshot(operation, card), after: cardSnapshot(operation, next), appliedUpdatedAt: next.updatedAt },
      select: editSelect,
    });
  });

  if (result.error) {
    // A post-commit effect failed, or a same-requestId request won the unique index: the stored receipt
    // decides, so a committed edit is never reported as failed.
    const stored = await replayOf(db, key);
    if (stored) return { ...stored, replayed: !created };
    throw new TaskEditError(result.error, serviceErrorStatus(result.errorCode));
  }
  if (created) return { edit: created, replayed: false };
  // Payload equals the current state: nothing was written, so there is nothing to undo.
  return { edit: null, replayed: false };
};

/** Reverts one AI edit only while the fields (or checklist items) it wrote are exactly as it left them. */
export const undoAiTaskEdit = async ({ userId, editId }: { userId: string; editId: string }, effects: TaskEditEffects = defaultEffects) => {
  const receipt = await db.aiTaskEdit.findFirst({ where: { id: editId, userId } });
  if (!receipt) throw new TaskEditError("Không tìm thấy thay đổi cần hoàn tác.", 404);
  const card = await findOwnedCard(db, userId, receipt.cardId);
  if (!card) throw new TaskEditError(NOT_FOUND, 404);
  if (receipt.undoneAt) {
    const { id, cardId, operation, createdAt, undoneAt } = receipt;
    return { edit: { id, cardId, operation, createdAt, undoneAt }, alreadyUndone: true };
  }
  if (card.updatedAt.getTime() !== receipt.appliedUpdatedAt.getTime()) throw new TaskEditError(UNDO_CONFLICT, 409);
  const boardId = card.list.boardId;
  const operation = (Object.keys(Snapshots) as TaskEditOperation[]).find((value) => value === receipt.operation);
  if (!operation) throw new TaskEditError("Thay đổi này không hỗ trợ hoàn tác.", 400);

  const markUndone = async (tx: Client) => {
    const { count } = await tx.aiTaskEdit.updateMany({ where: { id: receipt.id, userId, undoneAt: null }, data: { undoneAt: new Date() } });
    if (count !== 1) throw new TaskEditError(UNDO_CONFLICT, 409);
  };
  // Lost a race or an effect failed after commit: a receipt already marked undone means the undo stands.
  const settled = async () => {
    const latest = await db.aiTaskEdit.findFirst({ where: { id: receipt.id, userId }, select: editSelect });
    return latest?.undoneAt ? { edit: latest, alreadyUndone: true } : null;
  };
  const done = async () => ({ edit: await db.aiTaskEdit.findFirstOrThrow({ where: { id: receipt.id }, select: editSelect }), alreadyUndone: false });

  if (operation === "add_checklist") {
    const after = Snapshots.add_checklist.parse(receipt.after);
    const permission = await requireBoardEditor({ boardId, userId });
    if (permission.error) throw new TaskEditError(permission.error, 403);
    try {
      await db.$transaction(async (tx) => {
        await claimParentRevision(tx, userId, card.id, receipt.appliedUpdatedAt);
        // Exact AI item ids at their recorded revisions: item edits do not bump Card.updatedAt.
        for (const item of after.items) {
          const { count } = await tx.checklistItem.deleteMany({ where: { id: item.id, checklistId: after.checklistId, updatedAt: new Date(item.updatedAt) } });
          if (count !== 1) throw new TaskEditError(UNDO_CONFLICT, 409);
        }
        // A manually added or removed item bumps orderVersion; a renamed checklist bumps updatedAt.
        if (await tx.checklistItem.count({ where: { checklistId: after.checklistId } })) throw new TaskEditError(UNDO_CONFLICT, 409);
        const { count } = await tx.checklist.deleteMany({
          where: { id: after.checklistId, cardId: card.id, orderVersion: after.orderVersion, updatedAt: new Date(after.checklistUpdatedAt) },
        });
        if (count !== 1) throw new TaskEditError(UNDO_CONFLICT, 409);
        await markUndone(tx);
      });
    } catch (error) {
      const already = await settled();
      if (already) return already;
      throw error;
    }
    await runEffect("realtime", () => effects.checklist.triggerChecklistDeleted({ boardId, cardId: card.id, checklistId: after.checklistId, actorUserId: userId }));
    return done();
  }

  const before = Snapshots[operation].parse(receipt.before) as Record<string, unknown>;
  const after = Snapshots[operation].parse(receipt.after) as Record<string, unknown>;
  const current = cardSnapshot(operation, card) as Record<string, unknown>;
  // Only the fields this edit owns are compared and restored; unrelated newer edits are kept.
  if (Object.keys(after).some((field) => after[field] !== current[field])) throw new TaskEditError(UNDO_CONFLICT, 409);

  let marked = false;
  const result = await updateCardService({
    userId,
    data: {
      id: card.id, boardId, expectedUpdatedAt: card.updatedAt.toISOString(),
      ...toCardPatch(operation, before),
      ...(operation === "edit_task_content" ? { descriptionBaseUpdatedAt: after.descriptionUpdatedAt as string } : {}),
    },
  }, db, effects.card, async (tx) => { await markUndone(tx); marked = true; });
  if (result.error) {
    const already = await settled();
    if (already) return already;
    const status = serviceErrorStatus(result.errorCode);
    throw new TaskEditError(status === 409 ? UNDO_CONFLICT : result.error, status);
  }
  // Restored value already equals the current one (e.g. empty description): nothing to write, just close the receipt.
  if (!marked) await markUndone(db);
  return done();
};
