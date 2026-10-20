/* eslint-disable @typescript-eslint/no-explicit-any -- Database doubles exercise context resolution without a live database. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { runWithAuth } from "@/server/auth";
import { POST as chatRoute } from "@/server/routes/ai/chat/route";
import { type AssistantContext, AssistantContextSchema, resolveAssistantContext } from "./context";
import { AiOperationSchema } from "./policy";

const REV = "2026-10-18T00:00:00.000Z";
const previousDb = globalThis.prisma;

test("page questions do not require an unrelated board", async () => {
  const saved = [process.env.GEMINI_API_KEY, process.env.GOOGLE_GENERATIVE_AI_API_KEY];
  delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  try {
    const response = await runWithAuth({ userId: "u1", user: null }, () => chatRoute(new Request("http://localhost/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { kind: "page", pageId: "p1", expectedUpdatedAt: REV }, operation: "answer", message: { role: "user", parts: [{ type: "text", text: "Tóm tắt trang" }] } }) })));
    assert.equal(response.status, 503);
  } finally {
    for (const [index, key] of ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"].entries()) {
      if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index];
    }
  }
});

beforeEach(() => {
  const pages = [{ id: "p1", userId: "u1", deletedAt: null, title: "Notes", updatedAt: new Date(REV), content: JSON.stringify({ version: 1, blocks: [{ id: "a", type: "paragraph", text: "Ôn chương 2" }] }) }];
  const cards = [
    { id: "c1", title: "Báo cáo", description: "Viết phần mở đầu", updatedAt: new Date(REV), list: { boardId: "b1", board: { userId: "u1" } } },
    { id: "c9", title: "Foreign", description: "", updatedAt: new Date(REV), list: { boardId: "b9", board: { userId: "u9" } } },
  ];
  const boards = [{ id: "b1", userId: "u1", title: "Board" }, { id: "b9", userId: "u9", title: "Other" }];
  const courses = [{ id: "k1", boardId: "b1" }, { id: "k9", boardId: "b9" }];
  globalThis.prisma = {
    workspace: {}, aiNoteEdit: {}, // db proxy coi thiếu model là client cũ và tạo client thật
    notePage: { findFirst: async ({ where }: any) => pages.find(p => p.id === where.id && p.userId === where.userId && where.deletedAt === null) ?? null },
    card: { findFirst: async ({ where }: any) => cards.find(c => c.id === where.id && c.list.board.userId === where.list.board.userId) ?? null },
    board: { findFirst: async ({ where }: any) => boards.find(b => b.id === where.id && b.userId === where.userId) ?? null },
    course: { findFirst: async ({ where }: any) => courses.find(c => c.id === where.id && c.boardId === where.boardId) ?? null },
  } as unknown as PrismaClient;
});
afterEach(() => { globalThis.prisma = previousDb; });

const resolve = (context: unknown, userId = "u1") => resolveAssistantContext(AssistantContextSchema.parse(context), userId);

test("owned contexts resolve to minimal checked prompt data", async () => {
  const page = await resolve({ kind: "page", pageId: "p1", expectedUpdatedAt: REV, selectedBlockIds: ["a"] });
  assert.equal(page.ok, true);
  if (page.ok) assert.deepEqual(page.value.prompt, { kind: "page", pageId: "p1", title: "Notes", selectedText: "Ôn chương 2" });
  const task = await resolve({ kind: "task", cardId: "c1", expectedUpdatedAt: REV, selection: { text: "phần mở đầu" } });
  assert.equal(task.ok && task.value.boardId, "b1");
  const calendar = await resolve({ kind: "calendar", boardId: "b1", date: "2026-10-20", filters: { courseId: "k1" } });
  assert.equal(calendar.ok, true);
});

test("foreign context rejected", async () => {
  for (const context of [
    { kind: "page", pageId: "p1", expectedUpdatedAt: REV },
    { kind: "task", cardId: "c1", expectedUpdatedAt: REV },
    { kind: "board", boardId: "b1" },
  ]) assert.equal((await resolve(context, "u9")).ok, false);
  assert.equal((await resolve({ kind: "task", cardId: "c9", expectedUpdatedAt: REV })).ok, false);
  assert.equal((await resolve({ kind: "board", boardId: "b9" })).ok, false);
});

test("filtered calendar context outside permission is rejected", async () => {
  const foreignBoard = await resolve({ kind: "calendar", boardId: "b9", date: "2026-10-20", filters: {} });
  assert.equal(foreignBoard.ok, false);
  const foreignCourse = await resolve({ kind: "calendar", boardId: "b1", date: "2026-10-20", filters: { courseId: "k9" } });
  assert.deepEqual(foreignCourse.ok ? null : foreignCourse.status, 403);
});

test("selected blocks and text must match the allowed content and revision", async () => {
  const outside = await resolve({ kind: "page", pageId: "p1", expectedUpdatedAt: REV, selectedBlockIds: ["not-on-page"] });
  assert.equal(outside.ok ? null : outside.status, 400);
  const stale = await resolve({ kind: "page", pageId: "p1", expectedUpdatedAt: "2026-10-17T00:00:00.000Z" });
  assert.equal(stale.ok ? null : stale.status, 409);
  const mismatch = await resolve({ kind: "task", cardId: "c1", expectedUpdatedAt: REV, selection: { text: "đoạn bịa" } });
  assert.equal(mismatch.ok ? null : mismatch.status, 400);
});

test("context switch does not retarget request", async () => {
  const input: AssistantContext = { kind: "task", cardId: "c1", expectedUpdatedAt: REV };
  const resolved = await resolveAssistantContext(input, "u1");
  (input as any).cardId = "c2"; // client chuyển sang thẻ khác khi request còn chạy
  assert.equal(resolved.ok && resolved.value.context.kind === "task" && resolved.value.context.cardId, "c1");
  assert.throws(() => { (resolved as any).value.context.cardId = "c2"; });
});

test("unknown operations, kinds and extra context fields are rejected at the boundary", () => {
  assert.equal(AiOperationSchema.safeParse("delete_everything").success, false);
  assert.equal(AssistantContextSchema.safeParse({ kind: "workspace" }).success, false);
  assert.equal(AssistantContextSchema.safeParse({ kind: "board", boardId: "b1", role: "ADMIN" }).success, false);
});

test("chat route rejects foreign context and unknown operation before calling AI", async () => {
  const message = { role: "user", parts: [{ type: "text", text: "ngày mai có gì?" }] };
  const post = (body: unknown) => runWithAuth({ userId: "u1", user: null }, () =>
    chatRoute(new Request("http://local/api/ai/chat", { method: "POST", body: JSON.stringify(body) })));
  assert.equal((await post({ context: { kind: "task", cardId: "c9", expectedUpdatedAt: REV }, message })).status, 404);
  assert.equal((await post({ boardId: "b9", message })).status, 403);
  assert.equal((await post({ boardId: "b1", operation: "drop_tables", message })).status, 400);
  assert.equal((await post({ boardId: "b9", context: { kind: "task", cardId: "c1", expectedUpdatedAt: REV }, message })).status, 400);
});
