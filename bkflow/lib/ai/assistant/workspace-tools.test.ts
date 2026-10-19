/* eslint-disable @typescript-eslint/no-explicit-any -- Database doubles exercise real tools and actions without a live database. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test, mock } from "node:test";
import Pusher from "pusher";
import type { PrismaClient } from "@prisma/client";

import { runWithAuth } from "@/server/auth";
import { BoardMemberRole } from "@/types";
import { toAppUser } from "@/lib/auth/app-user";
import type { AssistantSession } from "./board-data";
import { createAssistantTools } from "./tools";
import { createChecklistItemTool } from "./checklist-tool";
import { GET as searchRoute } from "@/server/routes/search/route";

const session: AssistantSession = { boardId: "b1", userId: "u1", role: BoardMemberRole.ADMIN, timeZone: "Asia/Ho_Chi_Minh" };
// Lệnh sửa nội dung từ UI trên đúng thẻ đang mở: policy direct-with-undo cho phép chạy công cụ.
const editing: AssistantSession = { ...session, context: { kind: "task", cardId: "c1", expectedUpdatedAt: "2026-10-18T00:00:00.000Z" }, operation: "edit_task_content" };
const previousDb = globalThis.prisma;
let database: Record<string, any>;
let auditWrites = 0;

beforeEach(() => {
  auditWrites = 0;
  mock.method(Pusher.prototype, "trigger", async () => ({}));
  database = {
    course: { findMany: async () => [] }, semester: {}, aiNoteEdit: {},
    board: { findMany: async () => [], findFirst: async () => ({ id: "b1", userId: "u1", title: "Board" }) },
    card: { findMany: async () => [], findFirst: async () => ({ id: "c1", title: "Report", list: { title: "Todo" } }) },
    notePage: { findMany: async () => [], findFirst: async () => null },
    noteDeadline: { findMany: async () => [] },
    auditLog: { create: async () => { auditWrites += 1; throw new Error("Activity logging has been removed"); } },
  };
  globalThis.prisma = database as unknown as PrismaClient;
});
afterEach(() => { globalThis.prisma = previousDb; mock.restoreAll(); });

const execute = async (name: string, input: unknown, currentSession = session) => {
  const tools = createAssistantTools(currentSession) as Record<string, any>;
  assert.ok(tools[name]?.execute, `Agent must register ${name}`);
  const parsed = tools[name].inputSchema.parse(input);
  return tools[name].execute(parsed, { toolCallId: "test", messages: [] });
};

test("workspace search scopes every source to the authenticated owner and returns usable links", async () => {
  database.card.findMany = async ({ where }: any) => {
    assert.equal(where.list.board.userId, "u1");
    assert.equal(where.archivedAt, null);
    assert.equal(where.list.archivedAt, null);
    return [{ id: "c/1", title: "Network report", list: { title: "Todo", boardId: "b1", board: { title: "Board" } } }];
  };
  database.course.findMany = async ({ where }: any) => { assert.equal(where.board.userId, "u1"); return []; };
  database.board.findMany = async ({ where }: any) => { assert.equal(where.userId, "u1"); return []; };
  database.notePage.findMany = async ({ where }: any) => {
    assert.equal(where.userId, "u1");
    assert.equal(where.deletedAt, null);
    return [{ id: "p1", title: "Network notes" }];
  };
  const result = await execute("searchWorkspace", { query: "Network" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.items.map((item: any) => item.href), ["/board/b1?cardId=c%2F1", "/pages/p1"]);
});

test("workspace search rejects blank queries and returns recoverable database errors", async () => {
  await assert.rejects(() => execute("searchWorkspace", { query: "  " }));
  database.card.findMany = async () => { throw new Error("database unavailable"); };
  const result = await execute("searchWorkspace", { query: "report" });
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test("the shared search route preserves recents order, navigation and private caching", async () => {
  database.notePage.findMany = async ({ where }: any) => {
    assert.equal(where.userId, "u1");
    assert.equal(where.deletedAt, null);
    assert.deepEqual(where.id.in, ["p1", "deleted"]);
    return [{ id: "p1", title: "Notes" }];
  };
  const recent = encodeURIComponent(JSON.stringify([{ type: "page", id: "today" }, { type: "note", id: "p1" }, { type: "note", id: "deleted" }]));
  const response = await runWithAuth({ userId: "u1", user: null }, () => searchRoute(new Request(`http://local/api/search?recent=${recent}`)));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const body = await response.json();
  assert.deepEqual(body.items.map((item: any) => item.id), ["today", "p1"]);
  assert.equal(body.navigation.some((item: any) => item.id === "today"), false);
  assert.equal((await searchRoute(new Request("http://local/api/search?q=Notes"))).status, 401);
});

test("page reads reject someone else's or trashed pages using owner and trash filters", async () => {
  database.notePage.findFirst = async ({ where }: any) => {
    assert.deepEqual(where, { id: "private", userId: "u1", deletedAt: null });
    return null;
  };
  const result = await execute("getPage", { pageId: "private" });
  assert.equal(result.ok, false);
  assert.equal(result.page, undefined);
});

test("page reads expose readable blocks and bounded continuation without losing the source", async () => {
  database.notePage.findFirst = async () => ({
    id: "p1", title: "Notes", updatedAt: new Date("2026-10-18T00:00:00Z"),
    content: JSON.stringify({ version: 1, blocks: [
      { id: "a", type: "heading", level: 1, text: "Network" },
      { id: "b", type: "todo", checked: true, text: "Read chapter" },
      { id: "c", type: "paragraph", text: "x".repeat(9000) },
    ] }),
  });
  const first = await execute("getPage", { pageId: "p1" });
  assert.equal(first.ok, true);
  assert.equal(first.page.href, "/pages/p1");
  assert.match(first.page.content, /Network/);
  assert.match(first.page.content, /\[x\] Read chapter/);
  assert.equal(first.page.content.length, 8000);
  assert.equal(first.nextOffset, 8000);
  const next = await execute("getPage", { pageId: "p1", offset: first.nextOffset });
  assert.equal(next.nextOffset, null);
  assert.ok(next.page.content.length > 0);
});

test("personal agenda merges both sources, sorts deadlines and applies local midnight filters", async () => {
  database.card.findMany = async ({ where, take }: any) => {
    assert.equal(where.list.board.userId, "u1");
    assert.equal(where.list.archivedAt, null);
    assert.equal(where.archivedAt, null);
    assert.equal(where.isCompleted, false);
    assert.equal(where.OR[0].dueDate.gte.toISOString(), "2026-10-17T17:00:00.000Z");
    assert.equal(where.OR[0].dueDate.lt.toISOString(), "2026-10-18T17:00:00.000Z");
    // Hạn chỉ-ngày so theo cột DATE (ngày VN), không so với timestamp UTC.
    assert.equal(where.OR[1].deadlineOn.gte.toISOString(), "2026-10-18T00:00:00.000Z");
    assert.equal(where.OR[1].deadlineOn.lt.toISOString(), "2026-10-19T00:00:00.000Z");
    assert.equal(take, 26);
    return [{ id: "c1", title: "Report", dueDate: new Date("2026-10-18T15:00:00Z"), list: { boardId: "b1", board: { title: "Board" } } }];
  };
  database.noteDeadline.findMany = async ({ where }: any) => {
    assert.equal(where.userId, "u1");
    assert.equal(where.page.userId, "u1");
    assert.equal(where.page.deletedAt, null);
    assert.equal(where.done, false);
    assert.equal(where.dueAt.lt.toISOString(), "2026-10-18T17:00:00.000Z");
    return [{ blockId: "d1", pageId: "p1", title: "Read notes", dueAt: new Date("2026-10-18T14:00:00Z"), page: { title: "Notes" } }];
  };
  // Freeze only Date's clock; date parsing and timezone conversion remain real.
  const { mock } = await import("node:test");
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-18T01:00:00Z") });
  try {
    const result = await execute("getMyAgenda", { range: "today", includeOverdue: false });
    assert.equal(result.ok, true);
    assert.deepEqual(result.items.map((item: any) => item.title), ["Read notes", "Report"]);
    assert.deepEqual(result.items.map((item: any) => item.href), ["/pages/p1", "/board/b1?cardId=c1"]);
    assert.equal(result.truncated, false);
  } finally { mock.timers.reset(); }
});

test("agenda includes overdue work by default and signals bounded results", async () => {
  database.card.findMany = async ({ where }: any) => {
    assert.ok(where.OR[0].dueDate.lt instanceof Date);
    assert.ok(where.OR[1].deadlineOn.lt instanceof Date);
    assert.ok(where.OR[2].dueDate.gte instanceof Date);
    return Array.from({ length: 26 }, (_, index) => ({ id: `c${index}`, title: `Task ${index}`, dueDate: new Date("2020-01-01Z"), list: { boardId: "b1", board: { title: "Board" } } }));
  };
  const result = await execute("getMyAgenda", {});
  assert.equal(result.items.length, 25);
  assert.equal(result.truncated, true);
  assert.equal(result.items[0].isOverdue, true);
});

test("tomorrow's agenda includes overdue work without including today's future deadlines", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-18T01:00:00Z") });
  database.card.findMany = async ({ where }: any) => {
    assert.equal(where.OR[0].dueDate.lt.toISOString(), "2026-10-18T01:00:00.000Z");
    assert.equal(where.OR[2].dueDate.gte.toISOString(), "2026-10-18T17:00:00.000Z");
    assert.equal(where.OR[2].dueDate.lt.toISOString(), "2026-10-19T17:00:00.000Z");
    return [];
  };
  assert.equal((await execute("getMyAgenda", { range: "tomorrow" })).ok, true);
});

test("weekly agenda ends on next Monday in the session timezone", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-18T01:00:00Z") });
  database.card.findMany = async ({ where }: any) => {
    assert.equal(where.OR[0].dueDate.gte.toISOString(), "2026-10-17T04:00:00.000Z");
    assert.equal(where.OR[0].dueDate.lt.toISOString(), "2026-10-19T04:00:00.000Z");
    return [];
  };
  assert.equal((await execute("getMyAgenda", { range: "this_week", includeOverdue: false }, { ...session, timeZone: "America/New_York" })).ok, true);
});

const checklistFixture = () => {
  const item = { id: "i1", title: "Read", isCompleted: false, dueDate: null as Date | null, checklistId: "cl1", checklist: { cardId: "c1", card: { title: "Report", dueDate: new Date("2026-10-20T12:00:00Z"), list: { boardId: "b1" } } } };
  database.checklistItem = {
    findFirst: async ({ where }: any) => {
      assert.equal(where.id, "i1");
      assert.equal(where.checklist.cardId, "c1");
      assert.equal(where.checklist.card.list.board.id, "b1");
      assert.equal(where.checklist.card.list.board.userId, "u1");
      return item;
    },
    update: async ({ data }: any) => { Object.assign(item, data); return item; },
  };
  return item;
};
const signedIn = (callback: () => Promise<any>) => runWithAuth({ userId: "u1", user: toAppUser({ sub: "u1", user_metadata: { full_name: "Student" } }) }, callback);
// Test the underlying normal checklist command separately from the chat proposal gate.
const executeChecklistCommand = async (input: any, scope = editing) => {
  const definition = createChecklistItemTool(scope) as any;
  return definition.execute(definition.inputSchema.parse(input), { toolCallId: "test", messages: [] });
};

test("checklist completion sets the desired state and retries do not toggle it back", async () => {
  const item = checklistFixture();
  await signedIn(async () => {
    const input = { cardId: "c1", itemId: "i1", change: { type: "completed", isCompleted: true } };
    const result = await executeChecklistCommand(input);
    assert.equal(result.ok, true);
    assert.equal(item.isCompleted, true);
    assert.equal(auditWrites, 0);
    assert.equal(result.action, "checklist_item_updated");
    assert.equal(result.card.id, "c1");
    await executeChecklistCommand(input);
    assert.equal(item.isCompleted, true);
  });
});

test("checklist title edits reuse the action while due-date edits only become previews", async () => {
  const item = checklistFixture();
  await signedIn(async () => {
    assert.equal((await executeChecklistCommand({ cardId: "c1", itemId: "i1", change: { type: "title", title: "Read chapter 2" } })).ok, true);
    assert.equal(item.title, "Read chapter 2");
    for (const dueDate of ["2026-10-19T12:00:00+07:00", null]) {
      const result = await execute("updateChecklistItem", { cardId: "c1", itemId: "i1", change: { type: "dueDate", dueDate } }, editing);
      assert.equal(result.action, "proposal");
      assert.equal(result.operation, "set_deadline");
      assert.equal(item.dueDate, null);
    }
  });
});

test("checklist questions and empty titles never change data", async () => {
  const item = checklistFixture();
  await signedIn(async () => {
    // Không có lệnh UI: kể cả sửa tên cũng chỉ là đề xuất.
    const result = await execute("updateChecklistItem", { cardId: "c1", itemId: "i1", change: { type: "title", title: "Other" } });
    assert.equal(result.action, "proposal");
    assert.equal(item.title, "Read");
    await assert.rejects(() => execute("updateChecklistItem", { cardId: "c1", itemId: "i1", change: { type: "title", title: " " } }, editing));
  });
});

test("checklist edits reject viewers, archived cards, wrong identities and foreign boards", async () => {
  const item = checklistFixture();
  const input = { cardId: "c1", itemId: "i1", change: { type: "completed", isCompleted: true } };
  const viewer = await signedIn(() => executeChecklistCommand(input, { ...editing, role: BoardMemberRole.VIEWER }));
  assert.equal(viewer.ok, false);
  assert.equal((await executeChecklistCommand(input)).ok, false);
  await signedIn(async () => {
    database.card.findFirst = async ({ where }: any) => {
      assert.equal(where.archivedAt, null);
      assert.equal(where.list.archivedAt, null);
      assert.equal(where.list.boardId, "b1");
      return null;
    };
    assert.equal((await executeChecklistCommand(input)).ok, false);
    database.card.findFirst = async () => ({ id: "c1", title: "Report" });
    database.board.findFirst = async () => null;
    assert.equal((await executeChecklistCommand(input)).ok, false);
  });
  assert.equal(item.isCompleted, false);
});
