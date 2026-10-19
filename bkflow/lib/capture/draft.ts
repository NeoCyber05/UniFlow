import type { TaskDeadline, TaskSchedule } from "@/lib/cards/task-schedule";

import type { CaptureAnalysis } from "./analysis";
import type { CaptureSource } from "./source";

export type CaptureFields = {
  title: string;
  deadline: TaskDeadline | null;
  schedule: TaskSchedule | null;
  /** Reminder offset in minutes as stored on Card.reminder ("0", "60", …); null = none. */
  reminder: string | null;
  isImportant: boolean;
  courseId: string | null;
  checklistItems: string[];
};

export type CaptureFieldKey = keyof CaptureFields;
export type FieldOrigin = "manual" | "inferred" | "unset";
export type CaptureField<T> = { value: T; origin: FieldOrigin };

export type CaptureDraft = {
  draftId: string;
  textRevision: number;
  rawText: string;
  source: CaptureSource | null;
  fields: { [K in CaptureFieldKey]: CaptureField<CaptureFields[K]> };
  /** Fields the user must confirm or change before saving (ambiguous time, past date, …). */
  issues: Partial<Record<CaptureFieldKey, string>>;
};

const EMPTY: CaptureFields = {
  title: "",
  deadline: null,
  schedule: null,
  reminder: null,
  isImportant: false,
  courseId: null,
  checklistItems: [],
};

const KEYS = Object.keys(EMPTY) as CaptureFieldKey[];

const emptyFields = () =>
  Object.fromEntries(KEYS.map((key) => [key, { value: EMPTY[key], origin: "unset" }])) as CaptureDraft["fields"];

export const createCaptureDraft = (draftId: string, source: CaptureSource | null = null): CaptureDraft => ({
  draftId,
  textRevision: 0,
  rawText: "",
  source,
  fields: emptyFields(),
  issues: {},
});

export const getCaptureFieldValues = (draft: CaptureDraft): CaptureFields =>
  Object.fromEntries(KEYS.map((key) => [key, draft.fields[key].value])) as CaptureFields;

/** User edit: wins over any inference; null is a deliberate clear. Clears that field's issue. */
export const setCaptureField = <K extends CaptureFieldKey>(draft: CaptureDraft, key: K, value: CaptureFields[K]): CaptureDraft => {
  const { [key]: _resolved, ...issues } = draft.issues;
  return { ...draft, fields: { ...draft.fields, [key]: { value, origin: "manual" } }, issues };
};

/**
 * New text = new revision. Old inferences no longer match the text, so they reset;
 * `inferred` (deterministic parse of the new text, e.g. quick-add tokens) fills non-manual fields.
 */
export const setCaptureText = (
  draft: CaptureDraft,
  rawText: string,
  inferred: Partial<CaptureFields> = { title: rawText.replace(/\s+/g, " ").trim() },
): CaptureDraft => {
  const fields = { ...draft.fields };
  for (const key of KEYS) {
    if (fields[key].origin === "manual") continue;
    const value = inferred[key];
    (fields as Record<CaptureFieldKey, CaptureField<unknown>>)[key] =
      value === undefined || value === null || value === "" ? { value: EMPTY[key], origin: "unset" } : { value, origin: "inferred" };
  }
  return { ...draft, rawText, textRevision: draft.textRevision + 1, fields, issues: {} };
};

/** AI result applies only to the same draft + text revision, and never over a manual field. */
export const mergeCaptureAnalysis = (draft: CaptureDraft, analysis: CaptureAnalysis): CaptureDraft => {
  if (analysis.draftId !== draft.draftId || analysis.textRevision !== draft.textRevision) return draft;
  const fields = { ...draft.fields };
  const issues = { ...draft.issues };
  for (const key of KEYS) {
    if (fields[key].origin === "manual" || !(key in analysis.fields)) continue;
    (fields as Record<CaptureFieldKey, CaptureField<unknown>>)[key] = { value: analysis.fields[key] ?? EMPTY[key], origin: "inferred" };
  }
  for (const issue of analysis.issues) {
    if (fields[issue.field].origin !== "manual") issues[issue.field] = issue.reason;
  }
  return { ...draft, fields, issues };
};

