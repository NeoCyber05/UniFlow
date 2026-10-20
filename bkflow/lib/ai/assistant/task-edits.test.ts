/* eslint-disable @typescript-eslint/no-explicit-any -- Transaction doubles verify receipts without a live database. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { applyAiTaskEdit, undoAiTaskEdit, TaskEditSchema, toTaskEdit, type TaskEditEffects } from "./task-edits";

const T0 = new Date("2026-10-19T03:00:00Z");
const previous = globalThis.prisma;
let state: any;
const effects: TaskEditEffects = {
  card: Object.fromEntries(["triggerCardUpdated", "triggerRelatedDependencyCardsUpdated", "deleteCardReminderNotifications", "syncCardReminder"].map(key => [key, async () => {}])) as any,
  checklist: { triggerChecklistCreated: async () => {}, triggerChecklistDeleted: async () => {} } as any,
};
beforeEach(() => {
  state = { owned: true, failReceipt: false, receipts: [], checklists: [], items: [], raceOnTx: false, raceAfterRead: false, reads: 0, card: {
    id: "c1", title: "Học bài A", description: "Old", descriptionUpdatedAt: T0, updatedAt: T0,
    dueDate: new Date("2026-10-20T10:00:00Z"), deadlineOn: null, scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null,
    startDate: null, reminder: null, reminderSetAt: null, isCompleted: false, list: { boardId: "b1" },
  } };
  const database: any = {
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    board: { findFirst: async () => state.owned ? { id: "b1", userId: "u1", title: "B" } : null },
    card: {
      findFirst: async () => {
        const card = state.owned ? structuredClone(state.card) : null;
        if (++state.reads === 2 && state.raceAfterRead) state.card.updatedAt = new Date(+state.card.updatedAt + 500);
        return card;
      },
      findFirstOrThrow: async () => structuredClone(state.card),
      updateMany: async ({ where, data }: any) => {
        if (!state.owned || ["updatedAt", "descriptionUpdatedAt"].some(key => where[key] && +where[key] !== +state.card[key])) return { count: 0 };
        state.card = { ...state.card, ...data, updatedAt: data.updatedAt ?? new Date(+state.card.updatedAt + 1000) };
        return { count: 1 };
      },
    },
    checklist: {
      findFirst: async () => state.checklists.at(-1) ?? null,
      create: async ({ data }: any) => { const row = { ...data, id: "cl1", updatedAt: T0, orderVersion: 0 }; state.checklists.push(row); return row; },
      update: async () => { state.checklists[0].orderVersion++; return state.checklists[0]; },
      findUniqueOrThrow: async () => state.checklists[0],
      deleteMany: async ({ where }: any) => {
        const row = state.checklists[0];
        if (!row || row.orderVersion !== where.orderVersion || +row.updatedAt !== +where.updatedAt) return { count: 0 };
        state.checklists = []; return { count: 1 };
      },
    },
    checklistItem: {
      findFirst: async () => state.items.at(-1) ?? null,
      create: async ({ data }: any) => { const row = { ...data, id: `i${state.items.length}`, updatedAt: T0 }; state.items.push(row); return row; },
      count: async () => state.items.length,
      deleteMany: async ({ where }: any) => {
        const index = state.items.findIndex((row: any) => row.id === where.id && +row.updatedAt === +where.updatedAt);
        if (index < 0) return { count: 0 }; state.items.splice(index, 1); return { count: 1 };
      },
    },
    aiTaskEdit: {
      findFirst: async ({ where }: any) => structuredClone(state.receipts.find((r: any) => Object.entries(where).every(([k,v]) => r[k] === v)) ?? null),
      findFirstOrThrow: async ({ where }: any) => structuredClone(state.receipts.find((r: any) => r.id === where.id)),
      create: async ({ data }: any) => {
        if (state.failReceipt) throw new Error("receipt failed");
        const row = { id: "e1", ...data, createdAt: T0, undoneAt: null };
        state.receipts.push(row); return structuredClone(row);
      },
      updateMany: async ({ where, data }: any) => {
        const row = state.receipts.find((r: any) => r.id === where.id && r.userId === where.userId && r.undoneAt === null);
        if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 };
      },
    },
    $transaction: async (fn: any) => {
      if (state.raceOnTx) { state.card.updatedAt = new Date(+state.card.updatedAt + 500); state.raceOnTx = false; }
      const before = structuredClone(state);
      try { return await fn(database); } catch (error) { state = before; throw error; }
    },
  };
  globalThis.prisma = database as PrismaClient;
});
afterEach(() => { globalThis.prisma = previous; });
const input = () => ({ userId: "u1", requestId: "cf00d53b-21ac-45e8-b37a-c7a98ef036ab", cardId: "c1", expectedUpdatedAt: T0.toISOString(), operation: "set_schedule" as const,
  payload: { scheduledOn: "2026-10-20", scheduledStartAt: null, scheduledEndAt: null } });

test("schedule changes leave deadline intact, replay once and undo after reload", async () => {
  const result = await applyAiTaskEdit(input(), effects);
  assert.equal(state.card.scheduledOn.toISOString().slice(0, 10), "2026-10-20");
  assert.equal(state.card.dueDate.toISOString(), "2026-10-20T10:00:00.000Z");
  assert.equal((await applyAiTaskEdit(input(), effects)).replayed, true);
  assert.equal(state.receipts.length, 1);
  await undoAiTaskEdit({ userId: "u1", editId: result.edit!.id }, effects);
  assert.equal(state.card.scheduledOn, null);
  assert.equal((await undoAiTaskEdit({ userId: "u1", editId: result.edit!.id }, effects)).alreadyUndone, true);
});
test("receipt write failure rolls back card mutation", async () => {
  state.failReceipt = true;
  await assert.rejects(applyAiTaskEdit(input(), effects));
  assert.equal(state.card.scheduledOn, null); assert.equal(state.receipts.length, 0);
});
test("replay does not bypass revoked task permission", async () => {
  await applyAiTaskEdit(input(), effects); state.owned = false;
  await assert.rejects(applyAiTaskEdit(input(), effects), /quyền/);
});
test("a later card revision blocks undo even if another field was edited", async () => {
  const result = await applyAiTaskEdit(input(), effects);
  state.card.title = "Manual"; state.card.updatedAt = new Date(+state.card.updatedAt + 1000);
  await assert.rejects(undoAiTaskEdit({ userId: "u1", editId: result.edit!.id }, effects), /chỉnh sửa mới/);
  assert.equal(state.card.title, "Manual");
});
test("request id cannot be reused with another payload", async () => {
  await applyAiTaskEdit(input(), effects);
  await assert.rejects(applyAiTaskEdit({ ...input(), payload: { ...input().payload, scheduledOn: "2026-10-21" } }, effects), /yêu cầu/);
});
test("task output is finite and schedule never becomes a deadline", () => {
  assert.equal(TaskEditSchema.safeParse({ operation: "javascript", payload: {} }).success, false);
  assert.equal(toTaskEdit("updateCardDeadline", { scheduledOn: "2026-10-20" })?.operation, "set_schedule");
  assert.equal(toTaskEdit("updateCardDeadline", { dueDate: "invalid" }), null);
});

test("deleting task content requires explicit confirmation even via the apply endpoint", async () => {
  state.card.description = "Important content to preserve. ".repeat(20);
  await assert.rejects(applyAiTaskEdit({ ...input(), operation: "edit_task_content", payload: { description: "" } }, effects), /xác nhận/);
  assert.equal(state.receipts.length, 0);
  const confirmed = await applyAiTaskEdit({ ...input(), operation: "edit_task_content", payload: { description: "" }, confirmed: true }, effects);
  assert.ok(confirmed.edit); assert.equal(state.card.description, "");
});

const checklistInput = () => ({ ...input(), operation: "add_checklist" as const, payload: { title: "Các bước", items: ["Đọc", "Ghi chú"] } });
test("checklist receipt and children are atomic, replayable and undoable", async () => {
  const edit = await applyAiTaskEdit(checklistInput(), effects);
  assert.equal(state.items.length, 2);
  await applyAiTaskEdit(checklistInput(), effects); assert.equal(state.items.length, 2);
  await undoAiTaskEdit({ userId: "u1", editId: edit.edit!.id }, effects);
  assert.equal(state.items.length, 0); assert.equal(state.checklists.length, 0);
});
test("checklist manual child edit prevents destructive undo", async () => {
  const edit = await applyAiTaskEdit(checklistInput(), effects);
  state.items[1].updatedAt = new Date(+T0 + 1000);
  await assert.rejects(undoAiTaskEdit({ userId: "u1", editId: edit.edit!.id }, effects), /chỉnh sửa mới/);
  assert.equal(state.items.length, 2);
});
test("checklist creation CAS rejects a parent changed after its in-transaction read", async () => {
  state.raceAfterRead = true;
  await assert.rejects(applyAiTaskEdit(checklistInput(), effects), /Thẻ đã thay đổi/);
  assert.equal(state.items.length, 0); assert.equal(state.receipts.length, 0);
});
test("checklist undo rechecks parent revision inside the transaction", async () => {
  const edit = await applyAiTaskEdit(checklistInput(), effects);
  state.raceOnTx = true;
  await assert.rejects(undoAiTaskEdit({ userId: "u1", editId: edit.edit!.id }, effects), /Thẻ đã thay đổi|chỉnh sửa mới/);
  assert.equal(state.items.length, 2);
});
