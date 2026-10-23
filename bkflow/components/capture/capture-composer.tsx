"use client";

import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  ImagePlus,
  ListChecks,
  Loader2,
  Plus,
  Repeat,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { scale, spring, transition, useTempoTransition } from "@animate-ui/react/utils/motion";
import { toast } from "sonner";

import { TaskRepeatEditor } from "@/components/task-repeat-editor";
import { ImageImportDialog, readCaptureImage, readCaptureText, type CaptureImageResult } from "@/components/capture/image-import-dialog";
import { CoursePicker, getCourseOptionLabel } from "@/components/courses/course-picker";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { analyzeSmartCapture } from "@/actions/ai/analyze-smart-capture";
import { quickAddCard } from "@/actions/cards/quick-add-card";
import { CAPTURE_ALREADY_PROCESSED, CAPTURE_REJECTED } from "@/lib/cards/capture-error-codes";
import type { TaskDeadline } from "@/lib/cards/task-schedule";
import { formatRepeat } from "@/lib/cards/task-repeat";
import { getZonedDayKey, zonedTimeToIso, type CaptureIssue } from "@/lib/capture/analysis";
import { imageItemToCaptureFields } from "@/lib/capture/image-import";
import { tr } from "@/lib/i18n";
import { isStudyPlanRequest } from "@/lib/study-plan/validate";
import {
  captureReducer,
  createCaptureDraft,
  createCaptureState,
  getCaptureDescription,
  isAnalyzingCurrent,
  needsDateConfirmation,
  isDateConfirmed,
  planCaptureSubmit,
  toQuickAddInput,
  type CaptureDefaults,
  type CaptureFields,
} from "@/lib/capture/draft";
import { CAPTURE_TIME_ZONE, type CaptureSource } from "@/lib/capture/source";
import { isCourseRef } from "@/lib/courses/hust-catalog";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";
import { parseQuickAdd, type QuickAddCourse, type QuickAddMember } from "@/lib/my-tasks/parse-quick-add";
import { cn } from "@/lib/utils";
import type { CardWithAssignees } from "@/types";

const AI_DEBOUNCE_MS = 900;
const AI_MIN_TEXT_LENGTH = 6;
const REMINDER_OPTIONS = [["none", "Không nhắc"], ["0", "Đúng hạn"], ["15", "Trước 15 phút"], ["60", "Trước 1 giờ"], ["1440", "Trước 1 ngày"], ["2880", "Trước 2 ngày"], ["10080", "Trước 1 tuần"]] as const;
const FIELD_LABELS: Record<keyof CaptureFields, string> = {
  title: "Tiêu đề",
  deadline: "Hạn nộp",
  schedule: "Lịch làm",
  reminder: "Nhắc",
  repeat: "Lặp lại",
  isImportant: "Ưu tiên",
  courseId: "Danh mục",
  checklistItems: "Việc cần làm",
};

const newId = () => globalThis.crypto.randomUUID();

const formatDay = (key: string) => {
  const [year, month, day] = key.split("-");
  return `${Number(day)}/${Number(month)}/${year}`;
};
const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: CAPTURE_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const formatInstant = (iso: string) => `${formatDay(getZonedDayKey(iso, CAPTURE_TIME_ZONE))} ${timeOf(iso)}`;

/** Ngày tuyệt đối có năm và múi giờ, không để người dùng đoán "mai" là ngày nào. */
export const formatDeadlinePreview = (deadline: TaskDeadline) =>
  deadline.dueDate ? `${formatInstant(deadline.dueDate)} (GMT+7)` : `${formatDay(deadline.deadlineOn!)} · cả ngày`;

const parserFields = (rawText: string, courses?: QuickAddCourse[], members?: QuickAddMember[]) => {
  const parsed = parseQuickAdd(rawText, { courses, members });
  const fields: Partial<CaptureFields> = {};
  if (parsed.title) fields.title = parsed.title;
  if (parsed.deadlineOn) fields.deadline = { dueDate: null, deadlineOn: parsed.deadlineOn };
  if (parsed.isImportant) fields.isImportant = true;
  if (parsed.courseId) fields.courseId = parsed.courseId;
  return fields;
};

