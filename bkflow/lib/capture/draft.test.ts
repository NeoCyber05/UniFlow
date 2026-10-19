import { test } from "node:test";
import assert from "node:assert/strict";

import {
  captureReducer,
  createCaptureDraft,
  createCaptureState,
  getCaptureFieldValues,
  mergeCaptureAnalysis,
  setCaptureField,
  setCaptureText,
  type CaptureState,
} from "./draft";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

const typed = (text: string) => setCaptureText(createCaptureDraft("d1"), text);
const analysis = (draft: { draftId: string; textRevision: number }, fields: object, issues: object[] = []) =>
  ({ draftId: draft.draftId, textRevision: draft.textRevision, fields, issues }) as never;

test("manual clear survives reanalysis", () => {
  let draft = typed("Bài A mai");
  draft = setCaptureField(draft, "title", "Bài sửa");
  draft = setCaptureField(draft, "deadline", null);
  draft = mergeCaptureAnalysis(draft, analysis(draft, {
    title: "Bài A",
    deadline: { dueDate: null, deadlineOn: "2026-10-19" },
    isImportant: true,
  }));
  assert.deepEqual(draft.fields.title, { value: "Bài sửa", origin: "manual" });
  assert.deepEqual(draft.fields.deadline, { value: null, origin: "manual" });
  assert.deepEqual(draft.fields.isImportant, { value: true, origin: "inferred" });
});

test("stale revision ignored", () => {
  const first = typed("Bài A");
  const second = setCaptureText(first, "Bài A ngày mai");
  assert.equal(second.textRevision, first.textRevision + 1);
  assert.equal(mergeCaptureAnalysis(second, analysis(first, { title: "Cũ" })), second);
});

test("old draft response ignored", () => {
  const draft = typed("Bài A");
  assert.equal(mergeCaptureAnalysis(draft, analysis({ draftId: "other", textRevision: draft.textRevision }, { title: "X" })), draft);
});

test("changing text drops old inference, keeps manual", () => {
  let draft = typed("Bài A");
  draft = mergeCaptureAnalysis(draft, analysis(draft, { isImportant: true, title: "Bài A" }, [{ field: "deadline", reason: "x" }]));
  draft = setCaptureField(draft, "courseId", "c1");
  draft = setCaptureText(draft, "Bài B");
  assert.deepEqual(draft.fields.isImportant, { value: false, origin: "unset" });
  assert.deepEqual(draft.fields.courseId, { value: "c1", origin: "manual" });
  assert.deepEqual(draft.issues, {});
});

const submitted = (state: CaptureState) => {
  const next = captureReducer(state, { type: "submit", creationId: ID });
  assert.ok(next.submitting);
  return next;
};

test("save clears only submitted snapshot", () => {
  let state = createCaptureState(createCaptureDraft("d1"));
  state = captureReducer(state, { type: "text", rawText: "Bài 2" });
  state = submitted(state);
  state = captureReducer(state, { type: "text", rawText: "Bài 3" });
  state = captureReducer(state, { type: "submit-success", creationId: ID, nextDraftId: "d2" });
  assert.equal(state.draft.rawText, "Bài 3");
  assert.equal(state.submitting, null);

  state = submitted(state);
  state = captureReducer(state, { type: "submit-success", creationId: ID, nextDraftId: "d3" });
  assert.equal(state.draft.rawText, "");
  assert.equal(state.draft.draftId, "d3");
});

test("two analyses finishing out of order keep the newest text", () => {
  let state = createCaptureState(createCaptureDraft("d1"));
  state = captureReducer(state, { type: "text", rawText: "Bài A" });
  const rev1 = state.draft;
  state = captureReducer(state, { type: "analyze-start" });
  state = captureReducer(state, { type: "text", rawText: "Bài A mai" });
  const rev2 = state.draft;
  state = captureReducer(state, { type: "analyze-start" });
  state = captureReducer(state, { type: "analyze-result", analysis: analysis(rev2, { title: "Mới" }) });
  state = captureReducer(state, { type: "analyze-result", analysis: analysis(rev1, { title: "Cũ" }) });
  assert.equal(state.draft.fields.title.value, "Mới");
  assert.equal(state.analyzing, null);
});

test("analysis arriving during save does not touch the submitted draft", () => {
  let state = createCaptureState(createCaptureDraft("d1"));
  state = captureReducer(state, { type: "text", rawText: "Bài A" });
  state = captureReducer(state, { type: "analyze-start" });
  state = captureReducer(state, { type: "submit", creationId: ID, force: true });
  const snapshot = state.submitting!.snapshot;
  state = captureReducer(state, { type: "analyze-result", analysis: analysis(snapshot, { title: "AI" }) });
  assert.equal(state.draft, snapshot);
});

