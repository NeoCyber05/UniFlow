import assert from "node:assert/strict";
import { test } from "node:test";

import { formatRepeat, nextRepeatDeadline, readCardRepeat } from "./task-repeat";

// Thứ sáu 23/10/2026, 10:00 giờ VN
const NOW = new Date("2026-10-23T03:00:00Z");

test("next deadline per unit, from the old deadline", () => {
  const on = (deadlineOn: string) => ({ dueDate: null, deadlineOn });
  assert.deepEqual(nextRepeatDeadline(on("2026-10-23"), { unit: "day", every: 1 }, NOW), on("2026-10-24"));
  assert.deepEqual(nextRepeatDeadline(on("2026-10-23"), { unit: "week", every: 2 }, NOW), on("2026-11-06"));
  assert.deepEqual(nextRepeatDeadline(on("2026-10-23"), { unit: "weekday", every: 1 }, NOW), on("2026-10-26"));
  assert.deepEqual(nextRepeatDeadline(on("2027-01-31"), { unit: "month", every: 1 }, NOW), on("2027-02-28"));
  assert.deepEqual(nextRepeatDeadline(on("2026-10-23"), { unit: "year", every: 1 }, NOW), on("2027-10-23"));
});

test("keeps the VN time and skips periods already in the past", () => {
  // 20:00 VN ngày 20/10, lặp hằng ngày → kỳ đầu tiên từ hôm nay: 20:00 ngày 23/10
  const next = nextRepeatDeadline({ dueDate: "2026-10-20T13:00:00.000Z", deadlineOn: null }, { unit: "day", every: 1 }, NOW);
  assert.deepEqual(next, { dueDate: "2026-10-23T13:00:00.000Z", deadlineOn: null });
});

test("labels and stored columns", () => {
  assert.equal(formatRepeat({ unit: "day", every: 1 }), "Hằng ngày");
  assert.equal(formatRepeat({ unit: "week", every: 3 }), "Mỗi 3 tuần");
  assert.deepEqual(readCardRepeat({ repeatUnit: "month", repeatEvery: 2 }), { unit: "month", every: 2 });
  assert.equal(readCardRepeat({ repeatUnit: null, repeatEvery: null }), null);
  assert.equal(readCardRepeat({ repeatUnit: "hourly", repeatEvery: 1 }), null);
});
