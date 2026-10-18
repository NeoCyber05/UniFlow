import assert from "node:assert/strict";
import test from "node:test";

import {
  deadlineWhere,
  getTaskDeadlineAt,
  getTaskDeadlineStatus,
  getTaskReminderAt,
} from "./task-deadline";

const dateOnly = (deadlineOn: string) => ({ dueDate: null, deadlineOn });

test("date-only deadline is overdue only after the VN day ends", () => {
  const d = dateOnly("2026-10-18");
  assert.equal(getTaskDeadlineStatus(d, new Date("2026-10-18T16:59:00.000Z")), "upcoming"); // 23:59 VN
  assert.equal(getTaskDeadlineStatus(d, new Date("2026-10-18T17:00:00.000Z")), "overdue"); // 00:00 ngày 19
});

test("timed deadline and no deadline", () => {
  const now = new Date("2026-10-18T00:00:00.000Z");
  assert.equal(getTaskDeadlineStatus({ dueDate: "2026-10-17T00:00:00.000Z", deadlineOn: null }, now), "overdue");
  assert.equal(getTaskDeadlineStatus({ dueDate: "2026-10-19T00:00:00.000Z", deadlineOn: null }, now), "upcoming");
  assert.equal(getTaskDeadlineStatus({ dueDate: null, deadlineOn: null }, now), "none");
  assert.equal(getTaskDeadlineAt({ dueDate: null, deadlineOn: null }), null);
});

test("derives reminder separately from date-only deadline", () => {
  assert.equal(getTaskReminderAt(dateOnly("2026-10-18"), 60)?.toISOString(), "2026-10-18T01:00:00.000Z");
  assert.equal(
    getTaskReminderAt({ dueDate: "2026-10-20T10:30:00.000Z", deadlineOn: null }, 60)?.toISOString(),
    "2026-10-20T09:30:00.000Z",
  );
  assert.equal(getTaskReminderAt({ dueDate: null, deadlineOn: null }, 60), null);
});

test("deadlineWhere compares date-only column by VN day, not UTC timestamp", () => {
  const where = deadlineWhere({ lte: new Date("2026-10-18T16:59:59.999Z") });
  assert.deepEqual(where, {
    OR: [
      { dueDate: { lte: new Date("2026-10-18T16:59:59.999Z") } },
      { deadlineOn: { lte: new Date("2026-10-18T00:00:00.000Z") } },
    ],
  });
});
