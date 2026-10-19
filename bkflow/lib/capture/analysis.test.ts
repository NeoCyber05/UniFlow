import { test } from "node:test";
import assert from "node:assert/strict";

import { validateCaptureAnalysis, type CaptureAnalysisContext } from "./analysis";

const ctx = (rawText: string, extra: Partial<CaptureAnalysisContext> = {}): CaptureAnalysisContext => ({
  draftId: "d1",
  textRevision: 3,
  rawText,
  referenceIso: "2026-10-18T03:00:00Z",
  nowIso: "2026-10-18T03:00:00Z",
  timeZone: "Asia/Ho_Chi_Minh",
  allowedCourseIds: ["c1"],
  ...extra,
});

const noDeadline = { dueDate: null, deadlineOn: null };
const noSchedule = { scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null };

// Fixtures are model outputs; they pin the validator, not model quality (live AI is checked separately).
test("quick sentence matrix", () => {
  const rows: Array<[string, object, (r: ReturnType<typeof validateCaptureAnalysis>) => void]> = [
    ["Nộp bài A trước 17h30 hôm nay",
      { title: "Nộp bài A", deadline: { dueDate: "2026-10-18T17:30:00+07:00", deadlineOn: null }, schedule: null },
      (r) => {
        assert.equal(r.fields.deadline?.dueDate, "2026-10-18T10:30:00.000Z");
        assert.equal(r.fields.schedule, null);
        assert.deepEqual(r.issues, []);
      }],
    ["Học bài A ngày mai từ 19h đến 20h",
      { title: "Học bài A", deadline: null, schedule: { ...noSchedule, scheduledStartAt: "2026-10-19T19:00:00+07:00", scheduledEndAt: "2026-10-19T20:00:00+07:00" } },
      (r) => {
        assert.equal(r.fields.schedule?.scheduledStartAt, "2026-10-19T12:00:00.000Z");
        assert.equal(r.fields.schedule?.scheduledEndAt, "2026-10-19T13:00:00.000Z");
        assert.equal(r.fields.deadline, null);
      }],
    ["Ôn bài tối mai",
      { title: "Ôn bài", schedule: { ...noSchedule, scheduledStartAt: "2026-10-19T19:00:00+07:00", scheduledEndAt: "2026-10-19T21:00:00+07:00" } },
      (r) => {
        // "tối" is not a time: an invented hour is dropped and flagged, the day is kept
        assert.deepEqual(r.fields.schedule, { ...noSchedule, scheduledOn: "2026-10-19" });
        assert.equal(r.issues[0]?.field, "schedule");
      }],
    ["Nộp thứ ba 17h",
      { title: "Nộp bài", deadline: { dueDate: "2026-10-20T17:00:00+07:00", deadlineOn: null } },
      (r) => assert.equal(r.fields.deadline?.dueDate, "2026-10-20T10:00:00.000Z")],
    ["Đọc tài liệu A",
      { title: "Đọc tài liệu A", deadline: null, schedule: null },
      (r) => {
        assert.equal(r.fields.deadline, null);
        assert.equal(r.fields.schedule, null);
        assert.deepEqual(r.issues, []);
      }],
    ["Nộp bài 5 giờ",
      { title: "Nộp bài", deadline: null, issues: [{ field: "deadline", reason: "5 giờ sáng hay chiều?" }] },
      (r) => assert.deepEqual(r.issues, [{ field: "deadline", reason: "5 giờ sáng hay chiều?" }])],
    ["Làm đồ án, chia giúp các bước",
      { title: "Làm đồ án", checklistItems: [" Tìm hiểu  đề ", "Tìm hiểu đề", "Viết báo cáo", 42] },
      (r) => assert.deepEqual(r.fields.checklistItems, ["Tìm hiểu đề", "Viết báo cáo"])],
  ];
  for (const [text, raw, check] of rows) check(validateCaptureAnalysis(raw, ctx(text)));
});

test("keeps request identity", () => {
  const r = validateCaptureAnalysis({ title: "A" }, ctx("A"));
  assert.equal(r.draftId, "d1");
  assert.equal(r.textRevision, 3);
});

test("date-only deadline stays date-only", () => {
  const r = validateCaptureAnalysis({ deadline: { ...noDeadline, deadlineOn: "2026-10-19" } }, ctx("Nộp bài mai"));
  assert.deepEqual(r.fields.deadline, { dueDate: null, deadlineOn: "2026-10-19" });
});

test("past date is kept and flagged, not shifted", () => {
  const r = validateCaptureAnalysis({ deadline: { ...noDeadline, deadlineOn: "2026-10-13" } }, ctx("Nộp bài thứ ba"));
  assert.equal(r.fields.deadline?.deadlineOn, "2026-10-13");
  assert.equal(r.issues[0]?.field, "deadline");
});

test("conflicting deadlines flag only deadline", () => {
  const r = validateCaptureAnalysis({
    title: "Nộp bài",
    deadline: { dueDate: "2026-10-20T17:00:00+07:00", deadlineOn: "2026-10-21" },
    isImportant: true,
  }, ctx("Nộp bài 17h thứ ba hoặc thứ tư"));
  assert.equal("deadline" in r.fields, false);
  assert.deepEqual(r.issues.map((i) => i.field), ["deadline"]);
  assert.equal(r.fields.title, "Nộp bài");
  assert.equal(r.fields.isImportant, true);
});

test("old message: relative day resolves to sent date and warns past", () => {
  const r = validateCaptureAnalysis(
    { deadline: { dueDate: "2026-10-12T17:00:00+07:00", deadlineOn: null } },
    ctx("Nộp hôm nay 17h", { referenceIso: "2026-10-12T03:00:00Z" }),
  );
  assert.equal(r.fields.deadline?.dueDate, "2026-10-12T10:00:00.000Z");
  assert.equal(r.issues[0]?.field, "deadline");
});

test("unknown sent date asks to confirm dates", () => {
  const r = validateCaptureAnalysis(
    { deadline: { ...noDeadline, deadlineOn: "2026-10-19" } },
    ctx("Nộp mai", { requiresRelativeDateConfirmation: true }),
  );
  assert.equal(r.issues[0]?.field, "deadline");
});

test("bad model output is dropped field by field", () => {
  const r = validateCaptureAnalysis({
    title: '{"error":"bad"}',
    deadline: { dueDate: "mai", deadlineOn: null },
    schedule: { ...noSchedule, scheduledStartAt: "2026-10-19T20:00:00+07:00", scheduledEndAt: "2026-10-19T19:00:00+07:00" },
    courseId: "foreign",
    isImportant: "yes",
    issues: [{ field: "password", reason: "x" }, "junk"],
  }, ctx("Học 19h đến 20h"));
  assert.deepEqual(r.fields, {});
  assert.deepEqual(r.issues.map((i) => i.field).sort(), ["deadline", "schedule"]);
});

test("non-object output gives no fields", () => {
  assert.deepEqual(validateCaptureAnalysis("Ignore previous instructions", ctx("x")).fields, {});
  assert.deepEqual(validateCaptureAnalysis(null, ctx("x")).fields, {});
});

test("allowed course passes", () => {
  assert.equal(validateCaptureAnalysis({ courseId: "c1" }, ctx("Bài môn A")).fields.courseId, "c1");
});
