import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import BoardTimelineRoute from "../routes/board-timeline";

for (const { label, status, cached } of [
  { label: "a failed first timeline load", status: 500, cached: false },
  { label: "a cached timeline that is no longer accessible", status: 403, cached: true },
]) test(`${label} shows retry instead of a loading placeholder`, async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retryOnMount: false } } });
  const queryKey = ["view", "/board/demo/timeline"];
  try {
    if (cached) client.setQueryData(queryKey, { redirect: "/my/today" });
    await client.prefetchQuery({
      queryKey,
      queryFn: async () => { throw Object.assign(new Error("Timeline unavailable"), { status }); },
      staleTime: 0,
      retry: false,
    });
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(MemoryRouter, { initialEntries: ["/board/demo/timeline"] },
        createElement(Routes, null,
          createElement(Route, { path: "/board/:boardId/timeline", element: createElement(BoardTimelineRoute) }),
        ),
      ),
    ));
    assert.match(html, /role="alert"/);
    assert.match(html, /<button[^>]*type="button"/);
    assert.doesNotMatch(html, /aria-busy="true"/);
  } finally {
    client.clear();
  }
});
