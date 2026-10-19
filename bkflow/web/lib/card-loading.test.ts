import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { getCardQueryOptions } from "@/components/modals/card-modal/card-cache-utils";

test("panel prefetch and card body reuse one request and keep tasks separate", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (url) => {
    requests++;
    return Response.json({ id: String(url).split("/").at(-1) });
  };
  // Same freshness window as QueryProvider.
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  try {
    const options = getCardQueryOptions("c1");
    await Promise.all([client.prefetchQuery(options), client.fetchQuery(options)]);
    assert.equal((await client.fetchQuery(options)).id, "c1");
    assert.equal(requests, 1);
    assert.equal((await client.fetchQuery(getCardQueryOptions("c2"))).id, "c2");
    assert.equal(requests, 2);
    assert.ok(typeof options.retry === "function");
    assert.equal(options.retry(0, Object.assign(new Error(), { status: 403 })), false);
    assert.equal(options.retry(0, Object.assign(new Error(), { status: 404 })), false);
  } finally {
    client.clear();
    globalThis.fetch = originalFetch;
  }
});
