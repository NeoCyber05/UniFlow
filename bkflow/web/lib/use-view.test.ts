import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import { prefetchRouteViews } from "./prefetch-route";
import { viewQueryOptions } from "./use-view";

test("dashboard preferences from different accounts never share a fresh cache entry", () => {
  assert.notDeepEqual(viewQueryOptions("/dashboard", "a").queryKey, viewQueryOptions("/dashboard", "b").queryKey);
});

test("list navigation prefetches metadata and the canonical task query in parallel", () => {
  const client = new QueryClient();
  const keys: unknown[] = [];
  client.prefetchQuery = async (options) => { keys.push(options.queryKey); };

  prefetchRouteViews(client, "/board/demo/list", "?group=list");

  assert.deepEqual(keys, [
    ["view", "/board/demo/layout"],
    ["view", "/board/demo/list"],
    ["my-tasks", "todo", "demo"],
  ]);
});

test("calendar prefetch uses the day from a direct link", () => {
  const client = new QueryClient();
  const keys: (readonly unknown[])[] = [];
  client.prefetchQuery = async (options) => { keys.push(options.queryKey); };

  prefetchRouteViews(client, "/board/demo/calendar", "?view=day&date=2026-06-01");

  const range = keys.find((key) => key[0] === "board-calendar");
  assert.deepEqual(range?.slice(-3), ["day", "2026-05-31T17:00:00.000Z", "2026-06-01T17:00:00.000Z"]);
});

test("board prefetch and mounted view share one request and fresh cache", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (url, init) => {
    requests++;
    assert.equal(url, "/api/views/board/demo/list");
    assert.equal(init?.credentials, "include");
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response(superjson.stringify({ lists: [], now: new Date(0) }));
  };
  const client = new QueryClient();
  try {
    const options = viewQueryOptions<{ lists: unknown[]; now: Date }>("/board/demo/list");
    await Promise.all([client.prefetchQuery(options), client.fetchQuery(options)]);
    const data = await client.fetchQuery(options);
    assert.equal(requests, 1);
    assert.equal(data.now.getTime(), 0);
  } finally {
    client.clear();
    globalThis.fetch = originalFetch;
  }
});
