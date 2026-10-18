import assert from "node:assert/strict";
import test from "node:test";

import {
  serializeTaskDates,
  toTaskDeadlineStorage,
  toTaskScheduleStorage,
} from "@/lib/cards/task-schedule-storage";

test("preserves date-only values and leaves legacy schedule empty", () => {
  const stored = toTaskDeadlineStorage({ dueDate: null, deadlineOn: "2026-10-18" });
  assert.equal((stored.deadlineOn as Date).toISOString(), "2026-10-18T00:00:00.000Z");
  assert.equal(stored.dueDate, null);

  const after = serializeTaskDates({
    dueDate: null,
    deadlineOn: stored.deadlineOn as Date,
    scheduledOn: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
  });
  assert.equal(after.deadlineOn, "2026-10-18");
  assert.equal(after.scheduledStartAt, null);
  assert.equal(after.scheduledOn, null);
});

test("date-only round trip does not depend on process timezone", () => {
  const original = process.env.TZ;
  try {
    for (const tz of ["Asia/Ho_Chi_Minh", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = tz;
      const s = toTaskScheduleStorage({ scheduledOn: "2026-10-18", scheduledStartAt: null, scheduledEndAt: null });
      assert.equal(s.scheduledOn instanceof Date && s.scheduledOn.toISOString().slice(0, 10), "2026-10-18");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("legacy due date alone yields no scheduled fields and keeps dueDate", () => {
  const after = serializeTaskDates({
    dueDate: new Date("2026-10-20T10:30:00.000Z"),
    deadlineOn: null,
    scheduledOn: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
  });
  assert.deepEqual(after, {
    dueDate: "2026-10-20T10:30:00.000Z",
    deadlineOn: null,
    scheduledOn: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
  });
});

test("schedule range converts to Date and back", () => {
  const s = toTaskScheduleStorage({
    scheduledOn: null,
    scheduledStartAt: "2026-10-19T19:00:00.000+07:00",
    scheduledEndAt: "2026-10-19T20:00:00.000+07:00",
  });
  assert.equal(s.scheduledStartAt instanceof Date && s.scheduledStartAt.toISOString(), "2026-10-19T12:00:00.000Z");
  assert.equal(s.scheduledOn, null);
});
