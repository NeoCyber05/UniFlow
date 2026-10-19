import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  captureReducer,
  captureSnapshot,
  confirmCaptureDates,
  createCaptureDraft,
  createCaptureState,
  getCaptureSubmitBlocker,
  mergeCaptureAnalysis,
  planCaptureSubmit,
  setCaptureField,
  setCaptureText,
  toQuickAddInput,
  type CaptureEvent,
  type CaptureState,
} from "./draft";
import type { CaptureSource } from "./source";

const D1 = "d1";
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const typed = (text: string, draftId = D1) => setCaptureText(createCaptureDraft({ draftId }), text);
const run = (state: CaptureState, ...events: CaptureEvent[]) => events.reduce(captureReducer, state);
const ai = (textRevision: number, fields: object, draftId = D1) => ({ draftId, textRevision, fields, issues: [] });

describe("capture draft", () => {
  test("manual clear survives reanalysis", () => {
    let draft = typed("Nộp bài A mai");
    draft = setCaptureField(draft, "title", "Bài sửa");
    draft = setCaptureField(draft, "deadline", null);
    draft = mergeCaptureAnalysis(draft, ai(1, { title: "Bài A", deadline: { dueDate: null, deadlineOn: "2026-10-19" } }));
    assert.equal(draft.fields.title.value, "Bài sửa");
    assert.equal(draft.fields.title.origin, "manual");
    assert.equal(draft.fields.deadline.value, null);
    assert.equal(draft.fields.deadline.origin, "manual");
  });

  test("stale revision ignored", () => {
    let draft = typed("Nộp bài A");
    draft = setCaptureText(draft, "Nộp bài A mai");
    const merged = mergeCaptureAnalysis(draft, ai(1, { title: "Bài cũ" }));
    assert.equal(merged, draft);
    assert.equal(merged.fields.title.origin, "unset");
  });

  test("old draft response ignored", () => {
    const draft = typed("Nộp bài A", "d2");
    assert.equal(mergeCaptureAnalysis(draft, ai(1, { title: "X" }, D1)), draft);
  });

  test("editing text drops inference but keeps manual choices", () => {
    let draft = typed("Nộp bài A");
    draft = mergeCaptureAnalysis(draft, ai(1, { title: "Nộp bài A", isImportant: true }));
    draft = setCaptureField(draft, "courseId", "c1");
    draft = setCaptureText(draft, "Nộp bài A thứ ba");
    assert.equal(draft.textRevision, 2);
    assert.equal(draft.fields.title.origin, "unset");
    assert.equal(draft.fields.isImportant.value, false);
    assert.deepEqual(draft.fields.courseId, { value: "c1", origin: "manual" });
  });

  test("issues for manual fields are dropped", () => {
    let draft = setCaptureField(typed("Nộp 5 giờ"), "deadline", { dueDate: "2026-10-18T10:00:00.000Z", deadlineOn: null });
    draft = mergeCaptureAnalysis(draft, { ...ai(1, {}), issues: [{ field: "deadline", reason: "sáng hay chiều?" }] });
    assert.deepEqual(draft.issues, []);
  });
});

