import assert from "node:assert/strict";
import { test } from "node:test";

import type { BoardTimelineCard } from "@/types";

import { buildPriorityPlan, buildSchedule } from "./graph-priority";

const NOW = new Date("2026-10-21T08:00:00Z");
const dep = (cardId: string) => ({ id: `d-${cardId}`, cardId }) as BoardTimelineCard["blockedByDependencies"][number];

const card = (id: string, extra: Partial<BoardTimelineCard> & { after?: string[]; before?: string[] } = {}) =>
  ({
    id, title: id, order: 0, listOrder: 0, isCompleted: false, dueDate: null, isImportant: false,
    blockedByDependencies: (extra.after ?? []).map(dep),
    blockingDependencies: (extra.before ?? []).map(dep),
    ...extra,
  }) as BoardTimelineCard;

const ids = (tasks: { card: { id: string } }[]) => tasks.map((task) => task.card.id);

test("only unblocked open tasks are ready; blocked ones list what they wait on", () => {
  const plan = buildPriorityPlan([
    card("a", { before: ["b"] }),
    card("b", { after: ["a"] }),
    card("done", { isCompleted: true, before: ["c"] }),
    card("c", { after: ["done"] }),
  ], NOW);
  assert.deepEqual(ids(plan.ready).sort(), ["a", "c"]);
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
  assert.deepEqual(ids(plan.ready), ["late", "head", "solo"]);
  assert.deepEqual(plan.criticalPath, ["head", "mid", "tail"]);
  assert.equal(plan.ready[1].unlocks, 2);
  assert.equal(plan.ready[0].reasons[0].kind, "overdue");
});

test("due date counts Vietnam calendar days, not 24h windows", () => {
  // 08:00Z = 15:00 VN ngày 21; hạn 02:00Z ngày 22 = 09:00 VN ngày 22 → còn 1 ngày
  const [task] = buildPriorityPlan([card("x", { dueDate: "2026-10-22T02:00:00Z" })], NOW).ready;
  assert.equal(task.daysLeft, 1);
  assert.equal(task.reasons[0].label, "Hạn ngày mai");
});

test("schedule splits tasks into days, never before their blockers, and flags late ones", () => {
  const { days, lateCount } = buildSchedule([
    card("head", { before: ["mid"] }),
    card("mid", { after: ["head"], before: ["tail"] }),
    card("tail", { after: ["mid"], dueDate: "2026-10-21T10:00:00Z" }),
    card("solo"),
  ], { perDay: 2, now: NOW });
  assert.deepEqual(days.map((day) => ids(day.tasks)), [["head", "mid"], ["tail", "solo"]]);
  assert.equal(days[0].tasks[1].ready, false);
  assert.deepEqual(days[0].tasks[1].waitingOn.map((c) => c.id), ["head"]);
  assert.equal(days[1].tasks[0].lateRisk, true);
  assert.equal(lateCount, 1);
});

test("AI order leads the schedule; tasks it never saw follow by heuristic", () => {
  const { days } = buildSchedule([card("a"), card("b"), card("c")], {
    perDay: 5,
    now: NOW,
    order: [{ cardId: "c", reason: "Ôn thi trước" }, { cardId: "gone", reason: "đã xong" }, { cardId: "a", reason: "" }],
  });
  assert.deepEqual(days[0].tasks.map((t) => [t.card.id, t.aiReason, t.unranked]), [
    ["c", "Ôn thi trước", false], ["a", undefined, false], ["b", undefined, true],
  ]);
});

test("a dependency cycle does not hang and is reported as stuck", () => {
  const cycle = [card("x", { after: ["y"], before: ["y"] }), card("y", { after: ["x"], before: ["x"] })];
  const plan = buildPriorityPlan(cycle, NOW);
  assert.equal(plan.ready.length, 0);
  assert.equal(plan.waiting.length, 2);
  const schedule = buildSchedule([...cycle, card("free")], { perDay: 3, now: NOW });
  assert.deepEqual(schedule.days.map((day) => ids(day.tasks)), [["free"]]);
  assert.deepEqual(ids(schedule.stuck.map((c) => ({ card: c }))).sort(), ["x", "y"]);
});
