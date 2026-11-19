import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

import { getTodoTasks } from "@/lib/my-tasks/query";
import { GET as getCard } from "./routes/cards/[cardId]/route";
import { runWithAuth } from "./auth";
import { loadBoardList } from "./views/board-list";

const previousDb = globalThis.prisma;
let database: Record<string, unknown>;

beforeEach(() => {
  database = { course: {}, workspace: {}, notePage: {}, aiNoteEdit: {} };
  globalThis.prisma = database as unknown as PrismaClient;
});
afterEach(() => { globalThis.prisma = previousDb; });

test("todo reads tasks directly without looking up or creating workspaces", async () => {
  database.board = { findUnique: () => assert.fail("Unneeded workspace-board lookup") };
  database.card = { findMany: async (args: Prisma.CardFindManyArgs) => {
    assert.ok(Array.isArray(args.where?.AND));
    assert.deepEqual(args.where.AND[0], { archivedAt: null, list: { archivedAt: null, boardId: "b1" } });
    assert.equal(args.take, 300);
    return [];
  } };
  const result = await getTodoTasks({ boardId: "b1", userId: "u1" });
  assert.ok(result.groups.every(group => group.tasks.length === 0));
});

const requestCard = (userId: string | null = "u1") => runWithAuth(
  { userId, user: null },
  () => getCard(new Request("http://localhost/api/cards/c1"), { params: Promise.resolve({ cardId: "c1" }) }),
);

test("card detail keeps its checklist items without loading other cards' checklists", async () => {
  const items = [{ id: "i1", title: "Do this", isCompleted: false }];
  database.card = { findFirst: async (args: Prisma.CardFindFirstArgs) => {
    assert.deepEqual(args.where, { id: "c1", list: { board: { userId: "u1" } } });
    assert.deepEqual(args.include?.checklists, { include: { items: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } });
    return { id: "c1", list: { boardId: "b1" }, checklists: [{ id: "cl1", items }] };
  } };
  database.board = { findFirst: async () => ({ id: "b1", userId: "u1", title: "Board" }) };
  database.label = { findMany: async () => [] };
  let boardChecklistReads = 0;
  database.checklist = { findMany: async () => { boardChecklistReads++; return []; } };
  const response = await requestCard();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.checklists[0].items, items);
  assert.equal(boardChecklistReads, 0);
  assert.equal(Object.hasOwn(result, "boardChecklists"), false);
});

test("board list metadata leaves task loading to the agenda endpoint", async () => {
  database.board = { findFirst: async () => ({ id: "b1", userId: "u1", boardType: "WORKSPACE", lists: [], labels: [] }) };
  let agendaReads = 0;
  database.card = { findMany: async () => { agendaReads++; return []; } };

  const result = await loadBoardList({ boardId: "b1" }, "u1");

  assert.equal(result.boardId, "b1");
  assert.equal(agendaReads, 0);
  assert.equal(Object.hasOwn(result, "initialAgendaData"), false);
});

test("unauthenticated and missing or unowned cards never load board data", async () => {
  assert.equal((await requestCard(null)).status, 401);
  database.card = { findFirst: async (args: Prisma.CardFindFirstArgs) => {
    assert.deepEqual(args.where, { id: "c1", list: { board: { userId: "other-user" } } });
    return null;
  } };
  assert.equal((await requestCard("other-user")).status, 404);
});
