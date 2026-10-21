import assert from "node:assert/strict";
import { test } from "node:test";

import type { BoardTimelineCard } from "@/types";

import { applyCustomOrder, buildPriorityPlan } from "./graph-priority";

const NOW = new Date("2026-10-21T08:00:00Z");
const dep = (cardId: string) => ({ id: `d-${cardId}`, cardId }) as BoardTimelineCard["blockedByDependencies"][number];

const card = (id: string, extra: Partial<BoardTimelineCard> & { after?: string[]; before?: string[] } = {}) =>
  ({
    id, title: id, order: 0, listOrder: 0, isCompleted: false, dueDate: null, isImportant: false,
    blockedByDependencies: (extra.after ?? []).map(dep),
    blockingDependencies: (extra.before ?? []).map(dep),
    ...extra,
  }) as BoardTimelineCard;

test("only unblocked open tasks are ready; blocked ones list what they wait on", () => {
  const plan = buildPriorityPlan([
    card("a", { before: ["b"] }),
    card("b", { after: ["a"] }),
    card("done", { isCompleted: true, before: ["c"] }),
    card("c", { after: ["done"] }),
  ], NOW);
  assert.deepEqual(plan.ready.map((t) => t.card.id).sort(), ["a", "c"]);
  assert.deepEqual(plan.waiting.map((t) => [t.card.id, t.waitingOn.map((w) => w.id)]), [["b", ["a"]]]);
});

test("overdue beats the long chain, which beats a task unlocking nothing", () => {
  const plan = buildPriorityPlan([
    card("solo"),
    card("head", { before: ["mid"] }),
    card("mid", { after: ["head"], before: ["tail"] }),
    card("tail", { after: ["mid"] }),
    card("late", { dueDate: "2026-10-19T00:00:00Z" }),
  ], NOW);
  assert.deepEqual(plan.ready.map((t) => t.card.id), ["late", "head", "solo"]);
  assert.deepEqual(plan.criticalPath, ["head", "mid", "tail"]);
  assert.equal(plan.ready[1].unlocks, 2);
  assert.equal(plan.ready[0].reasons[0].kind, "overdue");
});

test("custom AI order re-ranks, drops finished tasks and appends newly unlocked ones", () => {
  const { ready } = buildPriorityPlan([card("a"), card("b"), card("c")], NOW);
  const ordered = applyCustomOrder(ready, [
    { cardId: "c", reason: "Ôn thi trước" },
    { cardId: "gone", reason: "đã xong" },
    { cardId: "a", reason: "Nhanh" },
  ]);
  assert.deepEqual(ordered.map((t) => [t.card.id, t.rank, t.unranked]), [["c", 1, false], ["a", 2, false], ["b", 3, true]]);
  assert.equal(ordered[0].aiReason, "Ôn thi trước");
});

test("a dependency cycle does not hang and leaves nothing ready from it", () => {
  const plan = buildPriorityPlan([card("x", { after: ["y"], before: ["y"] }), card("y", { after: ["x"], before: ["x"] })], NOW);
  assert.equal(plan.ready.length, 0);
  assert.equal(plan.waiting.length, 2);
});
