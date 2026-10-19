import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Sparkles, Star, X } from "lucide-react";

import { analyzeSmartCapture } from "@/actions/ai/analyze-smart-capture";
import { quickAddCard } from "@/actions/cards/quick-add-card";
import { getZonedDayKey, zonedTimeToIso } from "@/lib/capture/analysis";
import { CAPTURE_TIME_ZONE, normalizeCaptureSource, type CaptureSource } from "@/lib/capture/source";
import { CAPTURE_ALREADY_PROCESSED } from "@/lib/cards/capture-error-codes";
import { fetcher } from "@/lib/fetcher";
import type { MyTasksContext } from "@/lib/my-tasks/types";
import { cn } from "@/lib/utils";

import { useAuth, useUser } from "../lib/auth";
import { notifyCapture, readCaptureRequestId, requestCaptureSource } from "../lib/capture-bridge";
import { useTitle } from "../lib/use-title";
import { AuthForm } from "./auth-pages";

type Load =
  | { status: "loading" }
  | { status: "ready"; source: CaptureSource }
  | { status: "error"; message: string };

type Fields = {
  title: string;
  date: string;
  time: string;
  reminder: string;
  courseId: string;
  listId: string;
  isImportant: boolean;
};

/** Field values plus the fields the user changed; AI never overwrites those. */
type Form = Fields & { touched: Array<keyof Fields> };

const UNAVAILABLE: Record<string, string> = {
  missing: "Đoạn đã chọn đã hết hạn (15 phút) hoặc đã được thêm. Hãy bôi đen lại tin nhắn.",
  "no-extension": "Không kết nối được extension UniFlow Capture. Kiểm tra extension đang bật rồi bôi đen lại.",
};
const UNAVAILABLE_DEFAULT = "Không lấy được đoạn đã chọn. Hãy bôi đen lại tin nhắn.";
const REMINDERS = [["none", "Không nhắc"], ["0", "Đúng hạn"], ["60", "Trước 1 giờ"], ["1440", "Trước 1 ngày"], ["2880", "Trước 2 ngày"]] as const;

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: CAPTURE_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const formatSent = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: CAPTURE_TIME_ZONE, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const fieldClass =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-neutral-50 disabled:text-neutral-400";

/** Small window opened by the extension: the selected message becomes one task; AI fills the fields. */
export default function CaptureRoute() {
  useTitle("Thêm vào UniFlow");
  const [requestId] = useState(() => readCaptureRequestId(window.location.hash));
  const { isLoaded, userId } = useAuth();
  const [load, setLoad] = useState<Load>(() =>
    requestId ? { status: "loading" } : { status: "error", message: "Hãy bôi đen một tin nhắn rồi bấm “Thêm vào UniFlow”." },
  );

  useEffect(() => {
    if (!requestId) return;
    let alive = true;
    void requestCaptureSource(requestId).then((result) => {
      if (!alive) return;
      if (!result.ok) return setLoad({ status: "error", message: UNAVAILABLE[result.reason] ?? UNAVAILABLE_DEFAULT });
      try {
        // Data from another context: validate before use.
        setLoad({ status: "ready", source: normalizeCaptureSource(result.source) });
      } catch {
        setLoad({ status: "error", message: UNAVAILABLE_DEFAULT });
      }
    });
    return () => {
      alive = false;
    };
  }, [requestId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === "Escape" && !event.defaultPrevented && !target?.closest("input, textarea, select")) window.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cancel = () => {
    if (requestId) notifyCapture(requestId, "CAPTURE_CANCEL");
    window.close();
  };

  let body: React.ReactNode;
  if (!isLoaded || load.status === "loading") body = <Centered><Loader2 className="h-5 w-5 animate-spin text-violet-500" /></Centered>;
  else if (load.status === "error") body = <Centered><p className="text-sm text-neutral-600">{load.message}</p></Centered>;
  else if (!userId) {
    body = (
      <div className="space-y-3 p-4">
        <p className="text-sm text-neutral-500">Đăng nhập để thêm task. Đoạn đã chọn được giữ trong 15 phút.</p>
        <AuthForm mode="sign-in" next={`${window.location.pathname}${window.location.hash}`} />
      </div>
    );
  } else body = <CaptureForm key={userId} requestId={requestId!} source={load.source} />;

  return (
    <main className="flex h-dvh flex-col bg-neutral-50 text-neutral-800">
      <header className="flex items-center gap-2 border-b border-neutral-200 bg-white px-4 py-3">
        <img src="/logo.svg" alt="" className="h-6 w-6" />
        <h1 className="flex-1 text-sm font-semibold">Thêm vào UniFlow</h1>
        <button type="button" onClick={cancel} aria-label="Đóng" className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
          <X className="h-4 w-4" />
        </button>
      </header>
      {body}
    </main>
  );
}

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-1 items-center justify-center p-6 text-center">{children}</div>
);

