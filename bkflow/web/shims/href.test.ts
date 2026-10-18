import { test } from "node:test";
import assert from "node:assert/strict";

import { toHref } from "./href";

test("toHref accepts strings and Next-style url objects", () => {
  assert.equal(toHref("/board/1"), "/board/1");
  assert.equal(toHref({ pathname: "/my/today", query: { task: "c1" } }), "/my/today?task=c1");
});
