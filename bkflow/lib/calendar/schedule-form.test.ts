import assert from "node:assert/strict";
import { test } from "node:test";
import { getScheduleFormIntent } from "./schedule-command";

test("editing a multi-day session preserves its end date", () => {
  assert.deepEqual(getScheduleFormIntent({ day: "2026-10-19", endDay: "2026-10-21", start: "23:30", end: "00:30" }), {
    type: "time", startsAt: "2026-10-19T16:30:00.000Z", endsAt: "2026-10-20T17:30:00.000Z",
  });
});

test("date-only scheduling does not invent a time; invalid calendar dates return an error", () => {
  assert.deepEqual(getScheduleFormIntent({ day: "2026-10-19", endDay: "2026-10-19", start: "", end: "" }), { type: "day", day: "2026-10-19" });
  assert.ok("error" in getScheduleFormIntent({ day: "2026-02-30", endDay: "2026-03-01", start: "10:00", end: "11:00" }));
  assert.ok("error" in getScheduleFormIntent({ day: "2026-10-19", endDay: "2026-10-19", start: "23:30", end: "00:30" }));
});
