import assert from "node:assert/strict";
import test from "node:test";

import type { TaskSchedule } from "@/lib/cards/task-schedule";

import { buildSchedulePatch } from "./schedule-command";

const none: TaskSchedule = { scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null };
const range: TaskSchedule = {
  scheduledOn: null,
  scheduledStartAt: "2026-10-19T02:00:00.000Z",
  scheduledEndAt: "2026-10-19T04:00:00.000Z",
};

test("moving work never patches deadline", () => {
  const patch = buildSchedulePatch(range, { type: "move", startsAt: "2026-10-20T03:00:00.000Z" });

  assert.ok(patch && !("needsEnd" in patch));
  assert.equal("dueDate" in patch, false);
  assert.equal("deadlineOn" in patch, false);
  assert.equal("reminder" in patch, false);
  assert.deepEqual(Object.keys(patch).sort(), ["scheduledEndAt", "scheduledOn", "scheduledStartAt"]);
});

test("drop on a day yields a date-only schedule", () => {
  assert.deepEqual(buildSchedulePatch(range, { type: "day", day: "2026-10-21" }), {
    scheduledOn: "2026-10-21",
    scheduledStartAt: null,
    scheduledEndAt: null,
  });
});

test("drop on a time without a known duration asks for an end", () => {
  assert.deepEqual(buildSchedulePatch(none, { type: "time", startsAt: "2026-10-20T03:00:00.000Z" }), {
    needsEnd: true,
    startsAt: "2026-10-20T03:00:00.000Z",
  });
  // Ngày-only cũng chưa có thời lượng.
  assert.deepEqual(
    buildSchedulePatch({ ...none, scheduledOn: "2026-10-19" }, { type: "time", startsAt: "2026-10-20T03:00:00.000Z" }),
    { needsEnd: true, startsAt: "2026-10-20T03:00:00.000Z" },
  );
});

test("drop on a time with an explicit end builds a range; bad end is rejected", () => {
  assert.deepEqual(
    buildSchedulePatch(none, { type: "time", startsAt: "2026-10-20T03:00:00.000Z", endsAt: "2026-10-20T04:30:00.000Z" }),
    { scheduledOn: null, scheduledStartAt: "2026-10-20T03:00:00.000Z", scheduledEndAt: "2026-10-20T04:30:00.000Z" },
  );
  assert.equal(
    buildSchedulePatch(none, { type: "time", startsAt: "2026-10-20T03:00:00.000Z", endsAt: "2026-10-20T03:00:00.000Z" }),
    null,
  );
});

test("move keeps duration", () => {
  assert.deepEqual(buildSchedulePatch(range, { type: "move", startsAt: "2026-10-20T03:00:00.000Z" }), {
    scheduledOn: null,
    scheduledStartAt: "2026-10-20T03:00:00.000Z",
    scheduledEndAt: "2026-10-20T05:00:00.000Z",
  });
});

test("resize rejects end <= start and requires an existing range", () => {
  assert.equal(buildSchedulePatch(range, { type: "resize", edge: "end", at: "2026-10-19T02:00:00.000Z" }), null);
  assert.equal(buildSchedulePatch(range, { type: "resize", edge: "start", at: "2026-10-19T04:00:00.000Z" }), null);
  assert.equal(buildSchedulePatch(none, { type: "resize", edge: "end", at: "2026-10-19T04:00:00.000Z" }), null);
  assert.deepEqual(buildSchedulePatch(range, { type: "resize", edge: "end", at: "2026-10-19T05:00:00.000Z" }), {
    scheduledOn: null,
    scheduledStartAt: "2026-10-19T02:00:00.000Z",
    scheduledEndAt: "2026-10-19T05:00:00.000Z",
  });
});

test("clear returns the three scheduled fields as null", () => {
  assert.deepEqual(buildSchedulePatch(range, { type: "clear" }), none);
});
