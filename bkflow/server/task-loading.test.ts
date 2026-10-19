import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

import { getTodoTasks } from "@/lib/my-tasks/query";
import { GET as getCard } from "./routes/cards/[cardId]/route";
import { runWithAuth } from "./auth";

const previousDb = globalThis.prisma;
let database: Record<string, unknown>;

beforeEach(() => {
  database = { course: {}, semester: {}, notePage: {}, aiNoteEdit: {} };
  globalThis.prisma = database as unknown as PrismaClient;
});
afterEach(() => { globalThis.prisma = previousDb; });

test("todo reads tasks directly without looking up or seeding semesters", async () => {
  database.board = { findUnique: () => assert.fail("Unneeded semester-board lookup") };
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

test("card detail keeps its checklist items but only loads names for the board copy menu", async () => {
  const items = [{ id: "i1", title: "Do this", isCompleted: false }];
  database.card = { findFirst: async (args: Prisma.CardFindFirstArgs) => {
    assert.deepEqual(args.where, { id: "c1", list: { board: { userId: "u1" } } });
    assert.deepEqual(args.include?.checklists, { include: { items: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } });
    return { id: "c1", list: { boardId: "b1" }, checklists: [{ id: "cl1", items }] };
  } };
  database.board = { findFirst: async () => ({ id: "b1", userId: "u1", title: "Board" }) };
  database.label = { findMany: async () => [] };
  database.checklist = { findMany: async (args: Prisma.ChecklistFindManyArgs) => {
    assert.deepEqual(args.where, { card: { archivedAt: null, list: { archivedAt: null, boardId: "b1" } } });
    assert.equal(args.include?.items, undefined, "Do not fetch every checklist item on the board");
    assert.deepEqual(args.select, { id: true, title: true, card: { select: { title: true } } });
    return [{ id: "cl1", title: "Checklist", card: { title: "Card" } }];
  } };
  const response = await requestCard();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.checklists[0].items, items);
  assert.equal(result.boardChecklists[0].id, "cl1");
});

test("unauthenticated and missing or unowned cards never load board data", async () => {
  assert.equal((await requestCard(null)).status, 401);
  database.card = { findFirst: async (args: Prisma.CardFindFirstArgs) => {
    assert.deepEqual(args.where, { id: "c1", list: { board: { userId: "other-user" } } });
    return null;
  } };
  assert.equal((await requestCard("other-user")).status, 404);
});
