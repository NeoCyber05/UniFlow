import assert from "node:assert/strict";
import test from "node:test";

import { getCalendarRange, getTodayKey, intersectsRange, shiftCalendarDay, readCalendarLocation, writeCalendarLocation } from "./calendar-navigation";
import { emptyBoardFilters } from "@/hooks/use-board-filters";

test("calendar URL round trips date, view and all filters without dropping task selection", () => {
  const filters = { ...emptyBoardFilters, selectedCourseIds: ["math"], selectedListIds: ["list1"], importantOnly: true };
  const params = writeCalendarLocation(new URLSearchParams("cardId=c1&other=keep"), { day: "2026-10-21", mode: "day", filters });
  assert.equal(params.get("cardId"), "c1");
  assert.equal(params.get("other"), "keep");
  assert.deepEqual(readCalendarLocation(params), { day: "2026-10-21", mode: "day", filters });
  assert.deepEqual(readCalendarLocation(writeCalendarLocation(params, { day: "2026-10-22", mode: "week" })).filters, filters);
});

test("invalid calendar URL values fall back without crashing", () => {
  const parsed = readCalendarLocation(new URLSearchParams("date=2026-02-30&view=bad&calendarFilters=%7Bbad"), new Date("2026-10-18T18:00:00Z"));
  assert.equal(parsed.day, "2026-10-19");
  assert.equal(parsed.mode, "month");
  assert.equal(parsed.filters, null);
});

test("keeps selected day and filters across views", () => {
  const day = "2026-10-21"; // thứ Tư
  const month = getCalendarRange(day, "month");
  const week = getCalendarRange(day, "week");
  const dayRange = getCalendarRange(day, "day");

  // Tuần bắt đầu thứ Hai 19/10 (VN = UTC+7), to là biên mở đầu tuần kế.
  assert.deepEqual(week, { from: "2026-10-18T17:00:00.000Z", to: "2026-10-25T17:00:00.000Z" });
  assert.deepEqual(dayRange, { from: "2026-10-20T17:00:00.000Z", to: "2026-10-21T17:00:00.000Z" });
  // Lưới tháng 10/2026: từ thứ Hai 28/09 đến hết Chủ nhật 01/11.
  assert.equal(month.from, "2026-09-27T17:00:00.000Z");
  assert.equal(month.to, "2026-11-01T17:00:00.000Z");
  // Ngày chọn luôn nằm trong mọi range.
  for (const r of [month, week, dayRange]) {
    assert.ok(Date.parse(r.from) <= Date.parse("2026-10-21T05:00:00.000Z"));
    assert.ok(Date.parse(r.to) > Date.parse("2026-10-21T05:00:00.000Z"));
  }
  assert.equal(shiftCalendarDay(day, "week", 1), "2026-10-28");
  assert.equal(shiftCalendarDay(day, "day", -1), "2026-10-20");
  assert.equal(shiftCalendarDay("2026-01-31", "month", 1), "2026-02-28");
});

test("today follows Vietnam day even while UTC is still the previous day", () => {
  // 18:00 UTC 18/10 = 01:00 ngày 19/10 giờ VN
  assert.equal(getTodayKey(new Date("2026-10-18T18:00:00.000Z")), "2026-10-19");
});

test("interval intersection uses half-open bounds", () => {
  const range = { from: "2026-10-20T17:00:00.000Z", to: "2026-10-21T17:00:00.000Z" };

  assert.equal(intersectsRange(range, "2026-10-21T10:00:00.000Z", "2026-10-21T11:00:00.000Z"), true);
  // Bao phủ trọn range.
  assert.equal(intersectsRange(range, "2026-10-20T00:00:00.000Z", "2026-10-22T00:00:00.000Z"), true);
  // Kết thúc đúng 00:00 ngày xem: không thuộc ngày xem.
  assert.equal(intersectsRange(range, "2026-10-20T15:00:00.000Z", "2026-10-20T17:00:00.000Z"), false);
  // Bắt đầu đúng biên mở: không thuộc.
  assert.equal(intersectsRange(range, "2026-10-21T17:00:00.000Z", "2026-10-21T18:00:00.000Z"), false);
});
