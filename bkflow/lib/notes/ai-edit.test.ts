/* eslint-disable @typescript-eslint/no-explicit-any -- An in-memory database double with transaction rollback stands in for Postgres. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";

import { runWithAuth } from "@/server/auth";
import { POST as aiRoute } from "@/server/routes/pages/[pageId]/ai/route";
import { GET as historyRoute } from "@/server/routes/pages/[pageId]/history/route";
import { POST as undoRoute } from "@/server/routes/pages/[pageId]/undo/route";
import { aiEditFingerprint, AiPageEditRequest, applyAiPageEdit } from "./ai-edit";
import { checkAiBlockEdit, serializeNoteBlocks, type NoteBlock } from "./blocks";
import { extractNoteDeadlines } from "./deadlines";

const previousDb = globalThis.prisma;
const rev = new Date("2026-10-19T00:00:00.000Z");
const style = { theme: "lavender" };
const task: NoteBlock = { id: "t1", type: "task", taskId: "card-1" };
const deadline: NoteBlock = { id: "d1", type: "deadline", text: "Nộp báo cáo", dueAt: "2026-11-01T10:00:00.000Z", reminder: "60", checked: false };
const blocks: NoteBlock[] = [
  { id: "p1", type: "paragraph", text: "Hiểu chương 3" },
  { id: "p2", type: "paragraph", text: "Slide tuần 5" },
  task,
  deadline,
  { id: "p3", type: "todo", text: "Làm đề cũ", checked: true },
];
const original = serializeNoteBlocks(blocks);
// "Mục tiêu, tài liệu, kế hoạch" layout: only headings are added and blocks regrouped.
const layout: NoteBlock[] = [
  { id: "h1", type: "heading", level: 2, text: "Mục tiêu" }, blocks[0],
  { id: "h2", type: "heading", level: 2, text: "Tài liệu" }, blocks[1],
  { id: "h3", type: "heading", level: 2, text: "Kế hoạch" }, task, deadline, blocks[4],
];
const doc = (items: NoteBlock[]) => ({ version: 1 as const, blocks: items });

let state: any;
const matches = (row: any, where: any = {}) => Object.entries(where).every(([key, value]: [string, any]) =>
  value instanceof Date ? row[key] instanceof Date && row[key].getTime() === value.getTime() : value === null ? row[key] == null : row[key] === value);

beforeEach(() => {
  state = {
    pages: [{ id: "pg", userId: "u1", title: "Ôn thi", content: original, style, deletedAt: null, updatedAt: rev }],
    mirror: extractNoteDeadlines(original).map(row => ({ ...row, pageId: "pg", userId: "u1" })),
    maps: [], aiEdits: [],
  };
  const database: any = {
    course: {}, semester: {},
    notePage: {
      findFirst: async ({ where }: any) => { const page = state.pages.find((item: any) => matches(item, where)); return page ? { ...page } : null; },
      findUniqueOrThrow: async ({ where }: any) => ({ ...state.pages.find((page: any) => page.id === where.id) }),
      updateMany: async ({ where, data }: any) => { const hits = state.pages.filter((page: any) => matches(page, where)); hits.forEach((page: any) => Object.assign(page, data)); return { count: hits.length }; },
    },
    noteDeadline: {
      deleteMany: async ({ where }: any) => { state.mirror = state.mirror.filter((row: any) => row.pageId !== where.pageId); },
      createMany: async ({ data }: any) => { state.mirror.push(...data); },
    },
    noteDeadlineTaskMap: { findMany: async ({ where }: any) => state.maps.filter((row: any) => matches(row, where)) },
    aiNoteEdit: {
      findFirst: async ({ where }: any) => state.aiEdits.find((edit: any) => matches(edit, where)) ?? null,
      findMany: async ({ where }: any) => state.aiEdits.filter((edit: any) => matches(edit, where)),
      create: async ({ data }: any) => {
        if (state.aiEdits.some((edit: any) => edit.userId === data.userId && edit.requestId === data.requestId)) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
        }
        const edit = { id: crypto.randomUUID(), createdAt: new Date(), undoneAt: null, ...data };
        state.aiEdits.push(edit);
        return { id: edit.id, createdAt: edit.createdAt, undoneAt: edit.undoneAt };
      },
      updateMany: async ({ where, data }: any) => { const hits = state.aiEdits.filter((edit: any) => matches(edit, where)); hits.forEach((edit: any) => Object.assign(edit, data)); return { count: hits.length }; },
    },
  };
  database.$transaction = async (fn: any) => {
    const snapshot = structuredClone(state);
    try { return await fn(database); } catch (error) { state = snapshot; throw error; }
  };
  globalThis.prisma = database as PrismaClient;
});
afterEach(() => { globalThis.prisma = previousDb; });

const requestId = "11111111-1111-4111-8111-111111111111";
const body = (extra: object = {}) => AiPageEditRequest.parse({ prompt: "Sắp xếp thành mục tiêu, tài liệu, kế hoạch", expectedUpdatedAt: rev.toISOString(), requestId, ...extra });
const apply = (items: NoteBlock[], extra: object = {}) => {
  const request = body(extra);
  return applyAiPageEdit({ userId: "u1", pageId: "pg", requestId: request.requestId, fingerprint: aiEditFingerprint("pg", request), expectedUpdatedAt: request.expectedUpdatedAt, operation: request.operation, document: doc(items) });
};
const call = (route: any, path: string, payload?: object) => runWithAuth({ userId: "u1", user: null }, () => route(
  new Request(`http://local/api/pages/pg/${path}`, payload ? { method: "POST", body: JSON.stringify(payload) } : undefined),
  { params: Promise.resolve({ pageId: "pg" }) },
)) as Promise<Response>;
const pageBlocks = () => JSON.parse(state.pages[0].content).blocks;

test("model cannot replace linked task id", () => {
  const swapped = blocks.map(block => block.id === "t1" ? { ...task, taskId: "card-of-someone-else" } : block);
  assert.equal(checkAiBlockEdit(blocks, swapped).ok, false);
  assert.equal(checkAiBlockEdit(blocks, [...blocks, { id: "t2", type: "task", taskId: "card-2" }]).ok, false, "no new task ref");
  assert.equal(checkAiBlockEdit(blocks, [...blocks, { id: "t3", type: "task", taskId: "" }]).ok, false, "new task blocks go through the picker");
  assert.equal(checkAiBlockEdit(blocks, [...blocks, { ...deadline, id: "d2" }]).ok, false, "no new legacy deadline");
  assert.equal(checkAiBlockEdit(blocks, blocks.map(block => block.id === "d1" ? { ...deadline, id: "t1" } : block.id === "t1" ? { ...task, id: "d1" } : block)).ok, false, "ids cannot be swapped");
});

test("layout edit preserves deadline values", async () => {
  for (const changed of [{ dueAt: "2026-11-02T10:00:00.000Z" }, { reminder: "none" }, { checked: true }]) {
    assert.equal(checkAiBlockEdit(blocks, layout.map((block): NoteBlock => block.id === "d1" ? { ...deadline, ...changed } as NoteBlock : block)).ok, false, JSON.stringify(changed));
  }
  assert.deepEqual(checkAiBlockEdit(blocks, layout), { ok: true, noop: false, large: false });
  const mirrorBefore = structuredClone(state.mirror);

  const result = await apply(layout);
  assert.deepEqual(pageBlocks(), layout);
  assert.deepEqual(pageBlocks().filter((block: any) => block.type === "task" || block.type === "deadline"), [task, deadline]);
  assert.deepEqual(state.mirror, mirrorBefore, "deadline mirror keeps the same values");
  assert.deepEqual(state.pages[0].style, style, "layout edit never touches page style");
  const [receipt] = state.aiEdits;
  assert.deepEqual([receipt.id, receipt.requestId, receipt.beforeContent, receipt.beforeUpdatedAt.getTime(), receipt.appliedUpdatedAt.getTime()],
    [result.changeId, requestId, original, rev.getTime(), state.pages[0].updatedAt.getTime()]);
});

test("semantic no-op creates no history", async () => {
  // Fresh ids with identical content are still a no-op.
  assert.deepEqual(checkAiBlockEdit(blocks, blocks.map(block => block.type === "paragraph" ? { ...block, id: `${block.id}-new` } : block)), { ok: true, noop: true, large: false });
  const response = await call(aiRoute, "ai", { ...body({ operation: "replace_content", confirmed: true, document: doc(blocks) }) });
  assert.equal(response.status, 422);
  assert.deepEqual([state.aiEdits.length, state.pages[0].content, state.pages[0].updatedAt], [0, original, rev]);
});

test("large changes need explicit confirmation; confirmed removal keeps no foreign refs", async () => {
  assert.deepEqual(checkAiBlockEdit(blocks, blocks.filter(block => block.id !== "t1")), { ok: true, noop: false, large: true }, "removing a task ref");
  const rewritten = blocks.map(block => block.type === "paragraph" || block.type === "todo" ? { ...block, text: `${block.text}!` } : block);
  assert.deepEqual(checkAiBlockEdit(blocks, rewritten), { ok: true, noop: false, large: true });
  assert.equal(AiPageEditRequest.safeParse({ ...body(), operation: "edit_page", confirmed: true, document: doc(blocks) }).success, false, "confirmed only for replace_content");

  const response = await call(aiRoute, "ai", body({ operation: "replace_content", confirmed: true, document: doc(blocks.filter(block => block.id !== "t1")) }));
  assert.equal(response.status, 200);
  assert.deepEqual(pageBlocks().map((block: any) => block.id), ["p1", "p2", "d1", "p3"]);
});

test("same request replays without second edit", async () => {
  const first = await apply(layout);
  const second = await apply(layout);
  assert.deepEqual([second.replayed, second.changeId, state.aiEdits.length], [true, first.changeId, 1]);
  assert.equal(second.page.updatedAt.getTime(), first.page.updatedAt.getTime(), "no second revision");
  await assert.rejects(apply(layout, { prompt: "Khác" }), (error: any) => error.status === 409, "same id, other payload");

  // Lost response after commit: the route replays the receipt before calling the model.
  const payload = body({ requestId: "22222222-2222-4222-8222-222222222222", expectedUpdatedAt: first.page.updatedAt.toISOString(), operation: "replace_content", confirmed: true, document: doc(blocks) });
  const committed = await (await call(aiRoute, "ai", payload)).json();
  const retried = await call(aiRoute, "ai", payload);
  assert.equal(retried.status, 200);
  const replay = await retried.json();
  assert.deepEqual([replay.replayed, replay.changeId, state.aiEdits.length], [true, committed.changeId, 2]);
  assert.equal((await call(aiRoute, "ai", { ...payload, document: doc(layout) })).status, 409, "same id, other document");
});

test("stale revision writes nothing and leaves no receipt", async () => {
  state.pages[0].updatedAt = new Date(rev.getTime() + 5);
  await assert.rejects(apply(layout), (error: any) => error.status === 409);
  assert.deepEqual([state.aiEdits.length, state.pages[0].content], [0, original]);
});

test("reload undo then later edit conflicts", async () => {
  const applied = await apply(layout);
  const manual = serializeNoteBlocks([...layout, { id: "p9", type: "paragraph", text: "Sửa tay" }]);
  Object.assign(state.pages[0], { content: manual, updatedAt: new Date(applied.page.updatedAt.getTime() + 1000) });

  // After reload the change id comes from history.
  const { changes } = await (await call(historyRoute, "history")).json();
  assert.deepEqual(changes.map((change: any) => change.id), [applied.changeId]);
  const response = await call(undoRoute, "undo", { changeId: changes[0].id });
  assert.equal(response.status, 409);
  const { conflict } = await response.json();
  assert.deepEqual([conflict.beforeContent, conflict.currentContent], [original, manual]);
  assert.deepEqual([state.pages[0].content, state.aiEdits[0].undoneAt], [manual, null], "manual edit is never overwritten");
});

test("repeated undo is stable and does not revert twice", async () => {
  const applied = await apply(layout);
  const first = await call(undoRoute, "undo", { changeId: applied.changeId });
  assert.equal(first.status, 200);
  assert.equal(state.pages[0].content, original);
  assert.deepEqual(state.pages[0].style, style);
  const revision = state.pages[0].updatedAt;
  const again = await call(undoRoute, "undo", { changeId: applied.changeId });
  assert.equal(again.status, 200);
  assert.equal((await again.json()).alreadyUndone, true);
  assert.equal(state.pages[0].updatedAt, revision, "no second write");
  // Replay of the original request still reports the same, now undone, change.
  const replay = await apply(layout);
  assert.deepEqual([replay.replayed, replay.changeId, Boolean(replay.change.undoneAt)], [true, applied.changeId, true]);
});

test("history write failure rolls back the page edit; unsupported pages are never rewritten", async () => {
  const create = (globalThis.prisma as any).aiNoteEdit.create;
  (globalThis.prisma as any).aiNoteEdit.create = async () => { throw new Error("injected history failure"); };
  await assert.rejects(apply(layout));
  assert.deepEqual([state.pages[0].content, state.pages[0].updatedAt, state.aiEdits.length], [original, rev, 0]);
  (globalThis.prisma as any).aiNoteEdit.create = create;

  const unsupported = JSON.stringify({ version: 2, blocks: [{ id: "x", type: "table" }] });
  state.pages[0].content = unsupported;
  const response = await call(aiRoute, "ai", body({ operation: "replace_content", confirmed: true, document: doc(layout) }));
  assert.equal(response.status, 422);
  assert.equal(state.pages[0].content, unsupported);
});