const initialState = ({ source, courses, members }: { source: CaptureSource | null; courses?: QuickAddCourse[]; members?: QuickAddMember[] }) => {
  const draft = createCaptureDraft({ draftId: newId(), rawText: source?.selectedText ?? "", source });
  const state = createCaptureState(draft);
  return draft.rawText
    ? captureReducer(state, { type: "infer", analysis: { draftId: draft.draftId, textRevision: 0, fields: parserFields(draft.rawText, courses, members) } })
    : state;
};

const reminderLabel = (value: string) => REMINDER_OPTIONS.find(([key]) => key === value)?.[1] ?? `Trước ${value} phút`;

type CaptureComposerProps = {
  /** Bỏ trống → bảng kỳ hiện tại (server tự tìm); khi đó không gọi AI. */
  boardId?: string;
  listId?: string;
  courses?: QuickAddCourse[];
  members?: QuickAddMember[];
  defaults?: CaptureDefaults & { assigneeUserIds?: string[] };
  placeholder?: string;
  disabled?: boolean;
  disabledHint?: React.ReactNode;
  trailing?: React.ReactNode;
  compact?: boolean;
  /** "card": ô soạn mở rộng kiểu Todoist (tiêu đề, chip chọn nhanh, Hủy/Thêm). */
  variant?: "bar" | "card";
  onCancel?: () => void;
  /** Đoạn chọn từ trang ngoài: thành rawText ban đầu và trích đoạn trong mô tả. */
  initialSource?: CaptureSource | null;
  /** Tắt gợi ý AI (vẫn có cú pháp #môn @ngày ! và nhập tay). */
  ai?: boolean;
  onCreated?: (card: CardWithAssignees) => void;
};

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
  compact = false,
  variant = "bar",
  onCancel,
  initialSource = null,
  ai = true,
  onCreated,
}: CaptureComposerProps) => {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const aiUnavailable = useRef(false);
  const detailsId = useId();
  const [state, dispatch] = useReducer(captureReducer, undefined, () =>
    initialState({ source: initialSource, courses, members }));
  const [detailsOpen, setDetailsOpen] = useState(Boolean(initialSource));
  const [notice, setNotice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  // Ảnh đính kèm chờ gửi; bấm Thêm mới gửi AI cùng chữ đang gõ
  const [attachedImage, setAttachedImage] = useState<Blob | null>(null);
  const [imageImport, setImageImport] = useState<CaptureImageResult | null>(null);
  const [readingImage, setReadingImage] = useState(false);
  const popIn = useTempoTransition(spring.checkPop);
  const popOut = useTempoTransition(transition.popOut);
  const attachedPreview = useMemo(() => (attachedImage ? URL.createObjectURL(attachedImage) : null), [attachedImage]);
  useEffect(() => () => { if (attachedPreview) URL.revokeObjectURL(attachedPreview); }, [attachedPreview]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { draft, submission } = state;
  const { draftId, textRevision, rawText, source } = draft;
  const values = Object.fromEntries(Object.entries(draft.fields).map(([key, field]) => [key, field.value])) as CaptureFields;
  const isSaving = submission?.status === "saving";
  const analyzing = isAnalyzingCurrent(state);
  const aiEnabled = ai && Boolean(boardId) && !disabled;

  const assigneeUserIds = useMemo(
    () => parseQuickAdd(rawText, { courses, members }).assigneeUserIds,
    [rawText, courses, members],
  );

  // Cú pháp #môn @ngày ! là suy luận tức thì cho revision mới; lựa chọn tay luôn thắng.
  const onTextChange = (next: string) => {
    if (next === rawText) return;
    setNotice(null);
    dispatch({ type: "text", rawText: next });
    dispatch({ type: "infer", analysis: { draftId, textRevision: textRevision + 1, fields: parserFields(next, courses, members) } });
  };

  const studyPlan = !attachedImage && isStudyPlanRequest(rawText);

  useEffect(() => {
    if (!aiEnabled || attachedImage || studyPlan || aiUnavailable.current || rawText.trim().length < AI_MIN_TEXT_LENGTH) return;
    const request = { draftId, textRevision };
    const timer = setTimeout(async () => {
      dispatch({ type: "analysis/start", ...request });
      try {
        const result = await analyzeSmartCapture({
          mode: "quick",
          boardId: boardId!,
          rawText,
          ...request,
          timeZone: CAPTURE_TIME_ZONE,
          ...(source ? { source } : {}),
        });
        if (result.data) {
          dispatch({ type: "analysis/success", analysis: result.data });
          return;
        }
        const error = result.error ?? "AI chưa phân tích được.";
        if (/Chưa cấu hình AI/.test(error)) aiUnavailable.current = true;
        dispatch({ type: "analysis/failure", ...request, error });
      } catch {
        dispatch({ type: "analysis/failure", ...request, error: "Không kết nối được AI." });
      }
    }, AI_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [aiEnabled, attachedImage, studyPlan, boardId, draftId, textRevision, rawText, source]);

  const setField = <K extends keyof CaptureFields>(key: K, value: CaptureFields[K]) =>
    dispatch({ type: "field", key, value } as never);

  const submit = async (withCurrentInfo = false) => {
    if (disabled || submitting.current) return;
    if (attachedImage) {
      if (readingImage) return;
      setReadingImage(true);
      try {
        const result = await readCaptureImage(boardId!, attachedImage, [rawText.trim(), note.trim()].filter(Boolean).join("\n") || undefined);
        const { analysis } = result;
        // Đúng 1 việc → điền thẳng vào ô như khi gõ chữ; nhiều việc/thời khóa biểu mới cần bảng xem lại
        if (analysis.type === "tasks" && analysis.items.length <= 1) {
          const item = analysis.items[0];
          if (!item) {
            toast.error(tr("import.noTasks"));
            return;
          }
          const { deadline } = imageItemToCaptureFields(item);
          onTextChange(item.title);
          if (deadline) setField("deadline", deadline);
          if (item.description) setNote(item.description);
          setAttachedImage(null);
          inputRef.current?.focus();
        } else {
          setImageImport(result);
        }
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Không đọc được ảnh.");
      } finally {
        setReadingImage(false);
      }
      return;
    }
    if (studyPlan) {
      if (readingImage) return;
      setReadingImage(true);
      try {
        setImageImport(await readCaptureText(boardId!, [rawText.trim(), note.trim()].filter(Boolean).join("\n")));
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : tr("import.readError"));
      } finally {
        setReadingImage(false);
      }
      return;
    }
    const plan = planCaptureSubmit(state, { withCurrentInfo });
    if (plan.kind === "busy") return;
    if (plan.kind === "blocked") {
      setNotice(plan.reason);
      inputRef.current?.focus();
      return;
    }
    if (plan.kind === "confirm-analysis") {
      dispatch({ type: "submit/confirm" });
      return;
    }

    const creationId = plan.creationId ?? newId();
    submitting.current = true;
    setNotice(null);
    dispatch({ type: "submit/start", creationId, snapshot: plan.snapshot });

    try {
      const input = toQuickAddInput(plan.snapshot, creationId, { boardId, listId, defaults });
      const result = await quickAddCard({
        ...input,
        description: [plan.snapshot.description, note.trim()].filter(Boolean).join("\n\n") || undefined,
        assigneeUserIds: Array.from(new Set([...(defaults?.assigneeUserIds ?? []), ...assigneeUserIds])),
      });

      if (result.data) {
        dispatch({ type: "submit/success", creationId, nextDraftId: newId() });
        setNote("");
        if (plan.retry) toast.success("Đã lưu lần gửi trước. Nội dung mới vẫn còn trong ô nhập.");
        await queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
        // Môn danh mục/tự đặt vừa thành Course thật → nạp lại danh sách môn
        if (isCourseRef(input.courseId)) void queryClient.invalidateQueries({ queryKey: ["courses"] });
        onCreated?.(result.data);
        return;
      }

      const fieldError = result.fieldErrors ? Object.values(result.fieldErrors).flat().find(Boolean) : undefined;
      const error = result.error ?? (fieldError as string | undefined) ?? "Tạo việc thất bại.";
      // Chỉ lỗi server khẳng định chưa lưu mới cho đổi id; còn lại phải retry đúng bản cũ.
      const kind = result.errorCode === CAPTURE_ALREADY_PROCESSED
        ? "conflict"
        : fieldError || result.errorCode === CAPTURE_REJECTED || result.errorCode === "NO_CURRENT_WORKSPACE"
          ? "failed"
          : "uncertain";
      dispatch({ type: "submit/failure", creationId, error, kind });
      toast.error(error);
    } catch {
      dispatch({ type: "submit/failure", creationId, error: "Mất kết nối, chưa rõ đã lưu chưa.", kind: "uncertain" });
      toast.error("Mất kết nối, chưa rõ đã lưu chưa. Bấm Thêm để thử lại.");
    } finally {
      submitting.current = false;
      inputRef.current?.focus();
    }
  };

  const canImportImage = Boolean(boardId) && !disabled;
  // Dán/chọn ảnh → đính kèm; bấm Thêm thì AI đọc ảnh + chữ đang gõ, mở bảng xem lại
  const onPaste = (event: React.ClipboardEvent) => {
    if (!canImportImage) return;
    const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!image) return;
    event.preventDefault();
    setAttachedImage(image);
  };
  const imageControls = canImportImage && (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        title="Tạo từ ảnh (hoặc dán ảnh vào ô)"
        aria-label="Tạo việc từ ảnh"
        className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-violet-600"
      >
        <ImagePlus className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          const image = event.target.files?.[0];
          if (image) setAttachedImage(image);
          event.target.value = "";
        }}
      />
      {imageImport && (
        <ImageImportDialog
          boardId={boardId!}
          result={imageImport}
          onClose={() => setImageImport(null)}
          onImported={() => {
            setAttachedImage(null);
            onTextChange("");
            setNote("");
          }}
        />
      )}
    </>
  );
  // Ảnh đính kèm hiện phía trên ô nhập (kiểu chatbot); lúc AI đọc thì phủ loading lên ảnh
  const attachedPreviewBlock = (
    <>
      {studyPlan && (
        <p className="flex items-center gap-1.5 text-xs text-violet-600" role="status">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {readingImage ? tr("import.planning") : tr("import.studyPlanHint")}
        </p>
      )}
      <AnimatePresence initial={false}>
        {attachedPreview && (
          <motion.div
            key={attachedPreview}
            initial={{ opacity: 0, scale: scale.icon }}
            animate={{ opacity: 1, scale: 1, transition: popIn }}
            exit={{ opacity: 0, scale: scale.icon, transition: popOut }}
            className="relative h-16 w-16 origin-bottom-left"
          >
            <img src={attachedPreview} alt="Ảnh đính kèm" className="h-full w-full rounded-lg border border-neutral-200 object-cover" />
            {readingImage ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/60 motion-safe:animate-pulse" role="status">
                <Loader2 className="h-5 w-5 text-violet-600 motion-safe:animate-spin" aria-hidden="true" />
                <span className="sr-only">AI đang đọc ảnh…</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                aria-label="Bỏ ảnh"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-neutral-800 p-0.5 text-white shadow hover:bg-rose-600"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
  const inputPlaceholder = attachedImage ? "Yêu cầu cho AI về ảnh (tuỳ chọn), vd: chỉ lấy lịch thi" : placeholder;
  const canSubmit = Boolean(rawText.trim() || attachedImage);
  const busy = isSaving || readingImage;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      // IME tiếng Việt đang ghép chữ: Enter chỉ chốt chữ, không gửi.
      if (!event.nativeEvent.isComposing && event.keyCode !== 229) void submit();
    } else if (event.key === "Escape") {
      if (state.confirmingSubmit) dispatch({ type: "submit/dismiss" });
      else if (detailsOpen) setDetailsOpen(false);
    }
  };

  const issues = draft.issues;
  const hasPreview = Boolean(rawText.trim()) || detailsOpen;
  const mustConfirmDates = needsDateConfirmation(draft) && !isDateConfirmed(draft);
  const hint = members ? "+tên  ! quan trọng  @mai  @t6  @15/10" : "#danh_mục  ! quan trọng  @mai  @t6  @15/10";
  const courseLabel = getCourseOptionLabel(courses, values.courseId);

  if (variant === "card") {
    const hasDeadline = Boolean(values.deadline);
    return (
      <div className="rounded-xl border border-neutral-200 bg-white shadow-lg focus-within:border-violet-300">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-2 px-3.5 pt-3"
        >
          {attachedPreviewBlock}
          <input
            ref={inputRef}
            autoFocus
            value={rawText}
            onChange={(event) => onTextChange(event.target.value)}
            onPaste={onPaste}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancel?.();
              else onKeyDown(event);
            }}
            placeholder={inputPlaceholder}
            disabled={disabled}
            maxLength={4_000}
            aria-label="Tên việc"
            className="w-full bg-transparent text-base font-medium text-neutral-900 outline-none placeholder:font-normal placeholder:text-neutral-400"
          />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancel?.();
            }}
            placeholder="Mô tả"
            rows={2}
            maxLength={2_500}
            disabled={disabled}
            aria-label="Mô tả"
            className="block w-full resize-none bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
          />
          <p className="min-h-4 text-[11px] text-neutral-400">
            {readingImage ? <span className="inline-flex items-center gap-1 text-violet-500"><Sparkles className="h-3 w-3 animate-pulse" aria-hidden="true" />AI đang đọc ảnh…</span> : analyzing ? <span className="inline-flex items-center gap-1 text-violet-500"><Sparkles className="h-3 w-3 animate-pulse" aria-hidden="true" />AI đang đọc…</span> : hint}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pb-3">
            <PickerChip icon={CalendarDays} label={values.deadline ? formatDeadlinePreview(values.deadline) : "Hạn nộp"} active={hasDeadline} onClear={() => setField("deadline", null)}>
              <DeadlineEditor key={`deadline:${JSON.stringify(values.deadline)}`} value={values.deadline} onChange={(value) => setField("deadline", value)} />
            </PickerChip>
            <PickerChip icon={Repeat} label={values.repeat ? formatRepeat(values.repeat) : "Lặp lại"} active={Boolean(values.repeat)} onClear={() => setField("repeat", null)}>
              <TaskRepeatEditor
                value={values.repeat}
                onChange={(value) => {
                  // Kỳ lặp tính từ hạn nộp: chưa có hạn thì lấy hôm nay
                  if (!values.deadline) setField("deadline", { dueDate: null, deadlineOn: dayKeyFromToday(0) });
                  setField("repeat", value);
                }}
              />
            </PickerChip>
            <button
              type="button"
              aria-pressed={values.isImportant}
              onClick={() => setField("isImportant", !values.isImportant)}
              className={cn(chipClass, values.isImportant && chipActiveClass)}
            >
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              Ưu tiên
            </button>
            {hasDeadline && (
              <PickerChip icon={Bell} label={values.reminder && values.reminder !== "none" ? reminderLabel(values.reminder) : "Nhắc"} active={Boolean(values.reminder && values.reminder !== "none")} onClear={() => setField("reminder", null)}>
                <select value={values.reminder ?? "none"} onChange={(event) => setField("reminder", event.target.value === "none" ? null : event.target.value)} className={inputClass} aria-label="Nhắc hạn">
                  {REMINDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </PickerChip>
            )}
            {courses && courses.length > 0 && (
              <PickerChip icon={BookOpen} label={courseLabel ?? "Danh mục"} active={Boolean(courseLabel)} onClear={() => setField("courseId", null)}>
                <CoursePicker courses={courses} value={values.courseId} onChange={(value) => setField("courseId", value)} />
              </PickerChip>
            )}
            {values.checklistItems.length > 0 && (
              <Chip icon={ListChecks} label={`${values.checklistItems.length} việc con`} onClear={() => setField("checklistItems", [])} />
            )}
            {imageControls}
            {trailing}
          </div>
        </form>
      {state.confirmingSubmit && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-violet-50 px-3 py-1.5 text-xs text-violet-800" role="alert">
          <span>AI đang phân tích câu này.</span>
          <button type="button" onClick={() => dispatch({ type: "submit/dismiss" })} className="rounded-md px-2 py-0.5 font-medium ring-1 ring-violet-300 hover:bg-white">
            Chờ AI
          </button>
          <button type="button" onClick={() => void submit(true)} className="rounded-md bg-violet-600 px-2 py-0.5 font-medium text-white hover:bg-violet-700">
            Thêm với thông tin hiện có
          </button>
        </div>
      )}

        {(issues.length > 0 || mustConfirmDates || notice || submission?.status === "uncertain") && (
          <div className="space-y-1 px-3.5 pb-2 text-[11px]">
            {issues.map((issue: CaptureIssue, index) => (
              <p key={`${issue.field}-${index}`} className="flex items-start gap-1 text-amber-700">
                <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                <span><strong className="font-medium">{FIELD_LABELS[issue.field]}:</strong> {issue.reason}</span>
              </p>
            ))}
            {mustConfirmDates && (
              <p className="flex flex-wrap items-center gap-1.5 text-amber-700">
                Đoạn chọn không rõ gửi lúc nào, ngày trên được tính từ hôm nay.
                <button type="button" onClick={() => dispatch({ type: "confirm-dates" })} className="rounded-md px-1.5 py-0.5 font-medium ring-1 ring-amber-300 hover:bg-amber-50">Xác nhận ngày</button>
              </p>
            )}
            {submission?.status === "uncertain" && <p className="text-rose-600" role="alert">Chưa rõ lần gửi trước đã lưu chưa. Bấm “Thử lại” để gửi lại đúng nội dung đó.</p>}
            {notice && <p className="text-rose-600" role="alert">{notice}</p>}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-3 py-2.5">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">Hủy</button>
          <button
            type="button"
            disabled={busy || disabled || !canSubmit}
            onClick={() => void submit()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {submission?.status === "uncertain" && !attachedImage ? "Thử lại" : "Thêm việc"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {attachedPreviewBlock}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100",
          compact ? "py-1.5" : "py-2.5",
          disabled && "opacity-60",
        )}
      >
        {busy
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" aria-hidden="true" />
          : <Plus className="h-4 w-4 shrink-0 text-violet-500" aria-hidden="true" />}
        <input
          ref={inputRef}
          value={rawText}
          onChange={(event) => onTextChange(event.target.value)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          placeholder={inputPlaceholder}
          disabled={disabled}
          maxLength={4_000}
          aria-label="Thêm việc nhanh"
          aria-describedby={notice ? `${detailsId}-notice` : undefined}
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
        {analyzing && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-violet-500" role="status">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">AI đang đọc…</span>
          </span>
        )}
        {imageControls}
        {trailing}
        {canSubmit && !disabled && (
          <>
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              title="Chi tiết"
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} aria-hidden="true" />
              <span className="sr-only">Chi tiết</span>
            </button>
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {submission?.status === "uncertain" && !attachedImage ? "Thử lại" : "Thêm"}
            </button>
          </>
        )}
      </form>

      {state.confirmingSubmit && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-violet-50 px-3 py-1.5 text-xs text-violet-800" role="alert">
          <span>AI đang phân tích câu này.</span>
          <button type="button" onClick={() => dispatch({ type: "submit/dismiss" })} className="rounded-md px-2 py-0.5 font-medium ring-1 ring-violet-300 hover:bg-white">
            Chờ AI
          </button>
          <button type="button" onClick={() => void submit(true)} className="rounded-md bg-violet-600 px-2 py-0.5 font-medium text-white hover:bg-violet-700">
            Thêm với thông tin hiện có
          </button>
        </div>
      )}

      <div className="flex min-h-5 flex-wrap items-center gap-1.5 px-1 text-[11px] text-neutral-400">
        {disabled && disabledHint ? (
          disabledHint
        ) : hasPreview ? (
          <>
            {values.title && values.title !== rawText.trim() && <span className="text-neutral-500">“{values.title}”</span>}
            {values.deadline && (
              <Chip icon={CalendarDays} label={`Hạn ${formatDeadlinePreview(values.deadline)}`} onClear={() => setField("deadline", null)} />
            )}
            {values.deadline && values.reminder && values.reminder !== "none" && (
              <Chip icon={Bell} label={reminderLabel(values.reminder)} onClear={() => setField("reminder", null)} />
            )}
            {values.isImportant && <Chip icon={Star} label="Quan trọng" onClear={() => setField("isImportant", false)} />}
            {courseLabel && <Chip icon={BookOpen} label={courseLabel} onClear={() => setField("courseId", null)} />}
            {values.checklistItems.length > 0 && (
              <Chip icon={ListChecks} label={`${values.checklistItems.length} việc con`} onClear={() => setField("checklistItems", [])} />
            )}
            {state.analysisError && !analyzing && (
              <span className="text-neutral-400">AI chưa dùng được — vẫn thêm thủ công được.</span>
            )}
          </>
        ) : (
          !compact && <span>{hint}</span>
        )}
      </div>

      {(issues.length > 0 || mustConfirmDates || notice || submission?.status === "uncertain") && (
        <div className="space-y-1 px-1 text-[11px]">
          {issues.map((issue: CaptureIssue, index) => (
            <p key={`${issue.field}-${index}`} className="flex items-start gap-1 text-amber-700">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
              <span><strong className="font-medium">{FIELD_LABELS[issue.field]}:</strong> {issue.reason}</span>
            </p>
          ))}
          {mustConfirmDates && (
            <p className="flex flex-wrap items-center gap-1.5 text-amber-700">
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
              Đoạn chọn không rõ gửi lúc nào, ngày trên được tính từ hôm nay.
              <button type="button" onClick={() => dispatch({ type: "confirm-dates" })} className="rounded-md px-1.5 py-0.5 font-medium ring-1 ring-amber-300 hover:bg-amber-50">
                Xác nhận ngày
              </button>
            </p>
          )}
          {submission?.status === "uncertain" && (
            <p className="text-rose-600" role="alert">Chưa rõ lần gửi trước đã lưu chưa. Bấm “Thử lại” để gửi lại đúng nội dung đó.</p>
          )}
          {notice && <p id={`${detailsId}-notice`} className="text-rose-600" role="alert">{notice}</p>}
        </div>
      )}

      {detailsOpen && !disabled && (
        <CaptureDetails
          id={detailsId}
          values={values}
          courses={courses}
          description={getCaptureDescription(draft)}
          setField={setField}
        />
      )}
    </div>
  );
};

