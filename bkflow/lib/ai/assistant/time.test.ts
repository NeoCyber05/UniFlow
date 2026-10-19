import { test } from "node:test";
import assert from "node:assert/strict";

import { getCurrentTimeInfo } from "./time";

test("current time info resolves today, weekday and the next days in the user's zone", () => {
  // 2026-10-19 17:30 UTC = Tuesday 2026-10-20 00:30 in Vietnam: "today" must follow the user's zone, not UTC.
  const info = getCurrentTimeInfo(new Date("2026-10-19T17:30:00Z"), "Asia/Ho_Chi_Minh");
  assert.equal(info.now, "2026-10-20T00:30:00+07:00");
  assert.equal(info.today, "2026-10-20");
  assert.equal(info.weekday, "Thứ Ba");
  assert.equal(info.utcOffset, "+07:00");
  assert.equal(info.days.length, 14);
  assert.deepEqual(info.days[0], { date: "2026-10-20", weekday: "Thứ Ba", label: "hôm nay" });
  assert.deepEqual(info.days[1], { date: "2026-10-21", weekday: "Thứ Tư", label: "ngày mai" });
  assert.deepEqual(info.days[4], { date: "2026-10-24", weekday: "Thứ Bảy" });
});

test("other zones get their own calendar day", () => {
  const info = getCurrentTimeInfo(new Date("2026-10-19T17:30:00Z"), "America/New_York");
  assert.equal(info.today, "2026-10-19");
  assert.equal(info.weekday, "Thứ Hai");
});
