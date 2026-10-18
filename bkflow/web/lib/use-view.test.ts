import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import { viewQueryOptions } from "./use-view";

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