const CaptureForm = ({ requestId, source }: { requestId: string; source: CaptureSource }) => {
  const { user } = useUser();
  // One id for this popup: a retry after an unclear failure can never create a second task.
  const [creationId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState<Form>(() => ({
    title: source.selectedText.replace(/\s+/g, " ").trim().slice(0, 200),
    date: "",
    time: "",
    reminder: "none",
    courseId: "",
    listId: "",
    isImportant: false,
    touched: [],
  }));
  const [aiState, setAiState] = useState<"running" | "done" | "failed">("running");
  const [hint, setHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: context, isLoading } = useQuery<MyTasksContext>({
    queryKey: ["capture-context", user?.id],
    queryFn: () => fetcher("/api/my-tasks/context"),
  });
  const boardId = context?.board?.id;

  const edit = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setForm((current) => ({ ...current, [key]: value, touched: [...current.touched, key] }));

  useEffect(() => {
    if (!boardId) return;
    let alive = true;
    void analyzeSmartCapture({
      mode: "quick",
      boardId,
      rawText: source.selectedText,
      draftId: creationId,
      textRevision: 0,
      timeZone: CAPTURE_TIME_ZONE,
      source,
    }).then((result) => {
      if (!alive) return;
      if (!result.data) return setAiState("failed");
      const { fields, issues } = result.data;
      const deadline = fields.deadline;
      const ai: Partial<Fields> = {
        ...(fields.title ? { title: fields.title } : {}),
        ...(deadline?.dueDate ? { date: getZonedDayKey(deadline.dueDate, CAPTURE_TIME_ZONE), time: timeOf(deadline.dueDate) } : {}),
        ...(deadline?.deadlineOn ? { date: deadline.deadlineOn, time: "" } : {}),
        ...(fields.reminder ? { reminder: fields.reminder } : {}),
        ...(fields.courseId ? { courseId: fields.courseId } : {}),
        ...(fields.isImportant !== undefined ? { isImportant: fields.isImportant } : {}),
      };
      setForm((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(ai) as Array<[keyof Fields, never]>) {
          if (!current.touched.includes(key)) next[key] = value;
        }
        return next;
      });
      setHint(issues.find((issue) => issue.field === "deadline" || issue.field === "title")?.reason ?? null);
      setAiState("done");
    }, () => alive && setAiState("failed"));
    return () => {
      alive = false;
    };
  }, [boardId, creationId, source]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !boardId) return;
    if (!form.title.trim()) return setError("Nhập tiêu đề task.");
    const dueDate = form.date && form.time ? zonedTimeToIso(form.date, form.time, CAPTURE_TIME_ZONE) : null;
    if (form.date && form.time && !dueDate) return setError("Giờ hạn không hợp lệ.");

    setSaving(true);
    setError(null);
    try {
      const result = await quickAddCard({
        creationId,
        boardId,
        listId: form.listId || undefined,
        title: form.title,
        dueDate,
        deadlineOn: form.date && !form.time ? form.date : null,
        reminder: form.date ? form.reminder : "none",
        courseId: form.courseId || null,
        isImportant: form.isImportant,
      });
      if (result.data) {
        notifyCapture(requestId, "CAPTURE_SAVED");
        setSaved(true);
        setTimeout(() => window.close(), 1_400);
        return;
      }
      const fieldError = result.fieldErrors ? Object.values(result.fieldErrors).flat().find(Boolean) : undefined;
      setError(result.errorCode === CAPTURE_ALREADY_PROCESSED
        ? "Task này đã được lưu ở lần bấm trước. Mở UniFlow để kiểm tra."
        : (result.error ?? (fieldError as string | undefined) ?? "Chưa thêm được. Bấm Thêm để thử lại."));
    } catch {
      setError("Mất kết nối. Bấm Thêm để thử lại (không tạo trùng).");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Centered>
        <div className="space-y-2">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="text-sm font-medium">Đã thêm task</p>
        </div>
      </Centered>
    );
  }
  if (isLoading) return <Centered><Loader2 className="h-5 w-5 animate-spin text-violet-500" /></Centered>;
  if (!context?.board) {
    return (
      <Centered>
        <p className="text-sm text-neutral-600">
          Chưa có học kỳ hiện tại. <a className="font-medium text-violet-600 underline" href="/my/today" target="_blank" rel="noreferrer">Mở UniFlow</a> để tạo học kỳ.
        </p>
      </Centered>
    );
  }

  const { board, courses } = context;
  const aiRunning = aiState === "running";
  const aiMark = (key: keyof Fields) =>
    aiRunning && !form.touched.includes(key) ? <Sparkles className="h-3 w-3 animate-pulse text-violet-400" aria-label="AI đang điền" /> : null;

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <blockquote className="rounded-lg border-l-2 border-violet-300 bg-white px-3 py-2 text-xs text-neutral-500 shadow-sm">
          <p className="line-clamp-3 whitespace-pre-line">{source.selectedText}</p>
          {source.messageSentAt && <p className="mt-1 text-[11px] text-neutral-400">Gửi lúc {formatSent(source.messageSentAt)}</p>}
        </blockquote>

        <p className="flex items-center gap-1.5 text-xs text-neutral-500" aria-live="polite">
          <Sparkles className={cn("h-3.5 w-3.5", aiRunning ? "animate-pulse text-violet-500" : "text-violet-400")} />
          {aiRunning ? "AI đang đọc tin nhắn…" : aiState === "done" ? "AI đã điền sẵn, kiểm tra rồi bấm Thêm." : "AI chưa đọc được, bạn điền tay nhé."}
        </p>

        <Field label="Tiêu đề" adornment={aiMark("title")}>
          <input autoFocus aria-label="Tiêu đề" value={form.title} maxLength={200} onChange={(event) => edit("title", event.target.value)} className={fieldClass} />
        </Field>

        <Field label="Hạn nộp" adornment={aiMark("date")} hint={hint}>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <input type="date" aria-label="Ngày hạn" value={form.date} onChange={(event) => edit("date", event.target.value)} className={fieldClass} />
            <input type="time" aria-label="Giờ hạn" value={form.time} disabled={!form.date} onChange={(event) => edit("time", event.target.value)} className={fieldClass} />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nhắc">
            <select aria-label="Nhắc" value={form.reminder} disabled={!form.date} onChange={(event) => edit("reminder", event.target.value)} className={fieldClass}>
              {REMINDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Môn" adornment={aiMark("courseId")}>
            <select aria-label="Môn" value={form.courseId} onChange={(event) => edit("courseId", event.target.value)} className={fieldClass}>
              <option value="">Không môn</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.code ?? course.name}</option>)}
            </select>
          </Field>
          <Field label="Cột">
            <select aria-label="Cột" value={form.listId} onChange={(event) => edit("listId", event.target.value)} className={fieldClass}>
              <option value="">{board.lists[0]?.title ?? "Cột đầu tiên"}</option>
              {board.lists.slice(1).map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}
            </select>
          </Field>
          <Field label="Ưu tiên">
            <button
              type="button"
              aria-pressed={form.isImportant}
              onClick={() => edit("isImportant", !form.isImportant)}
              className={cn(fieldClass, "flex items-center gap-1.5", form.isImportant && "border-amber-300 bg-amber-50 text-amber-700")}
            >
              <Star className={cn("h-4 w-4", form.isImportant && "fill-amber-400 text-amber-400")} />
              {form.isImportant ? "Quan trọng" : "Bình thường"}
            </button>
          </Field>
        </div>
      </div>

      <footer className="space-y-2 border-t border-neutral-200 bg-white p-4">
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Thêm task
        </button>
        {user?.primaryEmailAddress?.emailAddress && (
          <p className="text-center text-[11px] text-neutral-400">{user.primaryEmailAddress.emailAddress}</p>
        )}
      </footer>
    </form>
  );
};

const Field = ({ label, adornment, hint, children }: { label: string; adornment?: React.ReactNode; hint?: string | null; children: React.ReactNode }) => (
  <div className="space-y-1">
    <span className="flex items-center gap-1 text-xs font-medium text-neutral-600">{label}{adornment}</span>
    {children}
    {hint && <span className="block text-[11px] text-amber-700">{hint}</span>}
  </div>
);
