import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

import { invalidateTaskWrite } from "./invalidate-after-write";

test("a card write refreshes its task data and leaves board metadata and other boards warm", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity } } });
  const refreshed: string[] = [];
  const copyOptions = ["card-copy-options", "card-b"];
  const activeKeys = [
    ["my-tasks", "todo", "board-a"],
    ["my-tasks", "counts"],
    ["my-tasks", "context"],
    ["my-tasks", "todo", "board-b"],
    ["board-calendar", "board-a", "range", "week"],
    ["board-calendar", "board-a", "unscheduled"],
    ["card", "card-a"],
    ["card", "card-b"],
    ["view", "/board/board-a/layout"],
    ["view", "/board/board-a/list"],
    ["view", "/dashboard", "user"],
    copyOptions,
  ];
  const graph = ["view", "/board/board-a/graph"];
  client.setQueryData(graph, {});
  const unsubscribe = activeKeys.map((queryKey) => {
    client.setQueryData(queryKey, {});
    return new QueryObserver(client, {
      queryKey,
      queryFn: async () => {
        refreshed.push(queryKey.join("/"));
        return {};
      },
    }).subscribe(() => {});
  });

  try {
    await invalidateTaskWrite(client, "board-a", { cardId: "card-a", counts: true });
    assert.deepEqual(refreshed.sort(), [
      "board-calendar/board-a/range/week",
      "board-calendar/board-a/unscheduled",
      "card/card-a",
      "my-tasks/counts",
      "my-tasks/todo/board-a",
    ]);
    assert.equal(client.getQueryState(graph)?.isInvalidated, true);
    assert.equal(client.getQueryState(copyOptions)?.isInvalidated, false);

    refreshed.length = 0;
    await invalidateTaskWrite(client, "board-a", { cardId: "card-a", change: "my-day", counts: true });
    assert.deepEqual(refreshed.sort(), ["card/card-a", "my-tasks/counts", "my-tasks/todo/board-a"]);

    refreshed.length = 0;
    await invalidateTaskWrite(client, "board-a", { cardId: "card-a", change: "important" });
    assert.deepEqual(refreshed.sort(), [
      "board-calendar/board-a/range/week",
      "board-calendar/board-a/unscheduled",
      "card/card-a",
      "my-tasks/todo/board-a",
    ]);

    refreshed.length = 0;
    await invalidateTaskWrite(client, "board-a", { cardId: "card-a", change: "checklist-date" });
    assert.deepEqual(refreshed.sort(), ["board-calendar/board-a/range/week", "card/card-a"]);

    refreshed.length = 0;
    await invalidateTaskWrite(client, "board-a", { cardId: "card-a", positions: true });
    assert.equal(client.getQueryState(copyOptions)?.isInvalidated, true);
    assert.equal(refreshed.includes("card-copy-options/card-b"), false);
  } finally {
    unsubscribe.forEach((dispose) => dispose());
    client.clear();
  }
});
