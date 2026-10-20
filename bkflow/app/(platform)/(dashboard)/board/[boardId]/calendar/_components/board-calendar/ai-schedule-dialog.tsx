"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@animate-ui/react/primitives/radix-ui/dialog";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import { Collapsible } from "@animate-ui/react/primitives/radix-ui/collapsible";
import { toCssTiming, transition, useShouldReduceMotion, useTempoTransition } from "@animate-ui/react/utils/motion";
import { AlertCircle, ArrowLeft, ArrowRight, CalendarCheck2, CalendarDays, Check, ChevronDown, Clock3, ListTodo, Loader2, ShieldCheck, Sparkles, WandSparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateAiSchedule } from "@/actions/ai/generate-ai-schedule";
import { applyAiSchedule } from "@/actions/cards/apply-ai-schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AI_SCHEDULE_TASK_LIMIT, GenerateAiSchedule, type AiSchedulePreview, type SchedulePreferencesInput } from "@/lib/calendar/ai-schedule";
import { invalidateAfterWrite } from "@/lib/invalidate-after-write";
import { addVNDays, getVNDay, getVNDayKey } from "@/lib/my-tasks/vn-day";
import { cn } from "@/lib/utils";
import type { BoardCalendarUnscheduledCard } from "@/types";

type Props = { boardId: string; cards: BoardCalendarUnscheduledCard[]; disabled: boolean };
const dateLabel = (value: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
const checkboxClass = "size-4 shrink-0 accent-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-not-allowed";
const dayLabel = (value: string) => value ? value.split("-").reverse().join("/") : "Chọn ngày";

export const AiScheduleDialog = ({ boardId, cards, disabled }: Props) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const eligibleCards = cards.filter(card => !card.isCompleted);
  return (
    <Dialog.Root open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <Dialog.Trigger asChild>
        <Button type="button" disabled={disabled || eligibleCards.length === 0} className="h-10 w-full justify-between gap-2 px-3 shadow-sm">
          <span className="inline-flex items-center gap-2"><WandSparkles aria-hidden="true" /> AI xếp lịch</span>
          <ArrowRight aria-hidden="true" className="size-3.5 opacity-70" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-50 m-auto flex h-fit max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-[980px] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><WandSparkles aria-hidden="true" className="size-4" /></span>
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold tracking-tight">AI xếp lịch</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">Từ việc đang chờ đến kế hoạch sẵn sàng.</Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" disabled={busy} aria-label="Đóng AI xếp lịch" className="shrink-0 text-muted-foreground"><X aria-hidden="true" /></Button>
            </Dialog.Close>
          </header>
          {open && <SchedulePlanner boardId={boardId} cards={eligibleCards} onBusyChange={setBusy} onClose={() => setOpen(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const SchedulePlanner = ({ boardId, cards: initialCards, onBusyChange, onClose }: Omit<Props, "disabled"> & { onBusyChange: (busy: boolean) => void; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const disclosureTiming = toCssTiming(useTempoTransition(transition.disclosure));
  const reduceMotion = useShouldReduceMotion();
  const [cards] = useState(initialCards);
  const [selected, setSelected] = useState(() => cards.slice(0, AI_SCHEDULE_TASK_LIMIT).map(card => card.cardId));
  const [preferences, setPreferences] = useState<SchedulePreferencesInput>(() => {
    const today = getVNDay(new Date());
    return { fromDay: getVNDayKey(today), toDay: getVNDayKey(addVNDays(today, 6)), dayStart: "08:00", dayEnd: "18:00" };
  });
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<AiSchedulePreview | null>(null);
  const [included, setIncluded] = useState<string[]>([]);
  const [status, setStatus] = useState<"generating" | "applying" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (preview) previewHeadingRef.current?.focus(); }, [preview]);
  const inFlight = useRef(false);
  const busy = status !== null;
  const changePreference = (key: keyof SchedulePreferencesInput, value: string) => setPreferences(current => ({ ...current, [key]: value }));
  const reportError = (message: string) => {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  };
  const generate = async () => {
    if (inFlight.current) return;
    const parsed = GenerateAiSchedule.safeParse({ boardId, cardIds: selected, prompt, ...preferences });
    if (!parsed.success) { reportError(parsed.error.issues[0]?.message ?? "Kiểm tra lại yêu cầu xếp lịch."); return; }
    inFlight.current = true;
    setStatus("generating"); onBusyChange(true); setError(null);
    try {
      const result = await generateAiSchedule(parsed.data);
      if (!result.data) { reportError(result.error || "Không tạo được đề xuất. Hãy thử lại."); return; }
      setPreview(result.data);
      setIncluded(result.data.slots.map(slot => slot.cardId));
    } catch { reportError("Không kết nối được AI. Yêu cầu của bạn vẫn được giữ lại; hãy thử lại."); }
    finally { inFlight.current = false; setStatus(null); onBusyChange(false); }
  };
  const apply = async () => {
    if (!preview || inFlight.current || included.length === 0) return;
    inFlight.current = true;
    setStatus("applying"); onBusyChange(true); setError(null);
    try {
      const result = await applyAiSchedule({ boardId, ...preferences, slots: preview.slots.filter(slot => included.includes(slot.cardId)).map(({ cardId, startsAt, endsAt, expectedUpdatedAt }) => ({ cardId, startsAt, endsAt, expectedUpdatedAt })) });
      if (!result.data) {
        if (result.errorCode === "TRANSPORT") {
          invalidateAfterWrite(queryClient);
          reportError("Chưa xác nhận được kết quả lưu. Hãy tải lại Lịch trước khi thử lại.");
        } else reportError(result.error || "Không lưu được lịch. Hãy thử lại.");
        return;
      }
      invalidateAfterWrite(queryClient);
      toast.success(`Đã xếp lịch cho ${result.data.count} task`);
      onClose();
    } catch {
      invalidateAfterWrite(queryClient);
      reportError("Chưa xác nhận được kết quả lưu. Hãy tải lại Lịch trước khi thử lại.");
    }
    finally { inFlight.current = false; setStatus(null); onBusyChange(false); }
  };

  const previewDays = preview ? [...new Set(preview.slots.map(slot => getVNDayKey(getVNDay(new Date(slot.startsAt)))))] : [];
  const selectedMinutes = preview?.slots.filter(slot => included.includes(slot.cardId))
    .reduce((sum, slot) => sum + Math.round((Date.parse(slot.endsAt) - Date.parse(slot.startsAt)) / 60_000), 0) ?? 0;
  const phase = status === "generating" ? "loading" : preview ? "preview" : "setup";
  const today = getVNDay(new Date());

  return (
    <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={event => {
      event.preventDefault();
      void (preview ? apply() : generate());
    }}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:overflow-hidden">
        <Fade key={phase} className="grid md:h-[min(560px,calc(92dvh_-_150px))] md:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0 px-5 py-5 sm:px-7 md:min-h-0 md:overflow-y-auto">
            {phase === "loading" ? (
              <div role="status" className="flex min-h-80 flex-col items-center justify-center px-4 py-10 text-center md:h-full md:min-h-0">
                <div className="relative mb-6 flex size-20 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5 text-primary">
                  <CalendarDays aria-hidden="true" className="size-8" strokeWidth={1.5} />
                  <span className="absolute -bottom-2 -right-2 flex size-8 items-center justify-center rounded-full border-4 border-popover bg-primary text-primary-foreground">
                    <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-pulse" />
                  </span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight">Đang sắp xếp một kế hoạch vừa sức</h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">Tìm khoảng trống, cân nhắc deadline và dành thời gian cho {selected.length} công việc của bạn.</p>
              </div>
            ) : preview ? (
              <>
                <div className="mb-7 flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Kế hoạch đề xuất</p>
                    <h3 ref={previewHeadingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
                      {preview.slots.length ? "Mỗi việc, một khoảng thời gian." : "Cần thêm một chút thời gian."}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">{preview.slots.length ? "Xem lại các buổi làm và chọn những việc bạn muốn đưa vào lịch." : "Thử mở rộng ngày hoặc giờ rảnh để AI tìm thêm khoảng trống."}</p>
                  </div>
                  <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary sm:flex"><CalendarCheck2 aria-hidden="true" className="size-5" /></span>
                </div>

                <div className="space-y-7">
                  {previewDays.map(day => {
                    const slots = preview.slots.filter(slot => getVNDayKey(getVNDay(new Date(slot.startsAt))) === day);
                    return (
                      <section key={day} aria-label={dateLabel(`${day}T00:00:00+07:00`)}>
                        <div className="mb-4 flex items-center gap-3">
                          <h4 className="text-sm font-semibold capitalize">{dateLabel(`${day}T00:00:00+07:00`)}</h4>
                          <span className="h-px flex-1 bg-border" aria-hidden="true" />
                          <span className="text-xs tabular-nums text-muted-foreground">{slots.length} việc</span>
                        </div>
                        <div>
                          {slots.map(slot => {
                            const chosen = included.includes(slot.cardId);
                            const minutes = Math.round((Date.parse(slot.endsAt) - Date.parse(slot.startsAt)) / 60_000);
                            return (
                              <label key={slot.cardId} className="group grid cursor-pointer grid-cols-[48px_minmax(0,1fr)_24px] items-start gap-3 py-2.5">
                                <span className="pt-0.5 text-right text-xs tabular-nums">
                                  <span className="block font-semibold">{timeLabel(slot.startsAt)}</span>
                                  <span className="mt-1 block text-muted-foreground">{timeLabel(slot.endsAt)}</span>
                                </span>
                                <span className={cn("min-w-0 rounded-r-lg border-l-2 py-0.5 pl-4 pr-2 transition-colors group-hover:bg-muted/40", chosen ? "border-primary" : "border-border")}>
                                  <span className="flex items-start justify-between gap-2">
                                    <span className="min-w-0 break-words text-sm font-medium leading-snug">{slot.title}</span>
                                    <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground">{minutes} phút</span>
                                  </span>
                                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{slot.reason}</span>
                                </span>
                                <input type="checkbox" className={cn(checkboxClass, "mt-1")}
                                  checked={chosen} disabled={busy}
                                  aria-label={`Áp dụng lịch cho ${slot.title}`}
                                  onChange={event => setIncluded(current => event.target.checked ? [...current, slot.cardId] : current.filter(id => id !== slot.cardId))} />
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>

                {selected.length > preview.slots.length && (
                  <div className="mt-6 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                    <p className="mb-1 font-medium text-foreground">{selected.length - preview.slots.length} việc cần sắp xếp sau</p>
                    {cards.filter(card => selected.includes(card.cardId) && !preview.slots.some(slot => slot.cardId === card.cardId)).map(card => card.title).join(" · ")}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Lên kế hoạch cùng AI</p>
                  <h3 className="max-w-md text-2xl font-semibold leading-tight tracking-tight">Bạn muốn làm việc theo nhịp nào?</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Chọn thời gian rảnh, thêm mong muốn. Phần sắp xếp để AI lo.</p>
                </div>

                <div>
                  <label htmlFor="ai-schedule-prompt" className="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
                    Mong muốn của bạn <span className="text-xs font-normal text-muted-foreground">Tùy chọn</span>
                  </label>
                  <div className="rounded-xl border border-input bg-background shadow-sm transition-shadow focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                    <textarea id="ai-schedule-prompt" rows={3} maxLength={1500}
                      value={prompt} onChange={event => setPrompt(event.target.value)}
                      placeholder="Tôi muốn tập trung việc khó vào buổi sáng, chừa 15 phút nghỉ giữa các việc…"
                      className="block w-full resize-none bg-transparent px-4 pb-2 pt-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground" />
                    <div className="flex items-center justify-between px-4 pb-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 text-[11px]"><Sparkles aria-hidden="true" className="size-3" /> Viết tự nhiên như bạn nghĩ</span>
                      <span className="text-[10px] tabular-nums">{prompt.length}/1500</span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["Ưu tiên buổi sáng", "Chừa 15 phút nghỉ", "Việc khó làm trước"].map(suggestion => (
                      <button key={suggestion} type="button"
                        onClick={() => setPrompt(current => `${current}${current ? ". " : ""}${suggestion}`.slice(0, 1500))}
                        className="rounded-md bg-muted/70 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring">
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                <fieldset className="space-y-3">
                  <legend className="mb-3 text-sm font-medium">Thời gian làm việc</legend>
                  <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
                    {[{ label: "Hôm nay", days: 0 }, { label: "7 ngày tới", days: 6 }].map(preset => {
                      const first = getVNDayKey(today);
                      const last = getVNDayKey(addVNDays(today, preset.days));
                      const active = preferences.fromDay === first && preferences.toDay === last;
                      return <button key={preset.label} type="button" aria-pressed={active}
                        onClick={() => setPreferences(current => ({ ...current, fromDay: first, toDay: last }))}
                        className={cn("flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring", active ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {preset.label}
                      </button>;
                    })}
                  </div>
                  <Collapsible.Root>
                    <Collapsible.Trigger asChild>
                      <button type="button" className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 text-xs">
                            <span className="block font-medium">{dayLabel(preferences.fromDay)} – {dayLabel(preferences.toDay)}</span>
                            <span className="mt-1 block text-muted-foreground">{preferences.dayStart} – {preferences.dayEnd} mỗi ngày · GMT+7</span>
                          </span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-primary">Chỉnh <ChevronDown aria-hidden="true" style={{ transitionDuration: reduceMotion ? "0ms" : `${disclosureTiming.duration}ms`, transitionTimingFunction: disclosureTiming.easing }} className="size-3 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" /></span>
                      </button>
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                  <div className="grid min-w-0 grid-cols-2 gap-3 pb-1 pt-4">
                    <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">Từ ngày
                      <Input aria-label="Từ ngày" type="date" required value={preferences.fromDay} onChange={event => changePreference("fromDay", event.target.value)} className="h-10 bg-background text-foreground" />
                    </label>
                    <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">Đến ngày
                      <Input aria-label="Đến ngày" type="date" required min={preferences.fromDay} value={preferences.toDay} onChange={event => changePreference("toDay", event.target.value)} className="h-10 bg-background text-foreground" />
                    </label>
                    <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">Bắt đầu
                      <Input type="time" required value={preferences.dayStart} onChange={event => changePreference("dayStart", event.target.value)} className="h-10 bg-background text-foreground" />
                    </label>
                    <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">Kết thúc
                      <Input type="time" required value={preferences.dayEnd} onChange={event => changePreference("dayEnd", event.target.value)} className="h-10 bg-background text-foreground" />
                    </label>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Chọn tối đa 31 ngày. Giờ Việt Nam (GMT+7).</p>
                    </Collapsible.Content>
                  </Collapsible.Root>
                </fieldset>
              </div>
            )}
          </main>

          <aside className="flex min-h-0 min-w-0 flex-col border-t border-border bg-muted/30 px-5 py-6 md:overflow-y-auto md:border-l md:border-t-0">
            {preview ? (
              <>
                <div className="mb-6">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Kế hoạch của bạn</p>
                  <p className="text-4xl font-semibold tabular-nums tracking-tight">{included.length}<span className="ml-2 text-sm font-normal tracking-normal text-muted-foreground">việc được chọn</span></p>
                </div>
                <dl className="space-y-3 border-y border-border py-4 text-xs">
                  <div className="flex items-center justify-between gap-3"><dt className="inline-flex items-center gap-2 text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" /> Thời gian tập trung</dt><dd className="font-medium tabular-nums">{selectedMinutes} phút</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="inline-flex items-center gap-2 text-muted-foreground"><CalendarDays aria-hidden="true" className="size-3.5" /> Ngày có lịch</dt><dd className="font-medium">{new Set(preview.slots.filter(slot => included.includes(slot.cardId)).map(slot => getVNDayKey(getVNDay(new Date(slot.startsAt))))).size} ngày</dd></div>
                </dl>
                <div className="mt-6">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold"><Sparkles aria-hidden="true" className="size-3.5 text-primary" /> Ghi chú từ AI</p>
                  <p className="text-xs leading-6 text-muted-foreground">{preview.summary}</p>
                </div>
                <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">Bỏ chọn những việc bạn muốn để sau. Lịch được kiểm tra lại khi áp dụng.</p>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><ListTodo aria-hidden="true" className="size-4 text-muted-foreground" /> Công việc</h3>
                  <span className="rounded-md bg-background px-2 py-1 text-xs font-medium tabular-nums ring-1 ring-border">{selected.length}/{cards.length}</span>
                </div>
                <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Theo bộ lọc hiện tại</span>
                  <button type="button" disabled={busy}
                    onClick={() => setSelected(selected.length ? [] : cards.slice(0, AI_SCHEDULE_TASK_LIMIT).map(card => card.cardId))}
                    className="rounded px-1 py-1 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
                    {selected.length ? "Bỏ chọn" : "Chọn tất cả"}
                  </button>
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto md:min-h-0 md:max-h-none md:flex-1">
                  {cards.map(card => (
                    <label key={card.cardId} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-background/80">
                      <input type="checkbox" checked={selected.includes(card.cardId)}
                        disabled={busy || (!selected.includes(card.cardId) && selected.length >= AI_SCHEDULE_TASK_LIMIT)}
                        onChange={event => setSelected(current => event.target.checked ? [...current, card.cardId] : current.filter(id => id !== card.cardId))}
                        className={cn(checkboxClass, "mt-0.5")} />
                      <span className="min-w-0">
                        <span className="block break-words text-xs font-medium leading-relaxed">{card.title}</span>
                        <span className="mt-1 block truncate text-[11px] text-muted-foreground">{card.listTitle}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">Tối đa {AI_SCHEDULE_TASK_LIMIT} việc mỗi lần xếp lịch.</p>
              </>
            )}

            <details className="mt-5 border-t border-border pt-4 text-[11px] text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded py-1 font-medium focus-visible:outline-2 focus-visible:outline-ring"><span className="inline-flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="size-3.5" /> Cách AI xếp lịch</span><ChevronDown aria-hidden="true" className="size-3" /></summary>
              <p className="mt-2 leading-relaxed">Ưu tiên deadline, tránh lịch làm đã có. Lịch chỉ có ngày giữ trọn ngày. AI ước lượng thời lượng, mặc định 60 phút khi chưa rõ. Hạn nộp được giữ nguyên.</p>
            </details>
          </aside>
        </Fade>
      </div>

      {error && <p ref={errorRef} role="alert" tabIndex={-1} className="mx-5 my-3 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive outline-none sm:mx-7"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</p>}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-popover px-5 py-4 sm:px-7">
        {preview ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => { setPreview(null); setError(null); }} className="h-10 gap-2 text-muted-foreground"><ArrowLeft aria-hidden="true" /> Chỉnh yêu cầu</Button>
        ) : <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-3.5" /> Xem trước rồi áp dụng</span>}
        <Button type="submit" disabled={busy || (preview ? included.length === 0 : selected.length === 0)} className="ml-auto h-10 gap-2 rounded-lg px-5 shadow-sm">
          {busy ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-pulse" /> : preview ? <Check aria-hidden="true" /> : <WandSparkles aria-hidden="true" />}
          {status === "applying" ? "Đang lưu lịch…" : status === "generating" ? "Đang tạo kế hoạch…" : preview ? `Áp dụng ${included.length} việc` : "Tạo kế hoạch"}
          {!busy && !preview && <ArrowRight aria-hidden="true" className="size-3.5" />}
        </Button>
      </footer>
    </form>
  );
};
