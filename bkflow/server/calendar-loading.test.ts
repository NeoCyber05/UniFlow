import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

import { GET } from "./routes/boards/[boardId]/calendar/route";
import { runWithAuth } from "./auth";

const previousDb = globalThis.prisma;
afterEach(() => { globalThis.prisma = previousDb; });

const requestCalendar = (query: string) => runWithAuth(
  { userId: "u1", user: null },
  () => GET(new Request(`http://localhost/api/boards/b1/calendar?${query}`), {
    params: Promise.resolve({ boardId: "b1" }),
  }),
);

test("calendar tray loads independently of date-range queries", async () => {
  globalThis.prisma = {
    workspace: {}, course: {}, notePage: {}, aiNoteEdit: {},
    board: { findFirst: async () => ({ id: "b1", userId: "u1", title: "Board" }) },
    card: {
      findMany: async ({ where }: Prisma.CardFindManyArgs) => {
        assert.equal(where?.scheduledOn, null);
        assert.equal(where?.scheduledStartAt, null);
        assert.deepEqual(where?.list, { archivedAt: null, board: { id: "b1", userId: "u1" } });
        return [{
          id: "c1",
          title: "Write outline",
          order: 1,
          isCompleted: false,
          updatedAt: new Date("2026-11-19T00:00:00Z"),
          dueDate: null,
          deadlineOn: null,
          listId: "l1",
          courseId: null,
          userStates: [],
          list: { title: "Todo", order: 1 },
          labels: [],
          _count: { comments: 0 },
        }];
      },
    },
    checklistItem: {
      findMany: async () => assert.fail("Tray must not run the date-range checklist query"),
    },
  } as unknown as PrismaClient;

  const response = await requestCalendar("unscheduledOnly=true");
  assert.equal(response.status, 200);
  const cards = await response.json();
  assert.deepEqual(cards.map(({ cardId, title }: { cardId: string; title: string }) => [cardId, title]), [
    ["c1", "Write outline"],
  ]);
});

test("calendar ranges skip the board tray unless legacy callers request it", async () => {
  let trayLoads = 0;
  globalThis.prisma = {
    workspace: {}, course: {}, notePage: {}, aiNoteEdit: {},
    board: { findFirst: async () => ({ id: "b1", userId: "u1", title: "Board" }) },
    card: {
      findMany: async ({ where }: Prisma.CardFindManyArgs) => {
        if (where?.scheduledStartAt === null) trayLoads++;
        return [];
      },
    },
    checklistItem: { findMany: async () => [] },
  } as unknown as PrismaClient;

  const range = "from=2026-11-18T17:00:00Z&to=2026-11-19T17:00:00Z";
  const response = await requestCalendar(range);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).unscheduledCards, []);
  assert.equal(trayLoads, 0);

  const legacy = await requestCalendar(`${range}&includeUnscheduled=true`);
  assert.equal(legacy.status, 200);
  assert.equal(trayLoads, 1);
});

test("an unowned calendar cannot read the board's tray", async () => {
  globalThis.prisma = {
    workspace: {}, course: {}, notePage: {}, aiNoteEdit: {},
    board: { findFirst: async () => null },
    card: { findMany: async () => assert.fail("The board is not owned by the caller") },
  } as unknown as PrismaClient;

  assert.equal((await requestCalendar("unscheduledOnly=true")).status, 403);
});
