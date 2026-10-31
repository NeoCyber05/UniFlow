import assert from "node:assert/strict";
import { test } from "node:test";
import { skeletonForPath } from "@/components/view-skeleton";

test("layouts pick the skeleton the routed view will show", () => {
  assert.equal(skeletonForPath("/board/b1"), "columns");
  assert.equal(skeletonForPath("/board/b1/calendar"), "grid");
  assert.equal(skeletonForPath("/board/b1/graph"), "canvas");
  assert.equal(skeletonForPath("/board/b1/analytics"), "panels");
  assert.equal(skeletonForPath("/board/b1/list"), "rows");
  assert.equal(skeletonForPath("/board/b1/timeline"), "rows");
  assert.equal(skeletonForPath("/pages/p1"), "doc");
  assert.equal(skeletonForPath("/my/today"), "rows");
});
