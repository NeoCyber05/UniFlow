/* eslint-disable @typescript-eslint/no-explicit-any -- Exercise tool schemas and the actual MCP boundary without real accounts. */
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { createAppTools } from "./app-tools";
import { READ_TOOLS } from "./policy";
import { callAppTool } from "@/lib/connectors/composio";

afterEach(() => { mock.restoreAll(); delete process.env.COMPOSIO_API_KEY; });

const cases: [string, Record<string, unknown>, string, Record<string, unknown>][] = [
  ["listClassroomCourses", {}, "GOOGLE_CLASSROOM_COURSES_LIST", { pageSize: 20 }],
  ["listClassroomCoursework", { courseId: "course", pageToken: "next" }, "GOOGLE_CLASSROOM_COURSE_WORK_LIST", { courseId: "course", pageToken: "next", pageSize: 20 }],
  ["listOutlookEmails", {}, "OUTLOOK_LIST_MESSAGES", { user_id: "me", top: 10 }],
  ["readOutlookEmail", { id: "mail" }, "OUTLOOK_GET_MESSAGE", { user_id: "me", message_id: "mail" }],
  ["listGoogleCalendarEvents", { timeMin: "2026-11-16T00:00:00+07:00", timeMax: "2026-11-17T00:00:00+07:00", query: "meeting" }, "GOOGLECALENDAR_EVENTS_LIST", { calendarId: "primary", query: "meeting", maxResults: 20, singleEvents: true, orderBy: "startTime" }],
  ["getGoogleCalendarBusy", { timeMin: "2026-11-16T00:00:00Z", timeMax: "2026-11-17T00:00:00Z" }, "GOOGLECALENDAR_FREE_BUSY_QUERY", { items: [{ id: "primary" }] }],
  ["searchNotionPages", { query: "Project" }, "NOTION_SEARCH_NOTION_PAGE", { query: "Project", page_size: 20 }],
  ["readNotionBlocks", { blockId: "page", cursor: "next" }, "NOTION_FETCH_BLOCK_CONTENTS", { block_id: "page", start_cursor: "next", page_size: 20 }],
  ["searchTeamsMessages", { query: "deadline", offset: 20 }, "MICROSOFT_TEAMS_SEARCH_MESSAGES", { query: "deadline", size: 20, from_index: 20 }],
  ["searchJiraIssues", {}, "JIRA_SEARCH_ISSUES", { jql: "assignee = currentUser() AND resolution = Unresolved", max_results: 20 }],
  ["listTrelloBoards", {}, "TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER", { idMember: "me", filter: "open" }],
  ["listTrelloCards", { boardId: "board" }, "TRELLO_GET_BOARDS_CARDS_BY_ID_BOARD", { idBoard: "board", filter: "open", limit: "20" }],
  ["listGoogleTaskLists", {}, "GOOGLETASKS_LIST_TASK_LISTS", { maxResults: 20 }],
  ["listGoogleTasks", { pageToken: "next" }, "GOOGLETASKS_LIST_TASKS", { tasklist_id: "@default", maxResults: 20, showCompleted: false, showDeleted: false, pageToken: "next" }],
];

test("all eight adapters call the current read-only Composio tools with validated parameters", async () => {
  process.env.COMPOSIO_API_KEY = "test";
  let call: any;
  let longResponse = false;
  mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith("/tool_router/session")) {
      assert.equal(JSON.parse(String(init?.body)).user_id, "uniflow_adapter-test");
      return Response.json({ session_id: "adapters", mcp: { url: "https://mcp.composio.dev/adapters" } });
    }
    const body = JSON.parse(String(init?.body));
    if (body.method !== "tools/call") return Response.json({ id: body.id, result: {} });
    call = body.params.arguments.tools[0];
    return Response.json({ id: "uf-call", result: { content: [{ type: "text", text: JSON.stringify({ successful: true, data: { results: [{ tool_slug: call.tool_slug, response: { successful: true, data: { items: [{ title: longResponse ? "x".repeat(20000) : "deadline" }], nextPageToken: "next" } } }] } }) }] } });
  });
  const tools = createAppTools("adapter-test") as any;
  for (const [name, input, slug, expected] of cases) {
    assert.ok(tools[name], name);
    assert.ok(READ_TOOLS.has(name), `${name} must be a read tool`);
    const args = tools[name].inputSchema.parse(input);
    const output = await tools[name].execute(args, {});
    assert.equal(call.tool_slug, slug);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(call.arguments[key], value, `${name}.${key}`);
    assert.equal(output.ok, true);
    assert.equal(JSON.parse(output.result).nextPageToken, "next");
  }
  longResponse = true;
  const output = await tools.listGoogleTasks.execute(tools.listGoogleTasks.inputSchema.parse({}), {});
  assert.equal(output.truncated, true);
  assert.equal(output.result.length, 12000);
});

test("external writes and malformed calendar ranges cannot execute", async () => {
  const tools = createAppTools("validation") as any;
  for (const name of ["listGoogleCalendarEvents", "getGoogleCalendarBusy"]) {
    assert.equal(tools[name]?.inputSchema.safeParse({ timeMin: "2026-11-17T00:00:00Z", timeMax: "2026-11-16T00:00:00Z" }).success, false);
    assert.equal(tools[name]?.inputSchema.safeParse({ timeMin: "2026-11-16", timeMax: "2026-11-17" }).success, false);
  }
  for (const slug of ["NOTION_UPDATE_PAGE", "JIRA_CREATE_ISSUE", "GOOGLETASKS_INSERT_TASK", "OUTLOOK_SEND_EMAIL", "INSTAGRAM_GET_CONVERSATION"]) {
    await assert.rejects(callAppTool("validation", slug, {}), /không được phép/);
  }
});

test("missing connections stay errors instead of empty task lists", async () => {
  const tools = createAppTools("failure") as any;
  const output = await tools.listGoogleTasks?.execute(tools.listGoogleTasks.inputSchema.parse({}), {});
  assert.equal(output?.ok, false);
  assert.match(output.error, /Google Tasks/);
});
