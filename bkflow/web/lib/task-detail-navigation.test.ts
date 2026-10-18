import assert from "node:assert/strict";
import { it } from "node:test";

import { withDetailParam } from "./task-detail-navigation";

const before = "view=today&course=c1&date=2026-10-19&important=1&task=t1&cardId=k1";

it("closing detail preserves view filters", () => {
  const after = new URLSearchParams(withDetailParam(before, "task", null));
  assert.equal(after.get("task"), null);
  for (const key of ["view", "course", "date", "important", "cardId"]) {
    assert.equal(after.get(key), new URLSearchParams(before).get(key));
  }
});

it("opening detail adds only the task param", () => {
  const after = new URLSearchParams(withDetailParam("course=c1&view=list", "task", "t9"));
  assert.equal(after.get("task"), "t9");
  assert.equal(after.get("course"), "c1");
  assert.equal(after.get("view"), "list");
});
