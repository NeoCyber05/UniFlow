"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CalendarDays,
  Bell,
  ListChecks,
  Loader2,
  Plus,
  SlidersHorizontal,
  Star,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { analyzeSmartCapture } from "@/actions/ai/analyze-smart-capture";
import { quickAddCard } from "@/actions/cards/quick-add-card";
import {
  captureReducer,
  createCaptureDraft,
  createCaptureState,
  getCaptureFieldValues,
  setCaptureText,
  type CaptureEvent,
  type CaptureFieldKey,
  type CaptureFields,
  type CaptureState,
  type CaptureSubmission,
} from "@/lib/capture/draft";
import { formatInZone, formatSourceDescription, type CaptureSource } from "@/lib/capture/source";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";
import {
  parseQuickAdd,
  type QuickAddCourse,
  type QuickAddMember,
} from "@/lib/my-tasks/parse-quick-add";
import { cn } from "@/lib/utils";

export type QuickAddDefaults = {
  myDay?: boolean;
  isImportant?: boolean;
  courseId?: string | null;
  assigneeUserIds?: string[];
  /** Không gõ @ngày → ghim Hôm nay (tab Việc cần làm) */
  myDayWhenNoDue?: boolean;
};

export type CaptureComposerProps = {
  /** Bỏ trống → bảng kỳ hiện tại (server tự tìm) */
  boardId?: string;
  listId?: string;
  courses?: QuickAddCourse[];
  members?: QuickAddMember[];
  defaults?: QuickAddDefaults;
  placeholder?: string;
  disabled?: boolean;
  /** Hiện thay cho gợi ý cú pháp khi disabled */
  disabledHint?: React.ReactNode;
  /** Slot bên phải ô nhập (vd nút ✨ Smart Capture, chọn bảng) */
  trailing?: React.ReactNode;
  onCreated?: () => void;
  compact?: boolean;
  /** Đoạn chọn từ trang khác: điền sẵn nội dung, lưu kèm vào mô tả. */
  initialSource?: CaptureSource;
  /** Chạy AI một lần khi mở (cửa sổ capture từ extension). */
  autoAnalyze?: boolean;
};

const REMINDER_OPTIONS: Array<[string, string]> = [
  ["0", "Đúng hạn"],
  ["15", "Trước 15 phút"],
  ["60", "Trước 1 giờ"],
  ["1440", "Trước 1 ngày"],
  ["2880", "Trước 2 ngày"],
  ["10080", "Trước 1 tuần"],
];
const DESCRIPTION_MAX_LENGTH = 3_000;

const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// datetime-local works in the browser's zone; values are stored as UTC ISO.
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

const formatInstant = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));

const formatDay = (day: string) => {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
};

const describeDeadline = (deadline: CaptureFields["deadline"]) =>
  deadline?.dueDate ? `Hạn ${formatInstant(deadline.dueDate)}` : deadline?.deadlineOn ? `Hạn ${formatDay(deadline.deadlineOn)} (cả ngày)` : null;

const describeSchedule = (schedule: CaptureFields["schedule"]) => {
  if (schedule?.scheduledStartAt && schedule.scheduledEndAt) {
    return `Làm ${formatInstant(schedule.scheduledStartAt)} → ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(schedule.scheduledEndAt))}`;
  }
  return schedule?.scheduledOn ? `Làm ngày ${formatDay(schedule.scheduledOn)}` : null;
};

const newId = () => crypto.randomUUID();

