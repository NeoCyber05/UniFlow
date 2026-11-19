import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { buildBoardContext, loadBoardSnapshot, type AssistantSession } from "./board-data";
import { createAssistantTools } from "./tools";

const previousDb = globalThis.prisma;
const session: AssistantSession = {
  boardId: "b1",
  userId: "u1",
  role: "ADMIN",
  timeZone: "Asia/Ho_Chi_Minh",
};
const now = new Date("2026-11-19T08:00:00Z");
const dueDate = new Date("2026-11-21T12:00:00Z");
const checklists = [{ items: [{ isCompleted: true }, { isCompleted: false }] }];
const labels = [{ label: { title: "Đồ án" } }];
const course = { id: "76288a6e-fe53-427a-bb6d-13cc9e07da22", name: "Mạng máy tính", code: "IT4060", credits: 3 };
const cards = [
  ...Array.from({ length: 121 }, (_, i) => ({
    id: `card-${i}`, title: `Card ${i}`, startDate: null, dueDate, deadlineOn: null, isCompleted: false, course: null, courseId: null,
  })),
  {
    id: "date-only", title: "Old card", startDate: null, dueDate: null,
    deadlineOn: new Date("2026-11-20T00:00:00Z"), isCompleted: false, course, courseId: course.id,
  },
];

const mockBoard = () => {
  const fullBoardReads: { checklists: boolean; labels: boolean; isCompleted?: boolean }[] = [];
  const detailsRead: string[][] = [];
  globalThis.prisma = {
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    board: {
      findUnique: async ({ where, select }: {
        where: { id: string; userId: string };
        select: { lists: { select: { cards: { where: { isCompleted?: boolean }; select: { checklists?: unknown; labels?: unknown } } } } };
      }) => {
        assert.deepEqual(where, { id: "b1", userId: "u1" });
        const query = select.lists.select.cards;
        const selection = query.select;
        fullBoardReads.push({
          checklists: Boolean(selection.checklists),
          labels: Boolean(selection.labels),
          ...(query.where.isCompleted === false ? { isCompleted: false } : {}),
        });
        const rows = cards.map(card => ({
          ...card,
          ...(selection.checklists ? { checklists } : {}),
          ...(selection.labels ? { labels } : {}),
        }));
        return { id: "b1", title: "Bảng", boardType: "PERSONAL", courses: [course], workspace: null, lists: [{ id: "l1", title: "Việc", cards: rows }] };
      },
    },
    card: {
      findMany: async ({ where, select }: {
        where: { id: { in: string[] }; archivedAt: null; list: { boardId: string; archivedAt: null; board: { userId: string } } };
        select: { labels?: unknown };
      }) => {
        assert.equal(where.archivedAt, null);
        assert.deepEqual(where.list, { boardId: "b1", archivedAt: null, board: { userId: "u1" } });
        detailsRead.push(where.id.in);
        return [...where.id.in].reverse().map(id => ({ id, checklists, ...(select.labels ? { labels } : {}) }));
      },
    },
  } as unknown as PrismaClient;
  return { fullBoardReads, detailsRead };
};

afterEach(() => {
  globalThis.prisma = previousDb;
});

test("the prompt reads checklist details for only the first 120 ranked cards", async () => {
  const { fullBoardReads, detailsRead } = mockBoard();
  const snapshot = await loadBoardSnapshot(session.boardId, session.userId);
  assert.ok(snapshot);
  const context = buildBoardContext(snapshot, session, now);
  const lines = context.split("\n").filter(line => line.startsWith("- ["));
  assert.equal(lines.length, 120);
  assert.match(lines[0], /\[date-only\].*checklist 1\/2/);
  assert.match(context, /còn 2 thẻ khác/);
  assert.deepEqual(fullBoardReads, [{ checklists: false, labels: false }]);
  assert.equal(detailsRead[0].length, 120);
  assert.ok(detailsRead[0].includes("date-only"));
  assert.ok(!detailsRead[0].includes("card-120"));
});

test("deadline results retain total, date-only ordering and checklist details within the result limit", async () => {
  const { fullBoardReads, detailsRead } = mockBoard();
  const tools = createAssistantTools(session);
  const result = await tools.getDeadlines.execute({ range: "all", scope: "all", includeCompleted: false }, { toolCallId: "deadline", messages: [], context: undefined });
  assert.ok("total" in result);
  assert.equal(result.total, 122);
  assert.equal(result.returned, 25);
  assert.equal(result.cards?.[0]?.id, "date-only");
  assert.equal(result.cards?.[0]?.checklist, "1/2");
  assert.deepEqual(result.cards?.[0]?.labels, ["Đồ án"]);
  assert.deepEqual(fullBoardReads, [{ checklists: false, labels: false, isCompleted: false }]);
  assert.equal(detailsRead[0].length, 25);
});

test("card search preserves accent-insensitive label matches and loads details for only matches returned", async () => {
  const { fullBoardReads, detailsRead } = mockBoard();
  const tools = createAssistantTools(session);
  const result = await tools.findCards.execute({ query: "do an" }, { toolCallId: "search", messages: [], context: undefined });
  assert.ok("total" in result);
  assert.equal(result.total, 122);
  assert.equal(result.cards?.length, 25);
  assert.equal(result.cards?.[0]?.id, "card-0");
  assert.equal(result.cards?.[0]?.checklist, "1/2");
  assert.deepEqual(result.cards?.[0]?.labels, ["Đồ án"]);
  assert.deepEqual(fullBoardReads, [{ checklists: false, labels: true }]);
  assert.equal(detailsRead[0].length, 25);
});

test("deadlines accept the course ID and keep matching the course code used by existing conversations", async () => {
  mockBoard();
  const tools = createAssistantTools(session);
  for (const courseId of [course.id, course.code]) {
    const result = await tools.getDeadlines.execute(
      { range: "all", scope: "all", includeCompleted: false, courseId },
      { toolCallId: courseId, messages: [], context: undefined },
    );
    assert.ok("total" in result);
    assert.equal(result.total, 1);
    assert.equal(result.cards?.[0]?.id, "date-only");
  }
});

test("board progress counts all cards without reading card labels or checklist items", async () => {
  const { fullBoardReads, detailsRead } = mockBoard();
  const tools = createAssistantTools(session);
  const result = await tools.getBoardProgress.execute({}, { toolCallId: "progress", messages: [], context: undefined });
  assert.ok("totalCards" in result);
  assert.equal(result.totalCards, 122);
  assert.deepEqual(result.lists, [{ title: "Việc", total: 122, completed: 0 }]);
  assert.deepEqual(fullBoardReads, [{ checklists: false, labels: false }]);
  assert.deepEqual(detailsRead, []);
});
