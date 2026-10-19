import { validateTaskSchedule, type TaskDeadline, type TaskSchedule } from "@/lib/cards/task-schedule";
import type { CaptureAnalysis, CaptureIssue } from "@/lib/capture/analysis";
import {
  buildCaptureSourceDescription,
  getCaptureDescriptionError,
  getCaptureTimeContext,
  type CaptureSource,
} from "@/lib/capture/source";

export type CaptureFields = {
  title: string;
  deadline: TaskDeadline | null;
  schedule: TaskSchedule | null;
  /** Offset phút trước hạn (contract nhắc của card), null = không nhắc. */
  reminder: string | null;
  isImportant: boolean;
  courseId: string | null;
  checklistItems: string[];
};

/** manual = người dùng chọn (kể cả xóa bằng null), inferred = parser/AI, unset = chưa có. */
export type FieldOrigin = "manual" | "inferred" | "unset";
export type CaptureField<T> = { value: T; origin: FieldOrigin };
export type CaptureDraftFields = { [K in keyof CaptureFields]: CaptureField<CaptureFields[K]> };

export type CaptureDraft = {
  draftId: string;
  textRevision: number;
  rawText: string;
  source: CaptureSource | null;
  fields: CaptureDraftFields;
  issues: CaptureIssue[];
  /** Xác nhận ngày khi nguồn không rõ thời điểm gửi; chỉ đúng với revision + giá trị đã xác nhận. */
  dateConfirmation: { textRevision: number; key: string } | null;
};

const EMPTY_FIELDS: CaptureFields = {
  title: "",
  deadline: null,
  schedule: null,
  reminder: null,
  isImportant: false,
  courseId: null,
  checklistItems: [],
};

const FIELD_KEYS = Object.keys(EMPTY_FIELDS) as (keyof CaptureFields)[];

const emptyDraftFields = (): CaptureDraftFields =>
  Object.fromEntries(FIELD_KEYS.map((key) => [key, { value: EMPTY_FIELDS[key], origin: "unset" }])) as CaptureDraftFields;

export const createCaptureDraft = ({
  draftId,
  rawText = "",
  source = null,
}: {
  draftId: string;
  rawText?: string;
  source?: CaptureSource | null;
}): CaptureDraft => ({
  draftId,
  textRevision: 0,
  rawText,
  source,
  fields: emptyDraftFields(),
  issues: [],
  dateConfirmation: null,
});

/** Mỗi lần sửa văn bản tăng revision; suy luận cũ bị bỏ, lựa chọn của người dùng giữ nguyên. */
export const setCaptureText = (draft: CaptureDraft, rawText: string): CaptureDraft => {
  if (rawText === draft.rawText) return draft;
  const fields = { ...draft.fields };
  for (const key of FIELD_KEYS) {
    if (fields[key].origin === "inferred") {
      fields[key] = { value: EMPTY_FIELDS[key], origin: "unset" } as never;
    }
  }
  return { ...draft, rawText, textRevision: draft.textRevision + 1, fields, issues: [] };
};

export const setCaptureField = <K extends keyof CaptureFields>(
  draft: CaptureDraft,
  key: K,
  value: CaptureFields[K],
): CaptureDraft => ({
  ...draft,
  fields: { ...draft.fields, [key]: { value, origin: "manual" } },
  issues: draft.issues.filter((issue) => issue.field !== key),
});

/** Trả field về cho parser/AI quyết định ở lần phân tích sau. */
export const resetCaptureField = (draft: CaptureDraft, key: keyof CaptureFields): CaptureDraft => ({
  ...draft,
  fields: { ...draft.fields, [key]: { value: EMPTY_FIELDS[key], origin: "unset" } },
});