export const CaptureComposer = ({
  boardId,
  listId,
  courses,
  members,
  defaults,
  placeholder = "Thêm việc…",
  disabled = false,
  disabledHint,
  trailing,
  onCreated,
  compact = false,
  initialSource,
  autoAnalyze = false,
}: CaptureComposerProps) => {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CaptureState>(() => {
    const draft = createCaptureDraft(newId(), initialSource ?? null);
    return createCaptureState(initialSource ? setCaptureText(draft, initialSource.selectedText) : draft);
  });
  // The ref is the source of truth so submit locks synchronously (double click / Enter race).
  const stateRef = useRef(state);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const dispatch = (event: CaptureEvent) => {
    stateRef.current = captureReducer(stateRef.current, event);
    setState(stateRef.current);
    return stateRef.current;
  };

  const { draft, submitting, unsettled, analyzing } = state;
  const fields = getCaptureFieldValues(draft);
  const isAnalyzing = analyzing === draft.textRevision;
  const hint = members ? "+tên  ! quan trọng  @mai  @t6  @15/10" : "#môn  ! quan trọng  @mai  @t6  @15/10";
  const sourceDescription = useMemo(() => (draft.source ? formatSourceDescription(draft.source) : null), [draft.source]);
  const sourceTooLong = (sourceDescription?.length ?? 0) > DESCRIPTION_MAX_LENGTH;

  const setField = <K extends CaptureFieldKey>(key: K, value: CaptureFields[K]) => dispatch({ type: "field", key, value });

  const onTextChange = (rawText: string) => {
    const parsed = parseQuickAdd(rawText, { courses, members });
    dispatch({
      type: "text",
      rawText,
      inferred: {
        title: parsed.title,
        deadline: parsed.deadlineOn ? { dueDate: null, deadlineOn: parsed.deadlineOn } : null,
        isImportant: parsed.isImportant || undefined,
        courseId: parsed.courseId,
      },
    });
  };

  const analyze = async () => {
    const current = dispatch({ type: "analyze-start" }).draft;
    if (!current.rawText.trim()) return;
    const now = new Date();
    try {
      const result = await analyzeSmartCapture({
        mode: "quick",
        boardId,
        rawText: current.rawText,
        draftId: current.draftId,
        textRevision: current.textRevision,
        timeZone: browserTimeZone(),
        nowIso: now.toISOString(),
        timezoneOffsetMinutes: now.getTimezoneOffset(),
        ...(current.source ? { source: current.source } : {}),
      });
      if (result.data) {
        dispatch({ type: "analyze-result", analysis: result.data });
        if (result.data.issues.length > 0) setDetailsOpen(true);
        return;
      }
      throw new Error(result.error ?? "AI chưa đọc được câu này.");
    } catch (error) {
      dispatch({ type: "analyze-error", textRevision: current.textRevision, error: String(error) });
      toast.error(error instanceof Error ? error.message : "AI chưa đọc được câu này. Bạn vẫn có thể thêm thủ công.");
    }
  };

  const send = async (submission: CaptureSubmission) => {
    const values = getCaptureFieldValues(submission.snapshot);
    const hasDeadline = Boolean(values.deadline?.dueDate || values.deadline?.deadlineOn);
    let ambiguous = false;
    let error: string | undefined;
    try {
      const result = await quickAddCard({
        creationId: submission.creationId,
        title: values.title,
        boardId,
        listId,
        courseId: values.courseId ?? defaults?.courseId ?? undefined,
        assigneeUserIds: defaults?.assigneeUserIds,
        dueDate: values.deadline?.dueDate ? new Date(values.deadline.dueDate) : undefined,
        deadlineOn: values.deadline?.deadlineOn ?? undefined,
        scheduledOn: values.schedule?.scheduledOn ?? undefined,
        scheduledStartAt: values.schedule?.scheduledStartAt ?? undefined,
        scheduledEndAt: values.schedule?.scheduledEndAt ?? undefined,
        reminder: hasDeadline ? values.reminder : null,
        checklistItems: values.checklistItems,
        ...(submission.snapshot.source ? { source: submission.snapshot.source } : {}),
        isImportant: values.isImportant || Boolean(defaults?.isImportant),
        myDay: Boolean(defaults?.myDay) || (Boolean(defaults?.myDayWhenNoDue) && !hasDeadline),
      });
      const fieldError = result.fieldErrors ? Object.values(result.fieldErrors).flat().find(Boolean) : undefined;
      error = result.error ?? (fieldError as string | undefined);
      ambiguous = result.errorCode === "TRANSPORT";
      if (!error && !result.data) {
        error = "Có lỗi xảy ra, thử lại sau.";
        ambiguous = true;
      }
    } catch {
      error = "Mất kết nối. Việc có thể đã được lưu; hãy thử lại để kiểm tra.";
      ambiguous = true;
    }

    if (error) {
      // Draft stays; with an unknown outcome the same id is kept so a retry cannot duplicate.
      dispatch({ type: "submit-error", creationId: submission.creationId, error, ambiguous });
      inputRef.current?.focus();
      return;
    }

    dispatch({ type: "submit-success", creationId: submission.creationId, nextDraftId: newId() });
    setDetailsOpen(false);
    await queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
    onCreated?.();
  };

  const submit = (force = false) => {
    if (disabled || sourceTooLong) return;
    const before = stateRef.current.submitting;
    const next = dispatch({ type: "submit", creationId: newId(), force });
    if (next.submitting && next.submitting !== before) void send(next.submitting);
    else if (next.error) inputRef.current?.focus();
  };

  const retryUnsettled = () => {
    const next = dispatch({ type: "retry-unsettled" });
    if (next.submitting) void send(next.submitting);
  };

  // Once per mount; StrictMode re-runs effects and would bill a second AI call.
  const autoAnalyzed = useRef(false);
  useEffect(() => {
    if (!autoAnalyze || autoAnalyzed.current) return;
    autoAnalyzed.current = true;
    void analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- analyze reads the latest draft from stateRef
  }, [autoAnalyze]);

  const chips: Array<{ key: CaptureFieldKey; icon: React.ComponentType<{ className?: string }>; label: string }> = [];
  const deadlineLabel = describeDeadline(fields.deadline);
  const scheduleLabel = describeSchedule(fields.schedule);
  const course = courses?.find((item) => item.id === fields.courseId);
  if (deadlineLabel) chips.push({ key: "deadline", icon: CalendarDays, label: deadlineLabel });
  if (scheduleLabel) chips.push({ key: "schedule", icon: CalendarClock, label: scheduleLabel });
  if (fields.reminder && deadlineLabel) {
    chips.push({ key: "reminder", icon: Bell, label: REMINDER_OPTIONS.find(([value]) => value === fields.reminder)?.[1] ?? "Nhắc" });
  }
  if (fields.isImportant) chips.push({ key: "isImportant", icon: Star, label: "Quan trọng" });
  if (course) chips.push({ key: "courseId", icon: BookOpen, label: course.code ?? course.name });
  if (fields.checklistItems.length > 0) chips.push({ key: "checklistItems", icon: ListChecks, label: `${fields.checklistItems.length} việc con` });

  const clearValue: { [K in CaptureFieldKey]: CaptureFields[K] } = {
    title: "",
    deadline: null,
    schedule: null,
    reminder: null,
    isImportant: false,
    courseId: null,
    checklistItems: [],
  };
  const issues = Object.entries(draft.issues) as Array<[CaptureFieldKey, string]>;
  const busy = Boolean(submitting);
  const deadlineMode = fields.deadline?.dueDate ? "time" : fields.deadline?.deadlineOn ? "day" : "none";
  const scheduleMode = fields.schedule?.scheduledStartAt ? "range" : fields.schedule?.scheduledOn ? "day" : "none";
  const inputClass = "rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100";

  return (
    <div className="space-y-1.5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100",
          compact ? "py-1.5" : "py-2.5",
          disabled && "opacity-60",
        )}
      >
        {busy
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" aria-hidden />
          : <Plus className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />}
        <input
          ref={inputRef}
          value={draft.rawText}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter that confirms a Vietnamese IME composition must not submit.
            if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
            if (event.key === "Escape" && detailsOpen) setDetailsOpen(false);
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Thêm việc nhanh"
          aria-invalid={Boolean(state.error)}
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
        {!disabled && draft.rawText.trim() && (
          <>
            <button
              type="button"
              onClick={analyze}
              disabled={isAnalyzing}
              title="Đọc câu bằng AI: hạn, lịch làm, môn, việc con"
              aria-label="Đọc câu bằng AI"
              className="rounded-md p-1 text-violet-500 hover:bg-violet-50 disabled:opacity-50"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              aria-label="Chi tiết hạn, lịch, nhắc"
              title="Chi tiết"
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              type="submit"
              disabled={busy || sourceTooLong}
              className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Thêm
            </button>
          </>
        )}
        {trailing}
      </form>

      <div className="flex min-h-5 flex-wrap items-center gap-1.5 px-1 text-[11px] text-neutral-400" aria-live="polite">
        {disabled && disabledHint ? (
          disabledHint
        ) : chips.length > 0 ? (
          chips.map(({ key, icon: Icon, label }) => (
            <span
              key={key}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1",
                draft.issues[key] ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-violet-50 text-violet-700 ring-violet-200",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
              {draft.fields[key].origin === "inferred" && <span className="sr-only">(tự nhận diện)</span>}
              <button
                type="button"
                onClick={() => setField(key, clearValue[key])}
                aria-label={`Bỏ ${label}`}
                className="rounded-full hover:bg-black/5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        ) : (
          !compact && <span>{hint}</span>
        )}
        {isAnalyzing && <span className="text-violet-500">AI đang đọc…</span>}
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1 px-1 text-xs text-amber-800">
          {issues.map(([key, reason]) => (
            <li key={key} className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="flex-1">{reason}</span>
              <button
                type="button"
                onClick={() => setField(key, fields[key])}
                className="rounded border border-amber-300 px-1.5 py-0.5 hover:bg-amber-50"
              >
                Giữ như vậy
              </button>
              <button type="button" onClick={() => setDetailsOpen(true)} className="underline">
                Sửa
              </button>
            </li>
          ))}
        </ul>
      )}

      {state.confirmWhileAnalyzing && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-neutral-600" role="status">
          AI vẫn đang đọc câu này.
          <button type="button" onClick={() => submit(true)} className="rounded border border-neutral-300 px-1.5 py-0.5 hover:bg-neutral-50">
            Thêm với thông tin hiện có
          </button>
          <span className="text-neutral-400">hoặc chờ AI xong rồi bấm Thêm.</span>
        </div>
      )}

      {state.error && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-red-600" role="alert">
          {state.error}
          {unsettled && !busy && (
            <button type="button" onClick={retryUnsettled} className="rounded border border-red-300 px-1.5 py-0.5 hover:bg-red-50">
              Thử lại lần gửi trước
            </button>
          )}
        </div>
      )}

      {sourceDescription && (
        <details className="px-1 text-xs text-neutral-600">
          <summary className="cursor-pointer">
            Nguồn sẽ lưu vào mô tả ({sourceDescription.length}/{DESCRIPTION_MAX_LENGTH} ký tự)
          </summary>
          <p className="mt-1">
            {draft.source?.messageSentAt
              ? `Tin gửi lúc ${formatInZone(draft.source.messageSentAt, draft.source.timeZone)}; "hôm nay", "chiều nay" tính theo ngày này.`
              : "Không đọc được giờ gửi tin; nếu câu có \"hôm nay\", \"mai\" hãy kiểm tra lại ngày."}
          </p>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-2 font-sans">{sourceDescription}</pre>
          {sourceTooLong && <p className="text-red-600" role="alert">Trích đoạn quá dài. Hãy rút gọn đoạn chọn hoặc bỏ đính kèm nguồn.</p>}
          <button type="button" onClick={() => dispatch({ type: "drop-source" })} className="mt-1 underline">
            Bỏ đính kèm nguồn
          </button>
        </details>
      )}

      {detailsOpen && !disabled && (
        <div className="grid gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-700 sm:grid-cols-2">
          <fieldset className="space-y-1">
            <legend className="font-medium">Hạn nộp</legend>
            <div className="flex flex-wrap gap-1">
              <select
                aria-label="Kiểu hạn nộp"
                value={deadlineMode}
                onChange={(event) => {
                  const mode = event.target.value;
                  setField("deadline", mode === "none" ? null : mode === "day"
                    ? { dueDate: null, deadlineOn: fields.deadline?.deadlineOn ?? new Date().toLocaleDateString("en-CA") }
                    : { dueDate: fields.deadline?.dueDate ?? fromLocalInput(`${fields.deadline?.deadlineOn ?? new Date().toLocaleDateString("en-CA")}T17:00`), deadlineOn: null });
                }}
                className={inputClass}
              >
                <option value="none">Không có</option>
                <option value="day">Cả ngày</option>
                <option value="time">Có giờ</option>
              </select>
              {deadlineMode === "day" && (
                <input type="date" aria-label="Ngày hạn" value={fields.deadline?.deadlineOn ?? ""} className={inputClass}
                  onChange={(event) => setField("deadline", event.target.value ? { dueDate: null, deadlineOn: event.target.value } : null)} />
              )}
              {deadlineMode === "time" && (
                <input type="datetime-local" aria-label="Thời điểm hạn" value={toLocalInput(fields.deadline?.dueDate ?? null)} className={inputClass}
                  onChange={(event) => setField("deadline", event.target.value ? { dueDate: fromLocalInput(event.target.value), deadlineOn: null } : null)} />
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="font-medium">Lịch làm</legend>
            <div className="flex flex-wrap gap-1">
              <select
                aria-label="Kiểu lịch làm"
                value={scheduleMode}
                onChange={(event) => {
                  const mode = event.target.value;
                  const day = fields.schedule?.scheduledOn ?? new Date().toLocaleDateString("en-CA");
                  setField("schedule", mode === "none" ? null : mode === "day"
                    ? { scheduledOn: day, scheduledStartAt: null, scheduledEndAt: null }
                    : { scheduledOn: null, scheduledStartAt: fromLocalInput(`${day}T19:00`), scheduledEndAt: fromLocalInput(`${day}T20:00`) });
                }}
                className={inputClass}
              >
                <option value="none">Không có</option>
                <option value="day">Theo ngày</option>
                <option value="range">Khoảng giờ</option>
              </select>
              {scheduleMode === "day" && (
                <input type="date" aria-label="Ngày làm" value={fields.schedule?.scheduledOn ?? ""} className={inputClass}
                  onChange={(event) => setField("schedule", event.target.value ? { scheduledOn: event.target.value, scheduledStartAt: null, scheduledEndAt: null } : null)} />
              )}
              {scheduleMode === "range" && (
                <>
                  <input type="datetime-local" aria-label="Bắt đầu" value={toLocalInput(fields.schedule?.scheduledStartAt ?? null)} className={inputClass}
                    onChange={(event) => setField("schedule", { scheduledOn: null, scheduledStartAt: fromLocalInput(event.target.value), scheduledEndAt: fields.schedule?.scheduledEndAt ?? null })} />
                  <input type="datetime-local" aria-label="Kết thúc" value={toLocalInput(fields.schedule?.scheduledEndAt ?? null)} className={inputClass}
                    onChange={(event) => setField("schedule", { scheduledOn: null, scheduledStartAt: fields.schedule?.scheduledStartAt ?? null, scheduledEndAt: fromLocalInput(event.target.value) })} />
                </>
              )}
            </div>
          </fieldset>

          <label className="space-y-1">
            <span className="block font-medium">Nhắc</span>
            <select
              value={fields.reminder ?? ""}
              disabled={deadlineMode === "none"}
              onChange={(event) => setField("reminder", event.target.value || null)}
              className={cn(inputClass, "w-full")}
            >
              <option value="">{deadlineMode === "none" ? "Cần có hạn nộp" : "Không nhắc"}</option>
              {REMINDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          {courses && courses.length > 0 && (
            <label className="space-y-1">
              <span className="block font-medium">Môn</span>
              <select value={fields.courseId ?? ""} onChange={(event) => setField("courseId", event.target.value || null)} className={cn(inputClass, "w-full")}>
                <option value="">{defaults?.courseId ? "Mặc định" : "Không"}</option>
                {courses.map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ${item.name}` : item.name}</option>)}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={fields.isImportant} onChange={(event) => setField("isImportant", event.target.checked)} />
            Quan trọng
          </label>

          <label className="space-y-1 sm:col-span-2">
            <span className="block font-medium">Việc con (mỗi dòng một việc, tối đa 20)</span>
            <textarea
              rows={3}
              value={fields.checklistItems.join("\n")}
              onChange={(event) => setField("checklistItems", event.target.value.split("\n").slice(0, 20))}
              className={cn(inputClass, "w-full")}
            />
          </label>

          <p className="text-[11px] text-neutral-400 sm:col-span-2">Giờ hiển thị theo múi giờ máy: {browserTimeZone()}.</p>
        </div>
      )}
    </div>
  );
};
