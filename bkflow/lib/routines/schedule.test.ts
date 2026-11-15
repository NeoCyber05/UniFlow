import assert from "node:assert/strict";
import { test } from "node:test";

import { nextRoutineRun } from "./schedule";

const timeZone = "Asia/Ho_Chi_Minh";
const everyDay = [0, 1, 2, 3, 4, 5, 6];
// Thứ Bảy 14/11/2026, 09:00 giờ Việt Nam.
const saturdayMorning = new Date("2026-11-14T02:00:00Z");
const iso = (date: Date | null) => date?.toISOString() ?? null;

test("giờ chạy đã qua trong hôm nay thì sang ngày mai", () => {
  assert.equal(iso(nextRoutineRun({ minuteOfDay: 7 * 60, weekdays: everyDay, timeZone }, saturdayMorning)), "2026-11-15T00:00:00.000Z");
});

test("giờ chạy còn ở phía trước thì chạy trong hôm nay", () => {
  assert.equal(iso(nextRoutineRun({ minuteOfDay: 21 * 60 + 30, weekdays: everyDay, timeZone }, saturdayMorning)), "2026-11-14T14:30:00.000Z");
});

test("chỉ ngày thường thì bỏ qua cuối tuần", () => {
  assert.equal(iso(nextRoutineRun({ minuteOfDay: 7 * 60, weekdays: [1, 2, 3, 4, 5], timeZone }, saturdayMorning)), "2026-11-16T00:00:00.000Z");
});

test("đúng mốc vừa chạy thì trả mốc kế tiếp, không lặp lại mốc cũ", () => {
  const justRan = new Date("2026-11-15T00:00:00Z");
  assert.equal(iso(nextRoutineRun({ minuteOfDay: 7 * 60, weekdays: everyDay, timeZone }, justRan)), "2026-11-16T00:00:00.000Z");
});

test("một ngày trong tuần, giờ đã qua thì sang tuần sau", () => {
  assert.equal(iso(nextRoutineRun({ minuteOfDay: 8 * 60, weekdays: [6], timeZone }, saturdayMorning)), "2026-11-21T01:00:00.000Z");
});

test("không có ngày lặp (lời nhắc một lần) thì không có lần kế tiếp", () => {
  assert.equal(nextRoutineRun({ minuteOfDay: 7 * 60, weekdays: [], timeZone }, saturdayMorning), null);
});

test("lịch giữ 03:30 địa phương khi bắt đầu giờ mùa hè", () => {
  const result = nextRoutineRun({ minuteOfDay: 210, weekdays: [0], timeZone: "America/New_York" }, new Date("2027-03-13T12:00:00Z"));
  assert.equal(iso(result), "2027-03-14T07:30:00.000Z");
});

test("lịch giữ 02:30 địa phương khi kết thúc giờ mùa hè", () => {
  const result = nextRoutineRun({ minuteOfDay: 150, weekdays: [0], timeZone: "America/New_York" }, new Date("2027-11-06T12:00:00Z"));
  assert.equal(iso(result), "2027-11-07T07:30:00.000Z");
});
