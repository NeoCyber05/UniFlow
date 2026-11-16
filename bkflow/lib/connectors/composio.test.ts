import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { authorizeApp, callAppTool, connectedApps, CONNECTOR_APPS, isConnectorApp, emailsFromData, parseMcpResponse, toolData, trustedComposioUrl } from "./composio";

afterEach(() => {
  mock.restoreAll();
  delete process.env.COMPOSIO_API_KEY;
});

const multiExecuteFrame = (response: unknown) => ({
  id: "uf-call",
  result: {
    content: [{
      type: "text",
      text: JSON.stringify({ successful: true, data: { results: [{ tool_slug: "GMAIL_FETCH_EMAILS", response }] } }),
    }],
  },
});

test("trustedComposioUrl chỉ nhận https của composio.dev", () => {
  assert.equal(trustedComposioUrl("https://connect.composio.dev/link/abc"), "https://connect.composio.dev/link/abc");
  assert.throws(() => trustedComposioUrl("https://evil.example/link"), /không tin cậy/);
  assert.throws(() => trustedComposioUrl("http://connect.composio.dev/link"), /không tin cậy/);
  assert.throws(() => trustedComposioUrl("https://composio.dev.evil.example/x"), /không tin cậy/);
  assert.throws(() => trustedComposioUrl(undefined), /không trả về/);
});

test("parseMcpResponse đọc JSON thường và khung SSE, bỏ khung sai id", () => {
  assert.deepEqual(parseMcpResponse('{"id":"a","result":{"x":1}}', "a"), { id: "a", result: { x: 1 } });
  assert.equal(parseMcpResponse('{"id":"b","result":{}}', "a"), null);
  const sse = 'event: message\ndata: {"id":"other","result":{}}\n\ndata: {"id":"a","result":{"x":2}}\n\n';
  assert.deepEqual(parseMcpResponse(sse, "a"), { id: "a", result: { x: 2 } });
  assert.equal(parseMcpResponse("", "a"), null);
});

test("parseMcpResponse trả lỗi id:null, bỏ [DONE], JSON hỏng thì null", () => {
  const diag = '{"jsonrpc":"2.0","id":null,"error":{"code":-32001,"message":"session not found"}}';
  assert.deepEqual(parseMcpResponse(diag, "a"), { error: { code: -32001, message: "session not found" } });
  assert.deepEqual(parseMcpResponse(`data: ${diag}\n\ndata: [DONE]\n\n`, "a"), { error: { code: -32001, message: "session not found" } });
  assert.deepEqual(parseMcpResponse('data: {"id":"a","result":{"x":3}}\n\ndata: [DONE]\n\n', "a"), { id: "a", result: { x: 3 } });
  assert.equal(parseMcpResponse('{"id":"a",', "a"), null);
  assert.throws(() => toolData("GMAIL_FETCH_EMAILS", parseMcpResponse(diag, "uf-call")), /session not found/);
});

test("toolData lấy data của đúng tool trong multi-execute", () => {
  const data = toolData("GMAIL_FETCH_EMAILS", multiExecuteFrame({ successful: true, data: { messages: [] } }));
  assert.deepEqual(data, { messages: [] });
});

test("toolData ném lỗi khi tool thất bại hoặc không có câu trả lời", () => {
  assert.throws(() => toolData("GMAIL_FETCH_EMAILS", multiExecuteFrame({ successful: false, error: "No connected account" })), /No connected account/);
  assert.throws(() => toolData("GMAIL_FETCH_EMAILS", null), /no answer/);
  assert.throws(() => toolData("GMAIL_FETCH_EMAILS", { id: "uf-call", error: { message: "boom" } }), /boom/);
});

test("emailsFromData chuẩn hóa thư Gmail", () => {
  const emails = emailsFromData({
    messages: [{
      messageId: "m1", threadId: "t1", messageTimestamp: "2026-11-13T02:00:00Z",
      sender: "Thầy A <a@hust.edu.vn>", subject: "Nộp  báo cáo", preview: { body: "Hạn thứ 6" },
    }],
  });
  assert.deepEqual(emails, [{
    id: "m1", threadId: "t1", at: Date.parse("2026-11-13T02:00:00Z"),
    from: "Thầy A <a@hust.edu.vn>", subject: "Nộp báo cáo", preview: "Hạn thứ 6",
  }]);
  assert.throws(() => emailsFromData({ nope: true }), /no message list/);
});