describe("capture reducer", () => {
  const start = (text: string) => run(createCaptureState(createCaptureDraft({ draftId: D1 })), { type: "text", rawText: text });

  test("two requests finishing out of order: only the latest merges", () => {
    let state = start("Học bài");
    state = run(state, { type: "analysis/start", draftId: D1, textRevision: 1 }, { type: "text", rawText: "Học bài A" },
      { type: "analysis/start", draftId: D1, textRevision: 2 });
    state = run(state, { type: "analysis/success", analysis: ai(2, { title: "Học bài A" }) });
    state = run(state, { type: "analysis/success", analysis: ai(1, { title: "Học bài" }) });
    assert.equal(state.draft.fields.title.value, "Học bài A");
    assert.equal(state.analyzing, null);
  });

  test("save clears only submitted snapshot", () => {
    let state = start("Nộp bài A");
    state = run(state, { type: "field", key: "title", value: "Nộp bài A" });
    const plan = planCaptureSubmit(state);
    assert.equal(plan.kind, "submit");
    if (plan.kind !== "submit") return;
    state = run(state, { type: "submit/start", creationId: ID_A, snapshot: plan.snapshot });
    state = run(state, { type: "text", rawText: "Nộp bài B" });
    state = run(state, { type: "submit/success", creationId: ID_A, nextDraftId: "d-next" });
    assert.equal(state.draft.rawText, "Nộp bài B");
    assert.equal(state.draft.textRevision, 2);
    assert.equal(state.submission, null);
  });

  test("success with unchanged draft starts a fresh draft", () => {
    let state = run(start("Đọc tài liệu A"), { type: "field", key: "title", value: "Đọc tài liệu A" });
    const plan = planCaptureSubmit(state);
    if (plan.kind !== "submit") assert.fail(plan.kind);
    state = run(state, { type: "submit/start", creationId: ID_A, snapshot: plan.snapshot },
      { type: "submit/success", creationId: ID_A, nextDraftId: "d-next" });
    assert.equal(state.draft.draftId, "d-next");
    assert.equal(state.draft.rawText, "");
  });

  test("analysis response after submit does not merge into the sent draft", () => {
    let state = run(start("Nộp bài A"), { type: "field", key: "title", value: "Nộp bài A" },
      { type: "analysis/start", draftId: D1, textRevision: 1 });
    const plan = planCaptureSubmit(state, { withCurrentInfo: true });
    if (plan.kind !== "submit") assert.fail(plan.kind);
    state = run(state, { type: "submit/start", creationId: ID_A, snapshot: plan.snapshot },
      { type: "analysis/success", analysis: ai(1, { isImportant: true }) });
    assert.equal(state.draft.fields.isImportant.value, false);
  });

  test("new choice while saving survives success", () => {
    let state = run(start("Nộp bài A"), { type: "field", key: "title", value: "Nộp bài A" });
    const plan = planCaptureSubmit(state);
    if (plan.kind !== "submit") assert.fail(plan.kind);
    state = run(state, { type: "submit/start", creationId: ID_A, snapshot: plan.snapshot },
      { type: "field", key: "isImportant", value: true },
      { type: "submit/success", creationId: ID_A, nextDraftId: "d-next" });
    assert.equal(state.draft.draftId, D1);
    assert.equal(state.draft.fields.isImportant.value, true);
    assert.equal(plan.snapshot.values.isImportant, false);
  });

  test("analyzing submit requires explicit choice", () => {
    let state = run(start("Nộp bài A"), { type: "field", key: "title", value: "Nộp bài A" },
      { type: "analysis/start", draftId: D1, textRevision: 1 });
    assert.equal(planCaptureSubmit(state).kind, "confirm-analysis");
    state = run(state, { type: "submit/confirm" });
    assert.equal(state.confirmingSubmit, true);
    assert.equal(planCaptureSubmit(state, { withCurrentInfo: true }).kind, "submit");
  });

  test("busy while saving: double submit does not start a second save", () => {
    let state = run(start("Nộp bài A"), { type: "field", key: "title", value: "Nộp bài A" });
    const plan = planCaptureSubmit(state);
    if (plan.kind !== "submit") assert.fail(plan.kind);
    state = run(state, { type: "submit/start", creationId: ID_A, snapshot: plan.snapshot });
    assert.equal(planCaptureSubmit(state).kind, "busy");
  });

  test("failed save keeps snapshot and id", () => {
    let state = run(start("Nộp bài A"), { type: "field", key: "title", value: "Nộp bài A" });
    const plan = planCaptureSubmit(state);
    if (plan.kind !== "submit") assert.fail(plan.kind);
    state = run(state, { type: "submit/start", creationId: ID_A, snapshot: plan.snapshot },
      { type: "submit/failure", creationId: ID_A, error: "Mất mạng", kind: "uncertain" });
    assert.equal(state.draft.rawText, "Nộp bài A");
    // Nháp đổi sau lỗi không rõ: vẫn phải retry đúng bản cũ trước.
    state = run(state, { type: "field", key: "title", value: "Nộp bài B" });
    const retry = planCaptureSubmit(state);
    assert.deepEqual(retry, { kind: "submit", creationId: ID_A, snapshot: plan.snapshot, retry: true });
  });

  test("definite failure reuses id only for unchanged content", () => {
    let state = run(start("Nộp bài A"), { type: "field", key: "title", value: "Nộp bài A" });
    const plan = planCaptureSubmit(state);
    if (plan.kind !== "submit") assert.fail(plan.kind);
    state = run(state, { type: "submit/start", creationId: ID_A, snapshot: plan.snapshot },
      { type: "submit/failure", creationId: ID_A, error: "Môn không hợp lệ", kind: "failed" });
    const same = planCaptureSubmit(state);
    assert.equal(same.kind === "submit" && same.creationId, ID_A);
    state = run(state, { type: "field", key: "title", value: "Nộp bài B" });
    const changed = planCaptureSubmit(state);
    assert.equal(changed.kind === "submit" && changed.creationId, null);
  });

  test("conflicting id is never reused", () => {
    let state = run(start("Nộp bài A"), { type: "field", key: "title", value: "Nộp bài A" });
    const plan = planCaptureSubmit(state);
    if (plan.kind !== "submit") assert.fail(plan.kind);
    state = run(state, { type: "submit/start", creationId: ID_A, snapshot: plan.snapshot },
      { type: "submit/failure", creationId: ID_A, error: "Đã xử lý", kind: "conflict" });
    const next = planCaptureSubmit(state);
    assert.equal(next.kind === "submit" && next.creationId, null);
  });

  test("stale submit result is ignored", () => {
    let state = run(start("A bài"), { type: "field", key: "title", value: "A bài" });
    const plan = planCaptureSubmit(state);
    if (plan.kind !== "submit") assert.fail(plan.kind);
    state = run(state, { type: "submit/start", creationId: ID_A, snapshot: plan.snapshot });
    assert.equal(run(state, { type: "submit/success", creationId: ID_B, nextDraftId: "x" }), state);
  });

  test("empty title blocks", () => {
    const state = start("   ");
    assert.deepEqual(planCaptureSubmit(state), { kind: "blocked", reason: "Vui lòng nhập tiêu đề." });
  });

  test("manual create when AI unavailable", () => {
    let state = run(start("Đọc tài liệu A"), { type: "analysis/start", draftId: D1, textRevision: 1 });
    state = run(state, { type: "analysis/failure", draftId: D1, textRevision: 1, error: "AI phản hồi quá lâu." },
      { type: "field", key: "title", value: "Đọc tài liệu A" });
    assert.equal(state.analysisError, "AI phản hồi quá lâu.");
    const plan = planCaptureSubmit(state);
    assert.equal(plan.kind, "submit");
  });

  test("reminder without deadline blocks", () => {
    const draft = setCaptureField(setCaptureField(typed("Nộp"), "title", "Nộp"), "reminder", "60");
    assert.equal(getCaptureSubmitBlocker(draft), "Nhắc hạn cần có hạn nộp.");
  });
});

