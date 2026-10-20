import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expandTimetable, imageItemToCaptureFields, mondayOf, parseWeeks, type TimetableSession } from "./image-import";

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

describe("imageItemToCaptureFields", () => {
  const base = { title: "Ôn thi", courseCode: null, description: null, date: "2026-10-20", start: null, end: null } as const;

  it("TASK có giờ → hạn giờ VN; không giờ → hạn cả ngày", () => {
    assert.deepEqual(imageItemToCaptureFields({ ...base, kind: "TASK", start: "05:00" }).deadline, { dueDate: "2026-10-19T22:00:00.000Z", deadlineOn: null });
    assert.deepEqual(imageItemToCaptureFields({ ...base, kind: "TASK" }).deadline, { dueDate: null, deadlineOn: "2026-10-20" });
  });

  it("EVENT đủ giờ → lịch làm; thiếu giờ kết thúc → lịch cả ngày; không ngày → trống", () => {
    assert.deepEqual(imageItemToCaptureFields({ ...base, kind: "EVENT", start: "05:00", end: "05:30" }).schedule,
      { scheduledOn: null, scheduledStartAt: "2026-10-19T22:00:00.000Z", scheduledEndAt: "2026-10-19T22:30:00.000Z" });
    assert.deepEqual(imageItemToCaptureFields({ ...base, kind: "EVENT", start: "05:00" }).schedule,
      { scheduledOn: "2026-10-20", scheduledStartAt: null, scheduledEndAt: null });
    assert.deepEqual(imageItemToCaptureFields({ ...base, kind: "EVENT", date: null }), { deadline: null, schedule: null });
  });
});