test("callAppTool từ chối công cụ ngoài danh sách chỉ đọc", async () => {
  process.env.COMPOSIO_API_KEY = "ak_test";
  const fetchMock = mock.method(globalThis, "fetch", async () => Response.json({}));
  await assert.rejects(callAppTool("user-x", "GMAIL_SEND_EMAIL", {}), /không được phép/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("callAppTool mở MCP, gửi initialized rồi gọi multi-execute", async () => {
  process.env.COMPOSIO_API_KEY = "ak_test";
  const mcpCalls: { method: string; transport: string | null; body: Record<string, unknown> }[] = [];
  mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith("/tool_router/session")) {
      return Response.json({ session_id: "s-main", mcp: { url: "https://mcp.composio.dev/x" } });
    }
    assert.equal(String(url), "https://mcp.composio.dev/x");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    mcpCalls.push({ method: String(body.method), transport: new Headers(init?.headers).get("mcp-session-id"), body });
    if (body.method === "initialize") return Response.json({ id: "uf-init", result: {} }, { headers: { "mcp-session-id": "t1" } });
    if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
    return Response.json(multiExecuteFrame({ successful: true, data: { messages: [{ id: "m1" }] } }));
  });

  assert.deepEqual(await callAppTool("user-main", "GMAIL_FETCH_EMAILS", { max_results: 5 }), { messages: [{ id: "m1" }] });
  assert.deepEqual(mcpCalls.map((call) => call.method), ["initialize", "notifications/initialized", "tools/call"]);
  assert.deepEqual(mcpCalls.map((call) => call.transport), [null, "t1", "t1"]);
  const params = mcpCalls[2].body.params as { name: string; arguments: { tools: { tool_slug: string }[] } };
  assert.equal(params.name, "COMPOSIO_MULTI_EXECUTE_TOOL");
  assert.equal(params.arguments.tools[0].tool_slug, "GMAIL_FETCH_EMAILS");
});

test("callAppTool bỏ Session đã cache khi tools/call trả 404", async () => {
  process.env.COMPOSIO_API_KEY = "ak_test";
  let sessionCreates = 0;
  mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith("/tool_router/session")) {
      sessionCreates++;
      return Response.json({ session_id: `s-404-${sessionCreates}`, mcp: { url: "https://mcp.composio.dev/y" } });
    }
    const method = (JSON.parse(String(init?.body)) as { method: string }).method;
    if (method === "tools/call") return new Response("gone", { status: 404 });
    return Response.json({ id: "uf-init", result: {} }, { headers: { "mcp-session-id": "t2" } });
  });

  await assert.rejects(callAppTool("user-404", "GMAIL_FETCH_EMAILS", {}), /HTTP 404/);
  await assert.rejects(callAppTool("user-404", "GMAIL_FETCH_EMAILS", {}), /HTTP 404/);
  assert.equal(sessionCreates, 2);
});

test("authorizeApp tạo Session theo user rồi trả link đã kiểm tra", async () => {
  process.env.COMPOSIO_API_KEY = "ak_test";
  const calls: { url: string; body: string }[] = [];
  mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? "") });
    if (String(url).endsWith("/tool_router/session")) {
      return Response.json({ session_id: "s1", mcp: { url: "https://mcp.composio.dev/s1" } });
    }
    return Response.json({ redirect_url: "https://connect.composio.dev/link/abc" });
  });

  assert.equal(await authorizeApp("user-a", "gmail"), "https://connect.composio.dev/link/abc");
  assert.match(calls[0].body, /"user_id":"uniflow_user-a"/);
  assert.equal(calls[1].url, "https://backend.composio.dev/api/v3.1/tool_router/session/s1/link");
  assert.equal(calls[1].body, '{"toolkit":"gmail"}');
});

test("authorizeApp từ chối link ngoài composio.dev", async () => {
  process.env.COMPOSIO_API_KEY = "ak_test";
  mock.method(globalThis, "fetch", async (url: string | URL | Request) =>
    String(url).endsWith("/tool_router/session")
      ? Response.json({ session_id: "s2", mcp: { url: "https://mcp.composio.dev/s2" } })
      : Response.json({ redirect_url: "https://evil.example/phish" }));
  await assert.rejects(authorizeApp("user-b", "gmail"), /không tin cậy/);
});

test("thiếu COMPOSIO_API_KEY thì báo chưa cấu hình", async () => {
  await assert.rejects(authorizeApp("user-c", "gmail"), /chưa cấu hình/);
});

test("selected productivity apps support OAuth and inventory; Instagram/Discord remain disabled", async () => {
  const apps = ["gmail", "slack", "google_classroom", "outlook", "googlecalendar", "notion", "microsoft_teams", "jira", "trello", "googletasks"];
  assert.deepEqual([...CONNECTOR_APPS].sort(), [...apps].sort());
  assert.equal(isConnectorApp("instagram"), false);
  assert.equal(isConnectorApp("discord"), false);
  process.env.COMPOSIO_API_KEY = "test";
  const linked: string[] = [];
  mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith("/tool_router/session")) return Response.json({ session_id: "expanded", mcp: { url: "https://mcp.composio.dev/expanded" } });
    if (path.endsWith("/link")) {
      linked.push(JSON.parse(String(init?.body)).toolkit);
      return Response.json({ redirect_url: "https://connect.composio.dev/link/test" });
    }
    assert.deepEqual(new URL(path).searchParams.get("toolkits")?.split(",").sort(), [...apps].sort());
    return Response.json({ items: apps.map((slug) => ({ slug, connected_account: { id: slug, status: slug === "outlook" ? "EXPIRED" : "ACTIVE" } })) });
  });
  for (const app of CONNECTOR_APPS) await authorizeApp("expanded-user", app);
  assert.deepEqual(linked, [...CONNECTOR_APPS]);
  const inventory = await connectedApps("expanded-user");
  assert.deepEqual(Object.keys(inventory).sort(), [...apps].sort());
  assert.equal(inventory.outlook, false);
  assert.equal(inventory.notion, true);
});
