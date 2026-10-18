import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MyTask } from "./types";
import { buildTodayOverview } from "./today-overview";

const now = new Date("2026-10-17T17:05:00Z"); // 00:05 October 18 in Vietnam
const task = (id: string, patch: Partial<MyTask> = {}): MyTask => ({
  id, title: id, isCompleted: false, dueDate: null, updatedAt: now.toISOString(),
  myDayAt: null, isImportant: false, boardId: "b", boardTitle: "Semester",
  boardType: "SEMESTER", listId: "l", labelIds: [], course: null,
  assignees: [], checklist: { total: 0, completed: 0 }, ...patch,
});

describe("buildTodayOverview", () => {
  it("uses Vietnam day boundaries and excludes completed work", () => {
    const result = buildTodayOverview([
      task("past", { dueDate: "2026-10-17T17:04:00Z" }),
      task("today", { dueDate: "2026-10-18T16:59:59Z" }),
      task("tomorrow", { dueDate: "2026-10-18T17:00:00Z" }),
      task("done", { dueDate: "2026-10-18T10:00:00Z", isCompleted: true }),
    ], now);
    assert.equal(result.overdue, 1);
    assert.equal(result.dueToday, 1);
    assert.deepEqual(result.attention.map(t => t.id), ["past", "today"]);
    assert.deepEqual(result.upcoming.map(t => t.id), ["today", "tomorrow"]);
    assert.equal(result.pending.length, 3);
  });

  it("deduplicates overdue work pinned today, ignores yesterday's pin and keeps input order intact", () => {
    const tasks = [task("old-pin", { myDayAt: "2026-10-17T16:00:00Z" }),
      task("pinned", { myDayAt: now.toISOString(), dueDate: "2026-10-16T10:00:00Z" }),
      task("important", { isImportant: true })];
    const result = buildTodayOverview(tasks, now);
    assert.deepEqual(result.attention.map(t => t.id), ["pinned", "important"]);
    assert.deepEqual(tasks.map(t => t.id), ["old-pin", "pinned", "important"]);
    assert.equal(result.focus?.id, "pinned");
  });

  it("prioritizes the earliest real deadline before important undated work", () => {
    const result = buildTodayOverview([task("important", { isImportant: true }),
      task("later", { dueDate: "2026-10-20T10:00:00Z" }),
      task("soon", { dueDate: "2026-10-19T10:00:00Z" })], now);
    assert.equal(result.focus?.id, "soon");
  });

  it("returns an honest empty state", () => {
    const result = buildTodayOverview([], now);
    assert.equal(result.focus, null);
    assert.equal(result.overdue, 0);
    assert.equal(result.dueToday, 0);
    assert.deepEqual(result.attention, []);
  });
});
