import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { loadConnectorCatalog, normalizeCatalogItems } from "./catalog";

afterEach(() => {
  mock.restoreAll();
  delete process.env.COMPOSIO_API_KEY;
});

let keyCounter = 0;
// Mỗi test một key riêng để cache theo key không rò giữa các test.
const freshKey = () => { process.env.COMPOSIO_API_KEY = `test-key-${++keyCounter}`; };

const page = (items: unknown[], next_cursor: string | null = null) =>
  new Response(JSON.stringify({ items, next_cursor }), { status: 200, headers: { "content-type": "application/json" } });

test("normalizeCatalogItems dedupe slug, suy capability từ allowlist đọc", () => {
  const cards = normalizeCatalogItems([
    { slug: "gmail", name: "Gmail", meta: { description: "Read mail" } },
    { slug: "notion", name: "Notion" },
    { slug: "gmail", name: "Duplicate" },
  ]);
  assert.deepEqual(cards.map((x) => [x.slug, x.taskReadSupported]), [["gmail", true], ["notion", false]]);
  assert.equal(cards[0].description, "Read mail");
});

test("normalizeCatalogItems lọc slug sai, logo không an toàn, cắt mô tả", () => {
  const cards = normalizeCatalogItems([
    { slug: "Bad Slug", name: "x" },
    { slug: "evil", name: "Evil", meta: { logo: "javascript:alert(1)", description: "<b>x</b>".repeat(100) } },
    { slug: "odd", name: 42, meta: { logo: 7 } },
    { slug: "ok", name: "OK", meta: { logo: "https://logos.composio.dev/ok.png" } },
    null,
    "string",
  ]);
  assert.deepEqual(cards.map((x) => x.slug), ["evil", "odd", "ok"]);
  assert.equal(cards[0].logoUrl, null);
  assert.ok(cards[0].description.length <= 160);
  assert.equal(cards[1].name, "odd");
  assert.equal(cards[1].logoUrl, null);
  assert.equal(cards[2].logoUrl, "https://logos.composio.dev/ok.png");
});

test("loadConnectorCatalog nối cursor hai trang, dedupe → complete", async () => {
  freshKey();
  const urls: string[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL) => {
    const url = String(input);
    urls.push(url);
    return new URL(url).searchParams.get("cursor") === "b"
      ? page([{ slug: "notion", name: "Notion" }, { slug: "gmail", name: "Gmail again" }])
      : page([{ slug: "gmail", name: "Gmail" }, { slug: "slack", name: "Slack" }], "b");
  });
  const catalog = await loadConnectorCatalog();
  assert.deepEqual(catalog.items.map((x) => x.slug), ["gmail", "slack", "notion"]);
  assert.equal(catalog.complete, true);
  assert.equal(catalog.source, "composio");
  assert.equal(urls.length, 2);
  assert.ok(urls.every((url) => url.startsWith("https://backend.composio.dev/api/v3/toolkits")));
});

test("cursor lặp → giữ item đã nhận, partial", async () => {
  freshKey();
  mock.method(globalThis, "fetch", async () => page([{ slug: "gmail", name: "Gmail" }, { slug: "slack", name: "Slack" }], "same"));
  const catalog = await loadConnectorCatalog();
  assert.deepEqual(catalog.items.map((x) => x.slug), ["gmail", "slack"]);
  assert.equal(catalog.complete, false);
});

test("trang sau HTTP 500 → giữ item đã nhận, partial, không cache", async () => {
  freshKey();
  let calls = 0;
  mock.method(globalThis, "fetch", async (input: string | URL) => {
    calls++;
    return new URL(String(input)).searchParams.get("cursor") ? new Response("boom", { status: 500 }) : page([{ slug: "linear", name: "Linear" }], "b");
  });
  const catalog = await loadConnectorCatalog();
  assert.equal(catalog.complete, false);
  assert.ok(catalog.items.some((x) => x.slug === "linear"));
  await loadConnectorCatalog();
  assert.equal(calls, 4, "partial không được cache");
});

test("partial chỉ có Notion vẫn bổ sung Gmail/Slack", async () => {
  freshKey();
  mock.method(globalThis, "fetch", async (input: string | URL) =>
    new URL(String(input)).searchParams.get("cursor") ? new Response("x", { status: 500 }) : page([{ slug: "notion", name: "Notion" }], "b"));
  const catalog = await loadConnectorCatalog();
  const slugs = catalog.items.map((x) => x.slug);
  assert.ok(slugs.includes("gmail") && slugs.includes("slack") && slugs.includes("notion"));
  assert.equal(catalog.items.find((x) => x.slug === "gmail")?.taskReadSupported, true);
});

test("không có key → fallback 8 app, chỉ Gmail/Slack supported, không gọi mạng", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new Error("must not fetch"); });
  const catalog = await loadConnectorCatalog();
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(catalog.source, "fallback");
  assert.equal(catalog.complete, false);
  assert.deepEqual(
    catalog.items.map((x) => x.slug).sort(),
    ["github", "gmail", "googlecalendar", "googledrive", "jira", "linear", "notion", "slack"],
  );
  assert.deepEqual(catalog.items.filter((x) => x.taskReadSupported).map((x) => x.slug).sort(), ["gmail", "slack"]);
});

test("API lỗi trang đầu → fallback", async () => {
  freshKey();
  mock.method(globalThis, "fetch", async () => new Response("down", { status: 503 }));
  const catalog = await loadConnectorCatalog();
  assert.equal(catalog.source, "fallback");
  assert.equal(catalog.items.length, 8);
});

test("kết quả complete được cache theo key", async () => {
  freshKey();
  const fetchMock = mock.method(globalThis, "fetch", async () => page([{ slug: "gmail", name: "Gmail" }, { slug: "slack", name: "Slack" }]));
  await loadConnectorCatalog();
  await loadConnectorCatalog();
  assert.equal(fetchMock.mock.callCount(), 1);
  freshKey();
  await loadConnectorCatalog();
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("filterCatalog tìm không phân biệt hoa thường, lọc đã kết nối, sắp ưu tiên", async () => {
  const { filterCatalog } = await import("./catalog-shared");
  const items = normalizeCatalogItems([
    { slug: "notion", name: "Notion" }, { slug: "slack", name: "Slack" }, { slug: "gmail", name: "Gmail" }, { slug: "asana", name: "Asana" },
  ]);
  const isConnected = (slug: string) => slug === "gmail";
  assert.deepEqual(filterCatalog(items, { query: "", filter: "all", isConnected }).map((x) => x.slug), ["gmail", "slack", "asana", "notion"]);
  assert.deepEqual(filterCatalog(items, { query: "NOTION", filter: "all", isConnected }).map((x) => x.slug), ["notion"]);
  assert.deepEqual(filterCatalog(items, { query: "", filter: "connected", isConnected }).map((x) => x.slug), ["gmail"]);
  assert.deepEqual(filterCatalog(items, { query: "zzz", filter: "all", isConnected }), []);
});
