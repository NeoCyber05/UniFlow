import assert from "node:assert/strict";
import test from "node:test";

import type { BoardCalendarCardItem } from "@/types";

import { isUnscheduledForWork, projectCalendarEntries, projectChecklistEntries } from "./calendar-entries";

test("checklist-only markers keep their own title without needing a calendar card row", () => {
  const entry = projectChecklistEntries([{ cardId: "parent", checklistItemId: "step", title: "Đọc chương 1", cardTitle: "Ôn tập", dueDate: "2026-10-19T10:30:00Z" } as never])[0];
  assert.equal(entry.title, "Đọc chương 1 · Ôn tập");
});

const card = (patch: Partial<BoardCalendarCardItem>): BoardCalendarCardItem => ({
  type: "card", id: "card:1", cardId: "1", boardId: "b", listId: "l", listTitle: "L", title: "T",
  startDate: null, dueDate: null, deadlineOn: null, scheduledOn: null, scheduledStartAt: null,
  scheduledEndAt: null, updatedAt: "2026-10-18T00:00:00.000Z", isCompleted: false, reminder: null,
  labels: [], assignees: [], commentCount: 0, ...patch,
});

test("keeps work and deadline separate", () => {
  const entries = projectCalendarEntries([
    card({
      scheduledStartAt: "2026-10-19T02:00:00.000Z",
      scheduledEndAt: "2026-10-19T04:00:00.000Z",
      dueDate: "2026-10-20T10:30:00.000Z", // 17:30 VN ngày 20
    }),
  ]);
  const work = entries.find((e) => e.kind === "work");
  const deadline = entries.find((e) => e.kind === "deadline");

  assert.ok(work && deadline);
  assert.equal(work.cardId, deadline.cardId);
  assert.notEqual(work.key, deadline.key);
  assert.equal(deadline.endsAt, null);
  assert.equal(deadline.startsAt, "2026-10-20T10:30:00.000Z");
  assert.equal(work.endsAt, "2026-10-19T04:00:00.000Z");
});

test("date-only fields become day entries; startDate is a legacy marker, not a work range", () => {
  const entries = projectCalendarEntries([
    card({ scheduledOn: "2026-10-19", deadlineOn: "2026-10-21", startDate: "2026-10-18T01:00:00.000Z" }),
  ]);

  assert.deepEqual(entries.map((e) => [e.kind, e.day, e.endsAt]).sort(), [
    ["deadline-day", "2026-10-21", null],
    ["legacy-start", null, null],
    ["work-day", "2026-10-19", null],
  ]);
});

test("a card with a deadline but no work schedule still belongs to the tray", () => {
  const withDeadline = card({ dueDate: "2026-10-20T10:30:00.000Z" });

  assert.equal(isUnscheduledForWork(withDeadline), true);
  assert.equal(isUnscheduledForWork(card({ scheduledOn: "2026-10-19" })), false);
  assert.equal(
    isUnscheduledForWork(card({ scheduledStartAt: "2026-10-19T02:00:00.000Z", scheduledEndAt: "2026-10-19T03:00:00.000Z" })),
    false,
  );
  // startDate legacy không phải lịch làm mới.
  assert.equal(isUnscheduledForWork(card({ startDate: "2026-10-18T01:00:00.000Z" })), true);
});

test("entry keys are stable per card and kind", () => {
  const a = projectCalendarEntries([card({ dueDate: "2026-10-20T10:30:00.000Z" })]);
  const b = projectCalendarEntries([card({ dueDate: "2026-10-22T10:30:00.000Z" })]);

  assert.equal(a[0].key, b[0].key);
});