describe("source date confirmation", () => {
  const source: CaptureSource = {
    selectedText: "Nộp bài hôm nay 17h",
    pageUrl: "https://teams.microsoft.com/",
    pageTitle: null,
    messagePermalink: null,
    messageSentAt: null,
    capturedAt: "2026-10-18T03:00:00.000Z",
    timeZone: "Asia/Ho_Chi_Minh",
  };
  const withDate = () => {
    let draft = setCaptureText(createCaptureDraft({ draftId: D1, source }), source.selectedText);
    draft = setCaptureField(draft, "title", "Nộp bài");
    return mergeCaptureAnalysis(draft, ai(1, { deadline: { dueDate: "2026-10-18T10:00:00.000Z", deadlineOn: null } }));
  };

  test("inferred date from unknown sent time needs confirmation", () => {
    const draft = withDate();
    assert.match(getCaptureSubmitBlocker(draft) ?? "", /xác nhận ngày/);
    assert.equal(getCaptureSubmitBlocker(confirmCaptureDates(draft)), null);
  });

  test("confirmation is lost when text or date changes", () => {
    const confirmed = confirmCaptureDates(withDate());
    const retyped = setCaptureText(confirmed, "Nộp bài mai 17h");
    const merged = mergeCaptureAnalysis(retyped, ai(2, { deadline: { dueDate: "2026-10-19T10:00:00.000Z", deadlineOn: null } }));
    assert.match(getCaptureSubmitBlocker(merged) ?? "", /xác nhận ngày/);
  });

  test("manual date needs no confirmation and source goes into description", () => {
    const draft = setCaptureField(withDate(), "deadline", { dueDate: null, deadlineOn: "2026-10-18" });
    assert.equal(getCaptureSubmitBlocker(draft), null);
    const input = toQuickAddInput(captureSnapshot(draft), ID_A, { boardId: "b1" });
    assert.equal(input.deadlineOn, "2026-10-18");
    assert.equal(input.dueDate, null);
    assert.match(input.description ?? "", /Trang nguồn: <https:\/\/teams\.microsoft\.com\/>/);
  });
});

describe("toQuickAddInput", () => {
  test("defaults apply only when the draft has no value", () => {
    let draft = setCaptureField(typed("Ôn tập"), "title", "Ôn tập");
    const snapshot = captureSnapshot(draft);
    const input = toQuickAddInput(snapshot, ID_A, { boardId: "b1", defaults: { courseId: "c-def", myDayWhenNoDue: true } });
    assert.equal(input.courseId, "c-def");
    assert.equal(input.myDay, true);
    draft = setCaptureField(draft, "deadline", { dueDate: null, deadlineOn: "2026-10-20" });
    draft = setCaptureField(draft, "courseId", "c1");
    const next = toQuickAddInput(captureSnapshot(draft), ID_A, { defaults: { courseId: "c-def", myDayWhenNoDue: true } });
    assert.equal(next.courseId, "c1");
    assert.equal(next.myDay, false);
  });
});
