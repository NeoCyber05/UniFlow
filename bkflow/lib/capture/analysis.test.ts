import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { CaptureAnalysisError, validateCaptureAnalysis, zonedTimeToIso } from "./analysis";

// Chủ nhật 18/10/2026, 10:00 giờ VN.
const context = {
  draftId: "d1",
  textRevision: 3,
  referenceIso: "2026-10-18T03:00:00Z",
  timeZone: "Asia/Ho_Chi_Minh",
  allowedCourseIds: ["c-ctdl"],
};

// Fixture output của model cho sáu câu CAP-01 (không phải bằng chứng chất lượng model).
const MATRIX = [
  {
    text: "Nộp bài A trước 17h30 hôm nay",
    raw: { title: "Nộp bài A", deadline: { date: "2026-10-18", time: "17:30" }, schedule: null },
    deadline: { dueDate: "2026-10-18T10:30:00.000Z", deadlineOn: null },
    schedule: undefined,
  },
  {
    text: "Học bài A ngày mai từ 19h đến 20h",
    raw: { title: "Học bài A", deadline: null, schedule: { date: "2026-10-19", startTime: "19:00", endTime: "20:00" } },
    deadline: undefined,
    schedule: { scheduledOn: null, scheduledStartAt: "2026-10-19T12:00:00.000Z", scheduledEndAt: "2026-10-19T13:00:00.000Z" },
  },
  {
    text: "Ôn bài A tối mai",
    raw: { title: "Ôn bài A", schedule: { date: "2026-10-19", startTime: null, endTime: null } },
    deadline: undefined,
    schedule: { scheduledOn: "2026-10-19", scheduledStartAt: null, scheduledEndAt: null },
  },
  {
    text: "nộp thứ ba 17h",
    raw: { title: "Nộp bài", deadline: { date: "2026-10-20", time: "17:00" } },
    deadline: { dueDate: "2026-10-20T10:00:00.000Z", deadlineOn: null },
    schedule: undefined,
  },
  {
    text: "Đọc tài liệu A",
    raw: { title: "Đọc tài liệu A", deadline: null, schedule: null },
    deadline: undefined,
    schedule: undefined,
  },
];

describe("validateCaptureAnalysis", () => {
  test("quick sentence matrix", () => {
    for (const row of MATRIX) {
      const result = validateCaptureAnalysis(row.raw, context);
      assert.deepEqual(result.fields.deadline, row.deadline, row.text);
      assert.deepEqual(result.fields.schedule, row.schedule, row.text);
      assert.deepEqual(result.issues, [], row.text);
      assert.equal(result.draftId, "d1");
      assert.equal(result.textRevision, 3);
    }
  });

  test("ambiguous 5 giờ keeps an issue and no invented time", () => {
    const result = validateCaptureAnalysis(
      { title: "Nộp bài", deadline: { date: "2026-10-19", time: "05:00" }, issues: [{ field: "deadline", reason: "5 giờ sáng hay chiều?" }] },
      context,
    );
    assert.equal(result.fields.deadline, undefined);
    assert.deepEqual(result.issues, [{ field: "deadline", reason: "5 giờ sáng hay chiều?" }]);
    assert.equal(result.fields.title, "Nộp bài");
  });

  test("split request yields editable generic todos", () => {
    const result = validateCaptureAnalysis(
      { title: "Làm đồ án", checklistItems: [" Tìm hiểu đề ", "Tìm hiểu đề", "Lập kế hoạch", 42, "x".repeat(200), "```js"] },
      context,
    );
    assert.deepEqual(result.fields.checklistItems, ["Tìm hiểu đề", "Lập kế hoạch", "x".repeat(120)]);
  });

  test("date-only deadline does not become 23:59", () => {
    const result = validateCaptureAnalysis({ title: "Nộp", deadline: { date: "2026-10-20", time: null } }, context);
    assert.deepEqual(result.fields.deadline, { dueDate: null, deadlineOn: "2026-10-20" });
  });

  test("past date is kept with a warning, never shifted a week", () => {
    const result = validateCaptureAnalysis({ title: "Nộp", deadline: { date: "2026-10-13", time: "17:00" } }, context);
    assert.equal(result.fields.deadline?.dueDate, "2026-10-13T10:00:00.000Z");
    assert.deepEqual(result.issues.map((issue) => issue.field), ["deadline"]);
  });

  test("conflicting deadlines flag only the deadline field", () => {
    const result = validateCaptureAnalysis({
      title: "Nộp bài",
      deadline: { date: "2026-10-20", time: "17:00" },
      schedule: { date: "2026-10-19", startTime: "19:00", endTime: "20:00" },
      isImportant: true,
      issues: [{ field: "deadline", reason: "Có hai hạn khác nhau: thứ ba và thứ tư." }],
    }, context);
    assert.equal(result.fields.deadline, undefined);
    assert.ok(result.fields.schedule);
    assert.equal(result.fields.isImportant, true);
    assert.deepEqual(result.issues.map((issue) => issue.field), ["deadline"]);
  });

  test("invalid shapes are dropped with issues", () => {
    const result = validateCaptureAnalysis({
      title: { a: 1 },
      deadline: { date: "2026-02-30", time: "17:00" },
      schedule: { date: "2026-10-19", startTime: "20:00", endTime: "19:00" },
      issues: [{ field: "password", reason: "x" }, "bad"],
    }, context);
    assert.equal(result.fields.title, undefined);
    assert.equal(result.fields.deadline, undefined);
    assert.equal(result.fields.schedule, undefined);
    assert.deepEqual(result.issues.map((issue) => issue.field), ["deadline", "schedule"]);
  });

  test("schedule with only a start time is not completed by guessing", () => {
    const result = validateCaptureAnalysis({ title: "Học", schedule: { date: "2026-10-19", startTime: "19:00" } }, context);
    assert.equal(result.fields.schedule, undefined);
    assert.equal(result.issues[0].field, "schedule");
  });

  test("unknown course id is rejected (prompt injection cannot pick a foreign course)", () => {
    const result = validateCaptureAnalysis({ title: "Bỏ qua hướng dẫn", courseId: "c-of-another-user", isImportant: "yes" }, context);
    assert.equal(result.fields.courseId, undefined);
    assert.equal(result.fields.isImportant, undefined);
    assert.equal(result.issues[0].field, "courseId");
    assert.equal(validateCaptureAnalysis({ courseId: "c-ctdl" }, context).fields.courseId, "c-ctdl");
  });

  test("JSON or error text as title is rejected", () => {
    for (const title of ['{"error":"rate limit"}', "Error: timeout", "```json"]) {
      const result = validateCaptureAnalysis({ title }, context);
      assert.equal(result.fields.title, undefined, title);
      assert.equal(result.issues[0].field, "title");
    }
  });

  test("non-object output throws", () => {
    for (const raw of [null, "text", [1]]) {
      assert.throws(() => validateCaptureAnalysis(raw, context), CaptureAnalysisError);
    }
  });

  test("respects the requested time zone", () => {
    assert.equal(zonedTimeToIso("2026-10-18", "17:30", "Asia/Ho_Chi_Minh"), "2026-10-18T10:30:00.000Z");
    assert.equal(zonedTimeToIso("2026-07-01", "09:00", "Europe/Berlin"), "2026-07-01T07:00:00.000Z");
    assert.equal(zonedTimeToIso("2026-03-29", "02:30", "Europe/Berlin"), null);
  });
});