const Chip = ({
  icon: Icon,
  label,
  onClear,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClear: () => void;
}) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 py-0.5 pl-2 pr-1 font-medium text-violet-700 ring-1 ring-violet-200">
    <Icon className="h-3 w-3" />
    {label}
    <button type="button" onClick={onClear} className="rounded-full p-0.5 hover:bg-violet-100" aria-label={`Bỏ ${label}`}>
      <X className="h-2.5 w-2.5" aria-hidden="true" />
    </button>
  </span>
);

const inputClass = "rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800 outline-none focus:border-violet-300";

const deadlineToForm = (deadline: TaskDeadline | null) => ({
  date: deadline?.dueDate ? getZonedDayKey(deadline.dueDate, CAPTURE_TIME_ZONE) : deadline?.deadlineOn ?? "",
  time: deadline?.dueDate ? timeOf(deadline.dueDate) : "",
});

const CaptureDetails = ({
  id,
  values,
  courses,
  description,
  setField,
}: {
  id: string;
  values: CaptureFields;
  courses?: QuickAddCourse[];
  description: string;
  setField: <K extends keyof CaptureFields>(key: K, value: CaptureFields[K]) => void;
}) => {
  const [newItem, setNewItem] = useState("");

  return (
    <div id={id} className="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 text-xs text-neutral-600 sm:grid-cols-2">
      <label className="grid gap-1 sm:col-span-2">
        <span className="font-medium">Tiêu đề</span>
        <input value={values.title} maxLength={200} onChange={(event) => setField("title", event.target.value)} className={inputClass} />
      </label>

      <DeadlineEditor key={`deadline:${JSON.stringify(values.deadline)}`} value={values.deadline} onChange={(value) => setField("deadline", value)} />

      <label className="grid gap-1">
        <span className="font-medium">Nhắc hạn</span>
        <select
          value={values.reminder ?? "none"}
          disabled={!values.deadline}
          onChange={(event) => setField("reminder", event.target.value === "none" ? null : event.target.value)}
          className={inputClass}
        >
          {REMINDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {!values.deadline && <span className="text-neutral-400">Chọn hạn nộp để bật nhắc.</span>}
        {values.deadline?.deadlineOn && <span className="text-neutral-400">Hạn cả ngày nhắc theo 9:00 sáng ngày hạn.</span>}
      </label>

      <div className="grid content-start gap-1">
        <span className="font-medium">Ưu tiên</span>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={values.isImportant} onChange={(event) => setField("isImportant", event.target.checked)} />
          Quan trọng
        </label>
      </div>

      {courses && courses.length > 0 && (
        <div className="grid content-start gap-1">
          <span className="font-medium">Danh mục</span>
          <div>
            <PickerChip icon={BookOpen} label={getCourseOptionLabel(courses, values.courseId) ?? "Chọn danh mục"} active={Boolean(values.courseId)} onClear={() => setField("courseId", null)}>
              <CoursePicker courses={courses} value={values.courseId} onChange={(value) => setField("courseId", value)} />
            </PickerChip>
          </div>
        </div>
      )}

      <div className="grid gap-1 sm:col-span-2">
        <span className="font-medium">Việc cần làm</span>
        {values.checklistItems.length > 0 && (
          <ul className="grid gap-1">
            {values.checklistItems.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-center gap-1.5">
                <input
                  value={item}
                  maxLength={120}
                  aria-label={`Việc con ${index + 1}`}
                  onChange={(event) => setField("checklistItems", values.checklistItems.map((current, i) => i === index ? event.target.value : current))}
                  className={cn(inputClass, "flex-1")}
                />
                <button
                  type="button"
                  onClick={() => setField("checklistItems", values.checklistItems.filter((_, i) => i !== index))}
                  className="rounded-md p-1 hover:bg-neutral-200"
                  aria-label={`Xóa việc con ${index + 1}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {values.checklistItems.length < 20 && (
          <input
            value={newItem}
            maxLength={120}
            placeholder="Thêm việc con, Enter để thêm"
            aria-label="Thêm việc con"
            onChange={(event) => setNewItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              const title = newItem.replace(/\s+/g, " ").trim();
              if (!title) return;
              setField("checklistItems", [...values.checklistItems, title]);
              setNewItem("");
            }}
            className={inputClass}
          />
        )}
      </div>

      {description && (
        <div className="grid gap-1 sm:col-span-2">
          <span className="font-medium">Mô tả kèm nguồn (sẽ lưu)</span>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 font-sans text-[11px] text-neutral-500 ring-1 ring-neutral-200">{description}</pre>
        </div>
      )}
    </div>
  );
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKeyFromToday = (days: number) =>
  new Date(Date.parse(`${getZonedDayKey(new Date().toISOString(), CAPTURE_TIME_ZONE)}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const weekdayOf = (key: string) =>
  new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));

/** Hôm nay / Ngày mai / Thứ hai tuần tới. */
const quickDeadlines = () => {
  const todayDow = new Date(`${dayKeyFromToday(0)}T00:00:00Z`).getUTCDay();
  return [
    { label: "Hôm nay", icon: CalendarCheck, key: dayKeyFromToday(0) },
    { label: "Ngày mai", icon: CalendarPlus, key: dayKeyFromToday(1) },
    { label: "Tuần tới", icon: CalendarRange, key: dayKeyFromToday(((8 - todayDow) % 7) || 7) },
  ];
};

const menuItemClass = "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none";

const DeadlineEditor = ({ value, onChange }: { value: TaskDeadline | null; onChange: (value: TaskDeadline | null) => void }) => {
  const [form, setForm] = useState(() => deadlineToForm(value));
  const update = (next: typeof form) => {
    setForm(next);
    if (!next.date) onChange(null);
    else if (!next.time) onChange({ dueDate: null, deadlineOn: next.date });
    else {
      const dueDate = zonedTimeToIso(next.date, next.time, CAPTURE_TIME_ZONE);
      if (dueDate) onChange({ dueDate, deadlineOn: null });
    }
  };

  return (
    <fieldset className="grid gap-1">
      <div className="-mx-1 mb-1 grid gap-0.5 border-b border-neutral-100 pb-1.5">
        {quickDeadlines().map(({ label, icon: Icon, key }) => (
          <PopoverClose asChild key={label}>
            <button type="button" onClick={() => update({ ...form, date: key })} className={cn(menuItemClass, form.date === key && "bg-violet-50 text-violet-700")}>
              <Icon className="h-4 w-4 text-neutral-500" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              <span className="text-[11px] text-neutral-400">{weekdayOf(key)}, {formatDay(key)}</span>
            </button>
          </PopoverClose>
        ))}
      </div>
      <span className="mb-1 font-medium">Chọn ngày (giờ VN)</span>
      <div className="flex flex-wrap gap-1.5">
        <input type="date" aria-label="Ngày hạn" value={form.date} onChange={(event) => update({ ...form, date: event.target.value })} className={inputClass} />
        <input type="time" aria-label="Giờ hạn" value={form.time} disabled={!form.date} onChange={(event) => update({ ...form, time: event.target.value })} className={inputClass} />
      </div>
      {form.date && !form.time && <span className="text-neutral-400">Không chọn giờ = hạn cả ngày.</span>}
    </fieldset>
  );
};

const chipClass = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50";
const chipActiveClass = "border-violet-300 bg-violet-50 text-violet-700";

const PickerChip = ({
  icon: Icon,
  label,
  active,
  onClear,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) => (
  <Popover>
    <span className={cn(chipClass, "gap-1 pr-1.5", active && chipActiveClass)}>
      <PopoverTrigger className="inline-flex items-center gap-1.5 outline-none">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </PopoverTrigger>
      {active && (
        <button type="button" onClick={onClear} className="rounded-full p-0.5 hover:bg-violet-100" aria-label={`Bỏ ${label}`}>
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
    <PopoverContent align="start" className="w-auto min-w-56 text-xs">{children}</PopoverContent>
  </Popover>
);
