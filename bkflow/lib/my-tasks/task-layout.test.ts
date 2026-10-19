import assert from "node:assert/strict";
import { it } from "node:test";
import { getTaskLayoutHref } from "./task-layout";

it("uses the existing row and column routes without an empty query", () => {
  assert.equal(getTaskLayoutHref("board-1", "rows"), "/board/board-1/list");
  assert.equal(getTaskLayoutHref("board-1", "columns", "?task=task-1"), "/board/board-1");
});

it("preserves filters and grouping while clearing every task-panel parameter", () => {
  const search = "?course=math&course=physics&important=1&group=agenda&task=t1&task=t2&cardId=c1&checklistItemId=i1";
  for (const layout of ["rows", "columns"] as const) {
    const href = getTaskLayoutHref("board-1", layout, search);
    const url = new URL(href, "https://uniflow.test");
    assert.equal(url.pathname, layout === "rows" ? "/board/board-1/list" : "/board/board-1");
    assert.deepEqual([...url.searchParams], [["course", "math"], ["course", "physics"], ["important", "1"], ["group", "agenda"]]);
  }
});