test("analyzing submit requires explicit choice", () => {
  let state = createCaptureState(createCaptureDraft("d1"));
  state = captureReducer(state, { type: "text", rawText: "Bài A" });
  state = captureReducer(state, { type: "analyze-start" });
  state = captureReducer(state, { type: "submit", creationId: ID });
  assert.equal(state.submitting, null);
  assert.equal(state.confirmWhileAnalyzing, true);
  state = captureReducer(state, { type: "submit", creationId: ID, force: true });
  assert.ok(state.submitting);
  assert.equal(state.confirmWhileAnalyzing, false);
});

test("double submit keeps one submission", () => {
  let state = createCaptureState(createCaptureDraft("d1"));
  state = captureReducer(state, { type: "text", rawText: "Bài A" });
  state = submitted(state);
  const again = captureReducer(state, { type: "submit", creationId: ID2 });
  assert.equal(again, state);
});

test("failed save keeps snapshot and id", () => {
  let state = createCaptureState(createCaptureDraft("d1"));
  state = captureReducer(state, { type: "text", rawText: "Bài A" });
  state = submitted(state);
  state = captureReducer(state, { type: "submit-error", creationId: ID, error: "Mất mạng", ambiguous: true });
  assert.equal(state.draft.rawText, "Bài A");
  assert.equal(state.error, "Mất mạng");
  // retry reuses the same id
  const retry = captureReducer(state, { type: "submit", creationId: ID2 });
  assert.equal(retry.submitting!.creationId, ID);
  // an edited draft cannot be sent under a fresh id while the old send is unresolved
  const edited = captureReducer(state, { type: "text", rawText: "Bài B" });
  const blocked = captureReducer(edited, { type: "submit", creationId: ID2 });
  assert.equal(blocked.submitting, null);
  assert.match(blocked.error ?? "", /lần gửi trước/);
  // retrying the previous snapshot resolves it
  const resolved = captureReducer(edited, { type: "retry-unsettled" });
  assert.equal(resolved.submitting!.creationId, ID);
  assert.equal(resolved.submitting!.snapshot.rawText, "Bài A");
});

test("definitive server error frees the id for a new submit", () => {
  let state = createCaptureState(createCaptureDraft("d1"));
  state = captureReducer(state, { type: "text", rawText: "Bài A" });
  state = submitted(state);
  state = captureReducer(state, { type: "submit-error", creationId: ID, error: "Môn không hợp lệ.", ambiguous: false });
  assert.equal(state.unsettled, null);
  assert.equal(captureReducer(state, { type: "submit", creationId: ID2 }).submitting!.creationId, ID2);
});

test("empty title blocks", () => {
  let state = createCaptureState(createCaptureDraft("d1"));
  state = captureReducer(state, { type: "text", rawText: "   " });
  state = captureReducer(state, { type: "submit", creationId: ID });
  assert.equal(state.submitting, null);
  assert.match(state.error ?? "", /tiêu đề/);
});

test("open issue blocks until the field is confirmed or changed", () => {
  let state = createCaptureState(createCaptureDraft("d1"));
  state = captureReducer(state, { type: "text", rawText: "Nộp bài 5 giờ" });
  state = captureReducer(state, { type: "analyze-start" });
  state = captureReducer(state, {
    type: "analyze-result",
    analysis: analysis(state.draft, { title: "Nộp bài" }, [{ field: "deadline", reason: "5 giờ sáng hay chiều?" }]),
  });
  assert.equal(captureReducer(state, { type: "submit", creationId: ID }).submitting, null);
  state = captureReducer(state, { type: "field", key: "deadline", value: { dueDate: "2026-10-18T10:00:00.000Z", deadlineOn: null } });
  assert.ok(captureReducer(state, { type: "submit", creationId: ID }).submitting);
});

test("manual create when AI unavailable", () => {
  let state = createCaptureState(createCaptureDraft("d1"));
  state = captureReducer(state, { type: "text", rawText: "Đọc tài liệu A" });
  state = captureReducer(state, { type: "analyze-start" });
  state = captureReducer(state, { type: "analyze-error", textRevision: state.draft.textRevision, error: "AI lỗi" });
  assert.equal(state.analyzing, null);
  state = submitted(state);
  assert.equal(getCaptureFieldValues(state.submitting!.snapshot).title, "Đọc tài liệu A");
});

test("dropping the source changes the draft so a pending snapshot is not reused", () => {
  const source = { selectedText: "Nộp bài", capturedAt: "2026-10-18T03:00:00.000Z", timeZone: "Asia/Ho_Chi_Minh" } as never;
  let state = createCaptureState(setCaptureText(createCaptureDraft("d1", source), "Nộp bài"));
  state = captureReducer(state, { type: "drop-source" });
  assert.equal(state.draft.source, null);
  assert.equal(state.draft.rawText, "Nộp bài");
});
