/* eslint-disable @typescript-eslint/no-explicit-any -- Database doubles exercise the resolver and route without a live database. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { runWithAuth } from "@/server/auth";
import { GET as pageTasksRoute } from "@/server/routes/pages/[pageId]/tasks/route";
import { getLinkedTaskIds, resolveLinkedTaskView } from "./contract";
import { loadLinkedTasks } from "./linked-tasks";

type Row = { id: string; title: string; isCompleted: boolean; dueDate: Date | null; deadlineOn: Date | null; updatedAt: Date; archivedAt: Date | null; list: { boardId: string; archivedAt: Date | null; board: { userId: string } } };

const row = (id: string, extra: Partial<Row> = {}, list: Partial<Row["list"]> = {}): Row => ({
  id, title: `Task ${id}`, isCompleted: false, dueDate: null, deadlineOn: null, updatedAt: new Date("2026-10-01T00:00:00Z"), archivedAt: null,
  ...extra, list: { boardId: "b1", archivedAt: null, board: { userId: "u1" }, ...list },
});

const previousDb = globalThis.prisma;
let cards: Row[];
let pages: { id: string; userId: string; content: string }[];
let cardQueries: any[];

beforeEach(() => {
  cards = [];
  pages = [{ id: "p1", userId: "u1", content: "" }];
  cardQueries = [];
  const database = {
    course: {}, semester: {}, aiNoteEdit: {},
    notePage: { findFirst: async ({ where }: any) => pages.find(page => page.id === where.id && page.userId === where.userId) ?? null },
    card: {
      findMany: async (query: any) => {
        cardQueries.push(query);
        const { where } = query;
        return cards.filter(card => where.id.in.includes(card.id) && card.archivedAt === where.archivedAt
          && card.list.archivedAt === where.list.archivedAt && card.list.board.userId === where.list.board.userId);
      },
    },
  };
  globalThis.prisma = database as unknown as PrismaClient;
});
afterEach(() => { globalThis.prisma = previousDb; });

const taskContent = (...taskIds: string[]) => JSON.stringify({ version: 1, blocks: taskIds.map((taskId, index) => ({ id: `t${index}`, type: "task", taskId })) });

test("linked task outside current semester remains available", async () => {
  // Semester is a board/course concept; the resolver must not filter by it.
  cards = [row("c1", { title: "Bài tập kỳ trước", dueDate: new Date("2025-03-01T10:00:00Z"), deadlineOn: new Date("2025-03-01T00:00:00Z"), updatedAt: new Date("2026-10-18T00:00:00Z") }, { boardId: "old-semester" })];
  const [result] = await loadLinkedTasks({ userId: "u1", pageId: "p1", taskIds: ["c1"] });
  assert.deepEqual(result, {
    taskId: "c1", state: "available",
    task: { id: "c1", title: "Bài tập kỳ trước", boardId: "old-semester", isCompleted: false, dueDate: "2025-03-01T10:00:00.000Z", deadlineOn: "2025-03-01", updatedAt: "2026-10-18T00:00:00.000Z" },
  });
  const { where, select } = cardQueries[0];
  assert.equal(where.isCompleted, undefined);
  assert.deepEqual(Object.keys(select).sort(), ["deadlineOn", "dueDate", "id", "isCompleted", "list", "title", "updatedAt"]);
});

test("completed linked task remains available with the latest DB values", async () => {
  cards = [row("c1", { title: "Tên mới", isCompleted: true })];
  const [result] = await loadLinkedTasks({ userId: "u1", pageId: "p1", taskIds: ["c1"] });
  assert.equal(result.state, "available");
  assert.equal(result.state === "available" && result.task.title, "Tên mới");
  assert.equal(result.state === "available" && result.task.isCompleted, true);
});

test("foreign or deleted task has no cached title", async () => {
  cards = [
    row("foreign", {}, { board: { userId: "u2" } }),
    row("archived", { archivedAt: new Date() }),
    row("archived-list", {}, { archivedAt: new Date() }),
  ];
  const results = await loadLinkedTasks({ userId: "u1", pageId: "p1", taskIds: ["foreign", "archived", "archived-list", "deleted"] });
  assert.deepEqual(results, ["foreign", "archived", "archived-list", "deleted"].map(taskId => ({ taskId, state: "unavailable" })));
});

test("foreign page cannot query tasks", async () => {
  cards = [row("c1")];
  pages = [{ id: "p1", userId: "u2", content: taskContent("c1") }];
  assert.deepEqual(await loadLinkedTasks({ userId: "u1", pageId: "p1", taskIds: ["c1"] }), []);
  const response = await runWithAuth({ userId: "u1", user: null }, () => pageTasksRoute(new Request("http://local/api/pages/p1/tasks"), { params: Promise.resolve({ pageId: "p1" }) }));
  assert.equal(response.status, 404);
  assert.equal(cardQueries.length, 0);
});

test("empty taskIds never query cards; refs are unique and capped", async () => {
  assert.deepEqual(await loadLinkedTasks({ userId: "u1", pageId: "p1", taskIds: ["", ""] }), []);
  assert.equal(cardQueries.length, 0);
  assert.deepEqual(getLinkedTaskIds(taskContent("", "c1", "c1", "c2")), ["c1", "c2"]);
  const many = Array.from({ length: 150 }, (_, index) => `c${index}`);
  await loadLinkedTasks({ userId: "u1", pageId: "p1", taskIds: many });
  assert.equal(cardQueries[0].where.id.in.length, 100);
});

test("GET /api/pages/:pageId/tasks reads refs from page content, 401 when signed out, no-store", async () => {
  cards = [row("c1"), row("c2", {}, { board: { userId: "u2" } })];
  pages = [{ id: "p1", userId: "u1", content: taskContent("c1", "c2", "") }];
  const call = (userId: string | null, url = "http://local/api/pages/p1/tasks") =>
    runWithAuth({ userId, user: null }, () => pageTasksRoute(new Request(url), { params: Promise.resolve({ pageId: "p1" }) }));

  assert.equal((await call(null)).status, 401);

  const response = await call("u1", "http://local/api/pages/p1/tasks?taskIds=c9");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const body = await response.json();
  assert.deepEqual(body.tasks.map((item: any) => [item.taskId, item.state]), [["c1", "available"], ["c2", "unavailable"]]);
  assert.deepEqual(cardQueries[0].where.id.in, ["c1", "c2"]);
  assert.equal(body.tasks[1].task, undefined);
});

test("task picker search covers completed and other-semester tasks within the owner's scope", async () => {
  const { searchWorkspace } = await import("@/lib/search/workspace-search-server");
  const database = globalThis.prisma as any;
  Object.assign(database, { course: { findMany: async () => [] }, board: { findMany: async () => [] }, notePage: { ...database.notePage, findMany: async () => [] } });
  database.card.findMany = async ({ where, take }: any) => {
    assert.equal(where.list.board.userId, "u1");
    assert.equal(where.isCompleted, undefined);
    assert.equal(where.courseId, undefined);
    assert.ok(take <= 10);
    return [{ id: "c1", title: "Done task", list: { title: "Xong", boardId: "b-old", board: { title: "Kỳ trước" } } }];
  };
  const { items } = await searchWorkspace("u1", "Done");
  assert.equal(items[0].id, "c1");
});

test("linked task view hides stale data while re-checking and separates network errors from unavailable", () => {
  const task = { id: "c1", title: "Tên mới", boardId: "b1", isCompleted: false, dueDate: null, deadlineOn: null, updatedAt: "2026-10-18T00:00:00.000Z" };
  const results = [{ taskId: "c1", state: "available" as const, task }, { taskId: "gone", state: "unavailable" as const }];
  const picked = { title: "Vừa chọn", subtitle: "Kỳ trước · Xong" };
  assert.deepEqual(resolveLinkedTaskView("", { results, fetching: false, error: null }), { state: "empty" });
  assert.deepEqual(resolveLinkedTaskView("c1", { results, fetching: false, error: null }), { state: "available", task });
  assert.deepEqual(resolveLinkedTaskView("c1", { results, fetching: true, error: null }), { state: "checking" });
  assert.deepEqual(resolveLinkedTaskView("gone", { results, fetching: false, error: null }), { state: "unavailable" });
  assert.deepEqual(resolveLinkedTaskView("c1", { results, fetching: false, error: "denied" }), { state: "unavailable" });
  assert.deepEqual(resolveLinkedTaskView("c1", { results, fetching: false, error: "network" }), { state: "error" });
  assert.deepEqual(resolveLinkedTaskView("new", { results, fetching: false, error: null }, picked), { state: "picked", ...picked });
  assert.deepEqual(resolveLinkedTaskView("new", { results, fetching: false, error: null }), { state: "pending" });
});