/** Kết quả sai draft/revision bị bỏ; chỉ thay field inferred/unset, không bao giờ đè lựa chọn manual. */
export const mergeCaptureAnalysis = (
  draft: CaptureDraft,
  analysis: Pick<CaptureAnalysis, "draftId" | "textRevision" | "fields"> & { issues?: CaptureIssue[] },
): CaptureDraft => {
  if (analysis.draftId !== draft.draftId || analysis.textRevision !== draft.textRevision) return draft;
  const fields = { ...draft.fields };
  for (const key of FIELD_KEYS) {
    if (!(key in analysis.fields) || fields[key].origin === "manual") continue;
    fields[key] = { value: analysis.fields[key], origin: "inferred" } as never;
  }
  const seen = new Set(draft.issues.map((issue) => `${issue.field}\n${issue.reason}`));
  const issues = [...draft.issues];
  for (const issue of analysis.issues ?? []) {
    const key = `${issue.field}\n${issue.reason}`;
    if (fields[issue.field].origin === "manual" || seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }
  return { ...draft, fields, issues };
};

const datesKey = (draft: CaptureDraft) =>
  JSON.stringify([draft.fields.deadline.value, draft.fields.schedule.value]);

/** Ngày do AI/parser suy từ đoạn chọn không rõ thời điểm gửi phải được xác nhận trước khi lưu. */
export const needsDateConfirmation = (draft: CaptureDraft) => {
  if (!draft.source || !getCaptureTimeContext(draft.source).requiresRelativeDateConfirmation) return false;
  const { deadline, schedule } = draft.fields;
  return (deadline.origin === "inferred" && deadline.value !== null) ||
    (schedule.origin === "inferred" && schedule.value !== null);
};

export const isDateConfirmed = (draft: CaptureDraft) =>
  draft.dateConfirmation?.textRevision === draft.textRevision && draft.dateConfirmation.key === datesKey(draft);

export const confirmCaptureDates = (draft: CaptureDraft): CaptureDraft => ({
  ...draft,
  dateConfirmation: { textRevision: draft.textRevision, key: datesKey(draft) },
});

export const getCaptureValues = (draft: CaptureDraft): CaptureFields =>
  Object.fromEntries(FIELD_KEYS.map((key) => [key, draft.fields[key].value])) as CaptureFields;

export const getCaptureDescription = (draft: Pick<CaptureDraft, "source">) =>
  draft.source ? buildCaptureSourceDescription(draft.source) : "";

/** Lý do chưa được lưu (null = lưu được). Không phụ thuộc AI: thiếu AI vẫn thêm tay được. */
export const getCaptureSubmitBlocker = (draft: CaptureDraft): string | null => {
  const values = getCaptureValues(draft);
  if (!values.title.trim()) return "Vui lòng nhập tiêu đề.";
  if (values.title.trim().length > 200) return "Tiêu đề tối đa 200 ký tự.";
  if (values.schedule) {
    const error = validateTaskSchedule(values.schedule);
    if (error) return error;
  }
  if (values.reminder && !values.deadline) return "Nhắc hạn cần có hạn nộp.";
  const descriptionError = getCaptureDescriptionError(getCaptureDescription(draft));
  if (descriptionError) return descriptionError;
  if (needsDateConfirmation(draft) && !isDateConfirmed(draft)) {
    return "Hãy xác nhận ngày: đoạn chọn không rõ thời điểm gửi.";
  }
  return null;
};

export type CaptureSnapshot = {
  draftId: string;
  textRevision: number;
  rawText: string;
  values: CaptureFields;
  origins: { [K in keyof CaptureFields]: FieldOrigin };
  description: string;
};

export const captureSnapshot = (draft: CaptureDraft): CaptureSnapshot => ({
  draftId: draft.draftId,
  textRevision: draft.textRevision,
  rawText: draft.rawText,
  values: getCaptureValues(draft),
  origins: Object.fromEntries(FIELD_KEYS.map((key) => [key, draft.fields[key].origin])) as CaptureSnapshot["origins"],
  description: getCaptureDescription(draft),
});

const sameContent = (draft: CaptureDraft, snapshot: CaptureSnapshot) =>
  draft.rawText === snapshot.rawText &&
  getCaptureDescription(draft) === snapshot.description &&
  JSON.stringify(getCaptureValues(draft)) === JSON.stringify(snapshot.values);

export type CaptureSubmission = {
  creationId: string;
  snapshot: CaptureSnapshot;
  /**
   * failed = server từ chối (chưa lưu, sửa xong có thể dùng lại id); uncertain = không biết đã lưu chưa,
   * phải retry đúng id/payload; conflict = id đã thuộc nội dung khác, lần sau cần id mới.
   */
  status: "saving" | "failed" | "uncertain" | "conflict";
  error: string | null;
};

export type CaptureState = {
  draft: CaptureDraft;
  analyzing: { draftId: string; textRevision: number } | null;
  analysisError: string | null;
  submission: CaptureSubmission | null;
  /** Bấm Thêm khi AI đang chạy: chờ người dùng chọn đợi hoặc thêm với thông tin hiện có. */
  confirmingSubmit: boolean;
};

export type CaptureEvent =
  | { type: "text"; rawText: string }
  | { [K in keyof CaptureFields]: { type: "field"; key: K; value: CaptureFields[K] } }[keyof CaptureFields]
  | { type: "reset-field"; key: keyof CaptureFields }
  | { type: "confirm-dates" }
  | { type: "infer"; analysis: Pick<CaptureAnalysis, "draftId" | "textRevision" | "fields"> }
  | { type: "analysis/start"; draftId: string; textRevision: number }
  | { type: "analysis/success"; analysis: CaptureAnalysis }
  | { type: "analysis/failure"; draftId: string; textRevision: number; error: string }
  | { type: "submit/confirm" }
  | { type: "submit/dismiss" }
  | { type: "submit/start"; creationId: string; snapshot: CaptureSnapshot }
  | { type: "submit/success"; creationId: string; nextDraftId: string }
  | { type: "submit/failure"; creationId: string; error: string; kind: "failed" | "uncertain" | "conflict" };

export const createCaptureState = (draft: CaptureDraft): CaptureState => ({
  draft,
  analyzing: null,
  analysisError: null,
  submission: null,
  confirmingSubmit: false,
});

const isCurrent = (state: CaptureState, ref: { draftId: string; textRevision: number }) =>
  ref.draftId === state.draft.draftId && ref.textRevision === state.draft.textRevision;

export const isAnalyzingCurrent = (state: CaptureState) =>
  Boolean(state.analyzing && isCurrent(state, state.analyzing));

export const captureReducer = (state: CaptureState, event: CaptureEvent): CaptureState => {
  switch (event.type) {
    case "text":
      return { ...state, draft: setCaptureText(state.draft, event.rawText), analysisError: null, confirmingSubmit: false };
    case "field":
      return { ...state, draft: setCaptureField(state.draft, event.key, event.value as never) };
    case "reset-field":
      return { ...state, draft: resetCaptureField(state.draft, event.key) };
    case "confirm-dates":
      return { ...state, draft: confirmCaptureDates(state.draft) };
    case "infer":
      return { ...state, draft: mergeCaptureAnalysis(state.draft, event.analysis) };
    case "analysis/start":
      return { ...state, analyzing: { draftId: event.draftId, textRevision: event.textRevision }, analysisError: null };
    case "analysis/success": {
      // Chỉ nhận đúng request đang chờ: request cũ hơn, hoặc đã bị bỏ khi bấm Thêm, không được merge.
      if (!state.analyzing || state.analyzing.draftId !== event.analysis.draftId ||
        state.analyzing.textRevision !== event.analysis.textRevision) return state;
      return { ...state, analyzing: null, confirmingSubmit: false, draft: mergeCaptureAnalysis(state.draft, event.analysis) };
    }
    case "analysis/failure":
      if (!state.analyzing || state.analyzing.draftId !== event.draftId ||
        state.analyzing.textRevision !== event.textRevision) return state;
      return {
        ...state,
        analyzing: null,
        confirmingSubmit: false,
        analysisError: isCurrent(state, event) ? event.error : state.analysisError,
      };
    case "submit/confirm":
      return { ...state, confirmingSubmit: true };
    case "submit/dismiss":
      return { ...state, confirmingSubmit: false };
    case "submit/start":
      return {
        ...state,
        analyzing: null,
        confirmingSubmit: false,
        submission: { creationId: event.creationId, snapshot: event.snapshot, status: "saving", error: null },
      };
    case "submit/success": {
      if (state.submission?.creationId !== event.creationId) return state;
      // Chỉ xóa đúng bản đã gửi; nội dung gõ thêm trong lúc lưu được giữ lại.
      const cleared = sameContent(state.draft, state.submission.snapshot);
      return {
        ...state,
        submission: null,
        analyzing: cleared ? null : state.analyzing,
        draft: cleared ? createCaptureDraft({ draftId: event.nextDraftId }) : state.draft,
      };
    }
    case "submit/failure":
      if (state.submission?.creationId !== event.creationId) return state;
      return {
        ...state,
        submission: { ...state.submission, status: event.kind, error: event.error },
      };
  }
};

export type CaptureSubmitPlan =
  | { kind: "busy" }
  | { kind: "blocked"; reason: string }
  | { kind: "confirm-analysis" }
  /** creationId null = cần id mới; retry = gửi lại đúng snapshot trước. */
  | { kind: "submit"; creationId: string | null; snapshot: CaptureSnapshot; retry: boolean };

/**
 * Quyết định bấm Thêm làm gì. Lần gửi không rõ kết quả luôn được retry nguyên id/payload trước,
 * kể cả khi nháp đã đổi, để không tạo bản thứ hai khi bản cũ có thể đã lưu.
 */
export const planCaptureSubmit = (
  state: CaptureState,
  { withCurrentInfo = false }: { withCurrentInfo?: boolean } = {},
): CaptureSubmitPlan => {
  const { submission, draft } = state;
  if (submission?.status === "saving") return { kind: "busy" };
  if (submission?.status === "uncertain") {
    return { kind: "submit", creationId: submission.creationId, snapshot: submission.snapshot, retry: true };
  }
  const blocker = getCaptureSubmitBlocker(draft);
  if (blocker) return { kind: "blocked", reason: blocker };
  if (isAnalyzingCurrent(state) && !withCurrentInfo) return { kind: "confirm-analysis" };
  const reuse = submission?.status === "failed" && sameContent(draft, submission.snapshot);
  return {
    kind: "submit",
    creationId: reuse ? submission.creationId : null,
    snapshot: reuse ? submission.snapshot : captureSnapshot(draft),
    retry: false,
  };
};

export type CaptureDefaults = {
  myDay?: boolean;
  isImportant?: boolean;
  courseId?: string | null;
  myDayWhenNoDue?: boolean;
};

/** Snapshot → input action quick-add. Mặc định của nơi đặt composer chỉ áp khi nháp chưa có giá trị. */
export const toQuickAddInput = (
  snapshot: CaptureSnapshot,
  creationId: string,
  { boardId, listId, defaults }: { boardId?: string; listId?: string; defaults?: CaptureDefaults },
) => {
  const { values } = snapshot;
  return {
    creationId,
    title: values.title,
    boardId,
    listId,
    description: snapshot.description || undefined,
    courseId: snapshot.origins.courseId === "unset" ? defaults?.courseId ?? null : values.courseId,
    dueDate: values.deadline?.dueDate ?? null,
    deadlineOn: values.deadline?.deadlineOn ?? null,
    scheduledOn: values.schedule?.scheduledOn ?? null,
    scheduledStartAt: values.schedule?.scheduledStartAt ?? null,
    scheduledEndAt: values.schedule?.scheduledEndAt ?? null,
    reminder: values.deadline ? values.reminder : null,
    isImportant: values.isImportant || Boolean(defaults?.isImportant),
    myDay: Boolean(defaults?.myDay) || (Boolean(defaults?.myDayWhenNoDue) && !values.deadline),
    checklistItems: values.checklistItems,
  };
};
