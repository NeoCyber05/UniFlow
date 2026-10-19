import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expandTimetable, mondayOf, parseWeeks, type TimetableSession } from "./image-import";

describe("parseWeeks", () => {
  it("khoảng và danh sách, bỏ phần sai", () => {
    assert.deepEqual(parseWeeks("2-4,11-12"), [2, 3, 4, 11, 12]);
    assert.deepEqual(parseWeeks("6,7,8, 9"), [6, 7, 8, 9]);
    assert.deepEqual(parseWeeks("9-2,abc,99"), []);
  });
});

describe("expandTimetable", () => {
  const session: TimetableSession = {
    code: "IT3323", name: "Xây dựng chương trình dịch", weekday: 1,
    start: "12:30", end: "14:55", room: "B1-203", weeks: "1,3", note: "BT",
  };

  it("tuần 1 = tuần của ngày bắt đầu kỳ; T2 tuần 3 = +14 ngày", () => {
    const week1 = mondayOf("2026-09-03"); // Thứ Năm → Thứ Hai 31/8
    assert.equal(week1, "2026-08-31");
    assert.deepEqual(expandTimetable([session], week1).map((item) => item.date), ["2026-08-31", "2026-09-14"]);
    assert.equal(expandTimetable([{ ...session, weekday: 7, weeks: "1" }], week1)[0].date, "2026-09-06");
  });
});
