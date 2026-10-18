import assert from "node:assert/strict";
import test from "node:test";

import type { BoardCalendarCardItem } from "@/types";

import { toCalendarDisplayItem, toCalendarDisplayItems, toScheduleFields } from "./schedule-adapter";

const base = {
  type: "card", id: "card:1", cardId: "1", boardId: "b", listId: "l", listTitle: "L", title: "T",
  startDate: null, dueDate: null, deadlineOn: null, scheduledOn: null, scheduledStartAt: null,
  scheduledEndAt: null, updatedAt: "2026-10-18T00:00:00.000Z", isCompleted: false, reminder: null,
  labels: [], assignees: [], commentCount: 0,
} as BoardCalendarCardItem;

test("moving a work session 19 -> 20 produces schedule fields only", () => {
  const fields = toScheduleFields(new Date("2026-10-20T12:00:00.000Z"), new Date("2026-10-20T13:00:00.000Z"));
  assert.deepEqual(Object.keys(fields).sort(), ["scheduledEndAt", "scheduledOn", "scheduledStartAt"]);
  assert.equal(fields.scheduledStartAt, "2026-10-20T12:00:00.000Z");
});

test("range crossing midnight VN stays a range; point or zero length becomes a date", () => {
  const range = toScheduleFields(new Date("2026-10-19T16:00:00.000Z"), new Date("2026-10-19T18:00:00.000Z"));
  assert.equal(range.scheduledEndAt, "2026-10-19T18:00:00.000Z");
  const point = toScheduleFields(null, new Date("2026-10-19T18:00:00.000Z")); // 01:00 ngày 20 VN
  assert.deepEqual(point, { scheduledOn: "2026-10-20", scheduledStartAt: null, scheduledEndAt: null });
  assert.deepEqual(toScheduleFields(null, null), { scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null });
});

test("display item: schedule wins, deadline kept separately; legacy start/due unchanged", () => {
  const scheduled = toCalendarDisplayItem({
    ...base, dueDate: "2026-10-20T10:30:00.000Z",
    scheduledStartAt: "2026-10-19T12:00:00.000Z", scheduledEndAt: "2026-10-19T13:00:00.000Z",
  }) as BoardCalendarCardItem;
  assert.equal(scheduled.startDate, "2026-10-19T12:00:00.000Z");
  assert.equal(scheduled.deadlineAt, "2026-10-20T10:30:00.000Z");

  const legacy = toCalendarDisplayItem({
    ...base, startDate: "2026-10-01T01:00:00.000Z", dueDate: "2026-10-02T01:00:00.000Z",
  }) as BoardCalendarCardItem;
  assert.equal(legacy.startDate, "2026-10-01T01:00:00.000Z");
  assert.equal(legacy.dueDate, "2026-10-02T01:00:00.000Z");

  const dateOnly = toCalendarDisplayItem({ ...base, scheduledOn: "2026-10-19" }) as BoardCalendarCardItem;
  assert.equal(dateOnly.dueDate, "2026-10-18T17:00:00.000Z");
});

test("display items: work and deadline are separate occurrences; legacy start is a marker, never a start->deadline range", () => {
  const both = toCalendarDisplayItems({
    ...base, dueDate: "2026-10-25T10:30:00.000Z",
    scheduledStartAt: "2026-10-19T12:00:00.000Z", scheduledEndAt: "2026-10-19T13:00:00.000Z",
  }) as BoardCalendarCardItem[];
  assert.deepEqual(both.map((i) => [i.displayKind, i.startDate, i.dueDate]), [
    ["work", "2026-10-19T12:00:00.000Z", "2026-10-19T13:00:00.000Z"],
    ["deadline", null, "2026-10-25T10:30:00.000Z"],
  ]);
  assert.notEqual(both[0].id, both[1].id);
  assert.equal(both[0].cardId, both[1].cardId);

  const legacy = toCalendarDisplayItems({
    ...base, startDate: "2026-10-01T01:00:00.000Z", dueDate: "2026-10-02T01:00:00.000Z",
  }) as BoardCalendarCardItem[];
  assert.deepEqual(legacy.map((i) => [i.displayKind, i.startDate, i.dueDate]), [
    ["deadline", null, "2026-10-02T01:00:00.000Z"],
    ["legacy-start", "2026-10-01T01:00:00.000Z", null],
  ]);

  assert.equal(toCalendarDisplayItems(base).length, 0);
});
