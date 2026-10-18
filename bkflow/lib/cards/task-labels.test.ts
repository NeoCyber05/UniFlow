import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_LABEL_COLOR, partitionTaskLabels, safeLabelColor, type TaskLabel } from "./task-labels";

const make = (n: number): TaskLabel[] =>
  Array.from({ length: n }, (_, i) => ({ id: `l${i}`, title: `Nhãn ${i}`, color: "#ff0000" }));

test("keeps a stable overflow without merging equal titles", () => {
  assert.equal(partitionTaskLabels(make(5), 2).hidden.length, 3);
  assert.equal(partitionTaskLabels(make(5), 1).hidden.length, 4);
  const same = [
    { id: "a", title: "Quiz", color: "#fff" },
    { id: "b", title: "Quiz", color: "#000" },
  ];
  assert.equal(partitionTaskLabels(same, 2).visible.length, 2);
});

test("handles 0/1/2 labels without hidden", () => {
  for (const n of [0, 1, 2]) {
    const r = partitionTaskLabels(make(n), 2);
    assert.equal(r.visible.length, n);
    assert.equal(r.hidden.length, 0);
  }
});

test("drops duplicate ids and keeps order", () => {
  const dup = [...make(2), ...make(2)];
  const r = partitionTaskLabels(dup, 5);
  assert.deepEqual(r.visible.map((l) => l.id), ["l0", "l1"]);
});

test("falls back to default token for invalid colors", () => {
  assert.equal(safeLabelColor("#abc"), "#abc");
  assert.equal(safeLabelColor("#A1B2C3"), "#A1B2C3");
  for (const bad of ["red", "url(x)", "#12", "", "#ggg111", "expression(1)"]) {
    assert.equal(safeLabelColor(bad), DEFAULT_LABEL_COLOR);
  }
});
