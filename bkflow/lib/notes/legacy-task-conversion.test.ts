/* eslint-disable @typescript-eslint/no-explicit-any -- An in-memory database double with transaction rollback stands in for Postgres. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { ensureNoteDeadlineNotifications } from "@/lib/notifications/reminder-notifications";
import { runWithAuth } from "@/server/auth";
import { POST as undoRoute } from "@/server/routes/pages/[pageId]/undo/route";
import { serializeNoteBlocks, type NoteBlock } from "./blocks";
import { extractNoteDeadlines } from "./deadlines";
import { convertLegacyDeadlines, inventoryLegacyDeadlines, LegacyConversionError, previewLegacyConversion, restoreLegacyDeadlines } from "./legacy-task-conversion";

const previousDb = globalThis.prisma;
const rev = new Date("2026-10-19T00:00:00.000Z");
const future = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();
const blocks: NoteBlock[] = [
  { id: "p", type: "paragraph", text: "Ghi chú" },
  { id: "d1", type: "deadline", text: " Nộp báo cáo ", dueAt: future, reminder: "60", checked: false },
  { id: "d2", type: "deadline", text: "Đã xong", dueAt: "2026-09-01T10:00:00.000Z", reminder: "none", checked: true },
  { id: "d3", type: "deadline", text: "Chưa có ngày", dueAt: "", reminder: "none", checked: false },
];
const original = serializeNoteBlocks(blocks);

let state: any;
let failOn: string | null;

const matches = (row: any, where: any = {}): boolean => Object.entries(where).every(([key, value]: [string, any]) => {
  const actual = row[key];
  if (value === undefined) return true;
  if (value === null) return actual == null;
  if (value instanceof Date) return actual instanceof Date && actual.getTime() === value.getTime();
  if (typeof value === "object" && "in" in value) return value.in.includes(actual);
  if (typeof value === "object" && "not" in value) return value.not === null ? actual != null : actual !== value.not;
  return actual === value;
});
const guard = (name: string) => { if (failOn === name) throw new Error(`injected failure at ${name}`); };
const withList = (card: any) => {
  const list = state.lists.find((item: any) => item.id === card.listId);
  return { ...card, list: { archivedAt: list.archivedAt, board: { userId: state.boards.find((board: any) => board.id === list.boardId).userId } } };
};

beforeEach(() => {
  failOn = null;
  state = {
    pages: [{ id: "pg", userId: "u1", title: "Ôn thi", content: original, deletedAt: null, updatedAt: rev }],
    mirror: extractNoteDeadlines(original).map(row => ({ ...row, pageId: "pg", userId: "u1" })),
    maps: [], cards: [], deliveries: [], notifications: [], aiEdits: [],
    boards: [{ id: "b1", userId: "u1" }, { id: "shared", userId: "u2" }],
    lists: [{ id: "l1", boardId: "b1", archivedAt: null }, { id: "ls", boardId: "shared", archivedAt: null }],
  };
  const database: any = {
    course: {}, workspace: {},
    notePage: {
      findFirst: async ({ where }: any) => { const page = state.pages.find((item: any) => matches(item, where)); return page ? { ...page } : null; },
      findUniqueOrThrow: async ({ where }: any) => state.pages.find((page: any) => page.id === where.id),
      updateMany: async ({ where, data }: any) => { const hits = state.pages.filter((page: any) => matches(page, where)); hits.forEach((page: any) => Object.assign(page, data)); return { count: hits.length }; },
    },
    noteDeadline: {
      findMany: async ({ where }: any) => state.mirror.filter((row: any) => matches(row, { pageId: where.pageId, userId: where.userId })).map((row: any) => ({ ...row, page: { title: "Ôn thi" } })),
      deleteMany: async ({ where }: any) => { state.mirror = state.mirror.filter((row: any) => row.pageId !== where.pageId); },
      createMany: async ({ data }: any) => { state.mirror.push(...data); },
    },
    noteDeadlineTaskMap: {
      findMany: async ({ where }: any) => state.maps.filter((row: any) => matches(row, where)),
      create: async ({ data }: any) => { guard("map.create"); state.maps.push({ id: crypto.randomUUID(), ...data }); },
      updateMany: async ({ where, data }: any) => { const hits = state.maps.filter((row: any) => matches(row, where)); hits.forEach((row: any) => Object.assign(row, data)); return { count: hits.length }; },
    },
    board: { findFirst: async ({ where }: any) => state.boards.find((board: any) => board.id === where.id) ?? null },
    list: { findFirst: async ({ where }: any) => state.lists.find((list: any) => matches(list, where)) ?? null },
    card: {
      findFirst: async ({ where }: any) => state.cards.filter((card: any) => matches(card, where)).sort((a: any, b: any) => b.order - a.order)[0] ?? null,
      findUnique: async ({ where }: any) => { const card = state.cards.find((item: any) => item.id === where.id); return card ? withList(card) : null; },
      findMany: async ({ where }: any) => state.cards.filter((card: any) => matches(card, where)).map(withList),
      create: async ({ data }: any) => { guard("card.create"); const card = { archivedAt: null, reminder: null, reminderSetAt: null, reminderGeneration: null, deadlineOn: null, ...data, updatedAt: new Date() }; state.cards.push(card); return card; },
      update: async ({ where, data }: any) => Object.assign(state.cards.find((card: any) => card.id === where.id), data),
      updateMany: async ({ where, data }: any) => { const hits = state.cards.filter((card: any) => matches(card, where)); hits.forEach((card: any) => Object.assign(card, data, { updatedAt: new Date() })); return { count: hits.length }; },
    },
    webPushSubscription: { findMany: async () => [{ id: "sub" }] },
    reminderDelivery: {
      updateMany: async ({ where, data }: any) => { const hits = state.deliveries.filter((row: any) => row.cardId === where.cardId && (!where.status?.in || where.status.in.includes(row.status))); hits.forEach((row: any) => Object.assign(row, data)); return { count: hits.length }; },
      createMany: async ({ data }: any) => { state.deliveries.push(...data.map((row: any) => ({ status: "pending", ...row }))); },
    },
    aiNoteEdit: {
      findFirst: async ({ where }: any) => state.aiEdits.find((edit: any) => edit.id === where.id) ?? null,
      updateMany: async ({ where }: any) => { const edit = state.aiEdits.find((item: any) => item.id === where.id && !item.undoneAt); if (edit) edit.undoneAt = new Date(); return { count: edit ? 1 : 0 }; },
    },
    notification: {
      findFirst: async ({ where }: any) => state.notifications.find((row: any) => row.dedupeKey === where.dedupeKey) ?? null,
      create: async ({ data }: any) => { state.notifications.push(data); return { id: "n", ...data }; },
    },
  };
  // Rollback semantics: any throw inside the callback restores every table.
  database.$transaction = async (fn: any) => {
    const snapshot = structuredClone(state);
    try { return await fn(database); } catch (error) { state = snapshot; throw error; }
  };
  globalThis.prisma = database as PrismaClient;
});
afterEach(() => { globalThis.prisma = previousDb; });

const input = (extra: object = {}) => ({ userId: "u1", pageId: "pg", targetBoardId: "b1", targetListId: "l1", expectedUpdatedAt: rev.toISOString(), requestId: "11111111-1111-4111-8111-111111111111", ...extra });
const pageBlocks = () => JSON.parse(state.pages[0].content).blocks;

test("conversion preserves title dueAt reminder done", async () => {
  const preview = await previewLegacyConversion({ userId: "u1", pageId: "pg", targetBoardId: "b1", targetListId: "l1" });
  assert.equal(preview?.canConvert, true);
  assert.deepEqual([preview?.validCount, preview?.undatedCount, preview?.revision], [2, 1, rev.toISOString()]);
  assert.equal(state.cards.length, 0, "preview is read only");

  const result = await convertLegacyDeadlines(input());
  assert.equal(result.converted.length, 2);
  assert.equal(result.undatedCount, 1);
  const [c1, c2] = state.cards;
  assert.deepEqual([c1.title, c1.dueDate.toISOString(), c1.reminder, c1.isCompleted, c1.listId], ["Nộp báo cáo", future, "60", false, "l1"]);
  assert.deepEqual([c2.title, c2.dueDate.toISOString(), c2.reminder, c2.isCompleted], ["Đã xong", "2026-09-01T10:00:00.000Z", null, true]);
  assert.equal(state.deliveries.length, 1, "future reminder scheduled once on the Card");
  assert.deepEqual(pageBlocks().map((block: any) => [block.id, block.type, block.taskId]), [["p", "paragraph", undefined], ["d1", "task", c1.id], ["d2", "task", c2.id], ["d3", "deadline", undefined]]);
  assert.deepEqual(state.mirror, [], "converted blocks leave the legacy mirror; undated block is never mirrored");
  assert.deepEqual(state.maps.map((map: any) => [map.blockId, map.cardId, map.beforePageRevision.getTime()]), [["d1", c1.id, rev.getTime()], ["d2", c2.id, rev.getTime()]]);
  assert.deepEqual(state.maps[0].beforeBlock, blocks[1]);
  assert.equal(state.pages[0].updatedAt.toISOString(), result.revision);
});

test("second conversion creates zero extra cards", async () => {
  const first = await convertLegacyDeadlines(input());
  const replay = await convertLegacyDeadlines(input());
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.converted, first.converted);
  await assert.rejects(convertLegacyDeadlines(input({ requestId: "22222222-2222-4222-8222-222222222222", expectedUpdatedAt: first.revision })), (error: any) => error instanceof LegacyConversionError && error.status === 422);
  await assert.rejects(convertLegacyDeadlines(input({ requestId: "33333333-3333-4333-8333-333333333333" })), (error: any) => error.status === 409, "stale revision");
  assert.equal(state.cards.length, 2);
});

test("mid-transaction failure restores original page", async () => {
  failOn = "map.create";
  await assert.rejects(convertLegacyDeadlines(input()), /injected failure/);
  assert.equal(state.pages[0].content, original);
  assert.equal(state.pages[0].updatedAt.getTime(), rev.getTime());
  assert.deepEqual([state.cards.length, state.maps.length, state.deliveries.length, state.mirror.length], [0, 0, 0, 2]);
});

test("shared target rejected", async () => {
  const preview = await previewLegacyConversion({ userId: "u1", pageId: "pg", targetBoardId: "shared", targetListId: "ls" });
  assert.deepEqual(preview?.target, { ok: false, reason: "shared" });
  assert.equal(preview?.canConvert, false);
  await assert.rejects(convertLegacyDeadlines(input({ targetBoardId: "shared", targetListId: "ls" })), (error: any) => error.status === 403);
  await assert.rejects(convertLegacyDeadlines(input({ targetListId: "ls" })), (error: any) => error.status === 404, "list of another board");
  assert.deepEqual([state.cards.length, state.pages[0].content], [0, original]);
});

test("old undo cannot revive legacy reminders", async () => {
  await convertLegacyDeadlines(input());
  const [c1] = state.cards;
  // An AI change whose "before" is the legacy content, still undoable at the current revision.
  state.aiEdits.push({ id: "e0000000-0000-4000-8000-000000000000", userId: "u1", notePageId: "pg", beforeContent: original, appliedUpdatedAt: state.pages[0].updatedAt, undoneAt: null });
  const response = await runWithAuth({ userId: "u1", user: null }, () => undoRoute(
    new Request("http://local/api/pages/pg/undo", { method: "POST", body: JSON.stringify({ changeId: "e0000000-0000-4000-8000-000000000000" }) }),
    { params: Promise.resolve({ pageId: "pg" }) },
  ));
  assert.equal(response.status, 200);
  assert.deepEqual(pageBlocks().filter((block: any) => block.id === "d1"), [{ id: "d1", type: "task", taskId: c1.id }]);
  assert.deepEqual(state.mirror, []);

  // Even a stale mirror row seen by a concurrent notification request is skipped once mapped.
  state.mirror.push({ pageId: "pg", userId: "u1", blockId: "d1", title: "Nộp báo cáo", dueAt: new Date(Date.now() + 30 * 60_000), reminder: "60", done: false });
  await ensureNoteDeadlineNotifications({ userId: "u1" });
  assert.equal(state.notifications.length, 0);
});

test("restore rolls back an untouched conversion and refuses after the task changed", async () => {
  const converted = await convertLegacyDeadlines(input());
  const restored = await restoreLegacyDeadlines({ userId: "u1", pageId: "pg", expectedUpdatedAt: converted.revision });
  assert.equal(restored.restored, 2);
  assert.equal(state.pages[0].content, original);
  assert.ok(state.cards.every((card: any) => card.archivedAt && card.reminder === null), "tasks archived, not deleted");
  assert.ok(state.deliveries.every((row: any) => row.status === "cancelled"), "task reminder cancelled before legacy returns");
  assert.ok(state.maps.every((map: any) => map.restoredAt), "snapshot rows kept");
  assert.deepEqual(state.mirror.map((row: any) => row.blockId), ["d1", "d2"]);

  // Re-convert, then edit a task: restore must report a conflict and keep everything.
  const again = await convertLegacyDeadlines(input({ requestId: "44444444-4444-4444-8444-444444444444", expectedUpdatedAt: restored.revision }));
  assert.equal(state.maps.length, 2, "rows reused per pageId+blockId");
  state.cards.at(-1).updatedAt = new Date(Date.now() + 1000);
  const before = structuredClone(state);
  await assert.rejects(restoreLegacyDeadlines({ userId: "u1", pageId: "pg", expectedUpdatedAt: again.revision }), (error: any) => error.status === 409);
  assert.deepEqual(state, before);
});

test("dry run reports trashed, invalid and drifted data instead of choosing", () => {
  const content = serializeNoteBlocks([
    { id: "a", type: "deadline", text: "x", dueAt: "not a date", reminder: "none", checked: false },
    { id: "b", type: "deadline", text: "y", dueAt: future, reminder: "7", checked: false },
    { id: "c", type: "deadline", text: "z", dueAt: future, reminder: "none", checked: false },
  ]);
  const result = inventoryLegacyDeadlines({ content, deletedAt: new Date(), mirror: [{ blockId: "c", title: "khác", dueAt: new Date(future), reminder: "none", done: false }], mappedBlockIds: new Set() });
  assert.deepEqual(result.issues.map(issue => [issue.code, issue.blockId]), [["trashed", undefined], ["invalid-date", "a"], ["invalid-reminder", "b"], ["mirror-mismatch", "b"], ["mirror-mismatch", "c"]]);
  const duplicate = JSON.stringify({ version: 1, blocks: [{ id: "x", type: "paragraph", text: "" }, { id: "x", type: "paragraph", text: "" }] });
  assert.deepEqual(inventoryLegacyDeadlines({ content: duplicate, deletedAt: null, mirror: [], mappedBlockIds: new Set() }).issues, [{ code: "duplicate-block-id" }]);
});