export type CaptureSubmission = { snapshot: CaptureDraft; creationId: string };

export type CaptureState = {
  draft: CaptureDraft;
  /** Text revision of the analysis in flight, if any. */
  analyzing: number | null;
  submitting: CaptureSubmission | null;
  /** Send whose outcome is unknown (network error); must be retried before sending anything else. */
  unsettled: CaptureSubmission | null;
  confirmWhileAnalyzing: boolean;
  error: string | null;
};

export type CaptureEvent =
  | { type: "text"; rawText: string; inferred?: Partial<CaptureFields> }
  | { type: "field"; key: CaptureFieldKey; value: CaptureFields[CaptureFieldKey] }
  | { type: "drop-source" }
  | { type: "analyze-start" }
  | { type: "analyze-result"; analysis: CaptureAnalysis }
  | { type: "analyze-error"; textRevision: number; error: string }
  | { type: "submit"; creationId: string; force?: boolean }
  | { type: "retry-unsettled" }
  | { type: "submit-success"; creationId: string; nextDraftId: string }
  | { type: "submit-error"; creationId: string; error: string; ambiguous: boolean };

export const createCaptureState = (draft: CaptureDraft): CaptureState => ({
  draft,
  analyzing: null,
  submitting: null,
  unsettled: null,
  confirmWhileAnalyzing: false,
  error: null,
});

const ISSUE_PREFIX = "Kiểm tra lại trước khi thêm: ";

export const captureReducer = (state: CaptureState, event: CaptureEvent): CaptureState => {
  switch (event.type) {
    case "text":
      return { ...state, draft: setCaptureText(state.draft, event.rawText, event.inferred), confirmWhileAnalyzing: false };
    case "field":
      return { ...state, draft: setCaptureField(state.draft, event.key, event.value) };
    case "drop-source":
      return { ...state, draft: { ...state.draft, source: null } };
    case "analyze-start":
      return { ...state, analyzing: state.draft.textRevision };
    case "analyze-result": {
      const analyzing = state.analyzing === event.analysis.textRevision ? null : state.analyzing;
      // The draft being saved is frozen; a late result must not fork it.
      if (state.submitting?.snapshot === state.draft) return { ...state, analyzing };
      return { ...state, analyzing, draft: mergeCaptureAnalysis(state.draft, event.analysis) };
    }
    case "analyze-error":
      return state.analyzing === event.textRevision ? { ...state, analyzing: null } : state;
    case "retry-unsettled":
      if (state.submitting || !state.unsettled) return state;
      return { ...state, submitting: state.unsettled, error: null };
    case "submit": {
      if (state.submitting) return state;
      if (state.unsettled) {
        if (state.unsettled.snapshot !== state.draft) {
          return { ...state, error: "Chưa rõ lần gửi trước đã lưu chưa. Hãy thử lại lần gửi trước trước khi thêm nội dung mới." };
        }
        return { ...state, submitting: state.unsettled, error: null };
      }
      const { draft } = state;
      if (!draft.fields.title.value.trim()) return { ...state, error: "Vui lòng nhập tiêu đề." };
      const issues = Object.values(draft.issues);
      if (issues.length > 0) return { ...state, error: ISSUE_PREFIX + issues.join(" ") };
      if (state.analyzing === draft.textRevision && !event.force) return { ...state, confirmWhileAnalyzing: true };
      return { ...state, submitting: { snapshot: draft, creationId: event.creationId }, confirmWhileAnalyzing: false, error: null };
    }
    case "submit-success": {
      if (state.submitting?.creationId !== event.creationId) return state;
      const draft = state.draft === state.submitting.snapshot ? createCaptureDraft(event.nextDraftId) : state.draft;
      return { ...state, draft, submitting: null, unsettled: null, error: null };
    }
    case "submit-error": {
      if (state.submitting?.creationId !== event.creationId) return state;
      return { ...state, submitting: null, unsettled: event.ambiguous ? state.submitting : null, error: event.error };
    }
  }
};
