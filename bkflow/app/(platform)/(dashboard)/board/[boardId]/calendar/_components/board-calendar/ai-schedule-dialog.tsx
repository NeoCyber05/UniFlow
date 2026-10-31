"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog } from "@animate-ui/react/primitives/radix-ui/dialog";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import { ShimmeringText } from "@animate-ui/react/primitives/texts/shimmering";
import { blur, ease, ReducedMotionConfig, scale, spring, transition, useTempoTransition } from "@animate-ui/react/utils/motion";
import { AlertCircle, ArrowLeft, ArrowRight, CalendarCheck2, CalendarDays, Check, Clock3, ListTodo, Loader2, ShieldCheck, Sparkles, WandSparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateAiSchedule } from "@/actions/ai/generate-ai-schedule";
import { applyAiSchedule } from "@/actions/cards/apply-ai-schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AI_SCHEDULE_TASK_LIMIT, GenerateAiSchedule, type AiSchedulePreview, type SchedulePreferencesInput } from "@/lib/calendar/ai-schedule";
import { intlDateFormat, tr } from "@/lib/i18n";
import { invalidateAfterWrite } from "@/lib/invalidate-after-write";
import { addVNDays, getVNDay, getVNDayKey } from "@/lib/my-tasks/vn-day";
import { cn } from "@/lib/utils";
import type { BoardCalendarUnscheduledCard } from "@/types";

type Props = { boardId: string; cards: BoardCalendarUnscheduledCard[]; disabled: boolean };
const dateLabel = (value: string) => intlDateFormat({ timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(value));
const timeLabel = (value: string) => intlDateFormat({ timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
const checkboxClass = "size-4 shrink-0 accent-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-not-allowed";
const RANGE_PRESETS = [
  { labelKey: "calendar.ai.preset.today", days: 0 },
  { labelKey: "calendar.ai.preset.days3", days: 2 },
  { labelKey: "calendar.ai.preset.days7", days: 6 },
  { labelKey: "calendar.ai.preset.days14", days: 13 },
] as const;
const LOADING_STEPS = [
  "calendar.ai.loading.step1",
  "calendar.ai.loading.step2",
  "calendar.ai.loading.step3",
] as const;
const PROMPT_SUGGESTIONS = [
  "calendar.ai.suggestion.morning",
  "calendar.ai.suggestion.break15",
  "calendar.ai.suggestion.hardFirst",
] as const;
// Which row lights up in each day column of the loading grid.
const LOADING_GRID = [0, 2, 1, 0, 2, 1, 0];

const ScheduleLoading = ({ count }: { count: number }) => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(current => Math.min(current + 1, LOADING_STEPS.length - 1)), 1800);
    return () => clearInterval(id);
  }, []);
  const pop = useTempoTransition(spring.checkPop);
  const fade = useTempoTransition(transition.fade);
  return (
    <ReducedMotionConfig>
      <div role="status" className="flex min-h-80 flex-col items-center justify-center px-4 py-10 text-center md:h-full md:min-h-0">
        <div aria-hidden="true" className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl" />
          <div className="relative grid grid-cols-7 gap-1.5 rounded-2xl border border-border bg-background p-3 shadow-sm">
            {LOADING_GRID.map((row, day) => (
              <div key={day} className="flex flex-col gap-1.5">
                <span className="mx-auto mb-0.5 h-1 w-3 rounded-full bg-muted-foreground/25" />
                {[0, 1, 2].map(cell => (
                  <span key={cell} className="relative h-5 w-6 rounded-[5px] bg-muted">
                    {cell === row && (
                      <motion.span className="absolute inset-0 rounded-[5px] bg-primary"
                        initial={{ opacity: 0, scale: scale.icon }}
                        animate={{ opacity: [0, 1, 1, 0], scale: [scale.icon, 1, 1, scale.icon] }}
                        // shortcut: decorative loop ignores AnimateUIProvider tempo; move onto scaleTransition if tempo is ever set.
                        transition={{ duration: 3.2, times: [0, 0.15, 0.75, 1], delay: day * 0.2, repeat: Infinity, ease: ease.out }} />
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <h3 className="mt-9 text-xl font-semibold tracking-tight">
          <ShimmeringText text={tr("calendar.ai.loading.heading")} duration={1.4} color="var(--foreground)" shimmeringColor="var(--primary)" />
        </h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{tr("calendar.ai.loading.subtitle", { count })}</p>
        <ol className="mt-6 w-full max-w-[15rem] space-y-2.5 text-left text-sm">
          {LOADING_STEPS.map((labelKey, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li key={labelKey} className={cn("flex items-center gap-3 transition-colors duration-300", !done && !active && "text-muted-foreground/60")}>
                <span className={cn("relative flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary/40 text-primary" : "border-border")}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {done ? (
                      <motion.span key="done" initial={{ opacity: 0, scale: scale.icon, filter: blur.icon }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: pop }}>
                        <Check className="size-3" strokeWidth={3} />
                      </motion.span>
                    ) : active ? (
                      <motion.span key="active" exit={{ opacity: 0, transition: fade }}>
                        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </span>
                {tr(labelKey)}
              </li>
            );
          })}
        </ol>
      </div>
    </ReducedMotionConfig>
  );
};

export const AiScheduleDialog = ({ boardId, cards, disabled }: Props) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const eligibleCards = cards.filter(card => !card.isCompleted);
  return (
    <Dialog.Root open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <Dialog.Trigger asChild>
        <Button type="button" disabled={disabled || eligibleCards.length === 0} className="h-10 w-full justify-between gap-2 px-3 shadow-sm">
          <span className="inline-flex items-center gap-2"><WandSparkles aria-hidden="true" /> {tr("calendar.ai.title")}</span>
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
                <Dialog.Title className="text-base font-semibold tracking-tight">{tr("calendar.ai.title")}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">{tr("calendar.ai.description")}</Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={tr("calendar.ai.closeAria")} className="shrink-0 text-muted-foreground"><X aria-hidden="true" /></Button>
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
    if (!parsed.success) { reportError(parsed.error.issues[0]?.message ?? tr("calendar.ai.error.invalidRequest")); return; }
    inFlight.current = true;
    setStatus("generating"); onBusyChange(true); setError(null);
    try {
      const result = await generateAiSchedule(parsed.data);
      if (!result.data) { reportError(result.error || tr("calendar.ai.error.generateFailed")); return; }
      setPreview(result.data);
      setIncluded(result.data.slots.map(slot => slot.cardId));
    } catch { reportError(tr("calendar.ai.error.connectFailed")); }
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
          reportError(tr("calendar.ai.error.transportUncertain"));
        } else reportError(result.error || tr("calendar.ai.error.saveFailed"));
        return;
      }
      invalidateAfterWrite(queryClient);
      toast.success(tr("calendar.ai.toast.applied", { count: result.data.count }));
      onClose();
    } catch {
      invalidateAfterWrite(queryClient);
      reportError(tr("calendar.ai.error.transportUncertain"));
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
              <ScheduleLoading count={selected.length} />
            ) : preview ? (
              <>
                <div className="mb-7 flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{tr("calendar.ai.preview.eyebrow")}</p>
                    <h3 ref={previewHeadingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
                      {preview.slots.length ? tr("calendar.ai.preview.headingReady") : tr("calendar.ai.preview.headingTight")}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">{preview.slots.length ? tr("calendar.ai.preview.descReady") : tr("calendar.ai.preview.descTight")}</p>
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
                          <span className="text-xs tabular-nums text-muted-foreground">{tr("calendar.ai.preview.dayTaskCount", { count: slots.length })}</span>
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
                                    <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground">{tr("calendar.duration.minutes", { minutes })}</span>
                                  </span>
                                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{slot.reason}</span>
                                </span>
                                <input type="checkbox" className={cn(checkboxClass, "mt-1")}
                                  checked={chosen} disabled={busy}
                                  aria-label={tr("calendar.ai.preview.applyTaskAria", { title: slot.title })}
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
                    <p className="mb-1 font-medium text-foreground">{tr("calendar.ai.preview.unscheduledLeft", { count: selected.length - preview.slots.length })}</p>
                    {cards.filter(card => selected.includes(card.cardId) && !preview.slots.some(slot => slot.cardId === card.cardId)).map(card => card.title).join(" · ")}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-7">
                <div>
                  <h3 className="max-w-md text-2xl font-semibold leading-tight tracking-tight">{tr("calendar.ai.setup.heading")}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tr("calendar.ai.setup.desc")}</p>
                </div>

                <fieldset>
                  <legend className="mb-2.5 flex items-center gap-2 text-sm font-medium"><CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" /> {tr("calendar.ai.setup.rangeLabel")}</legend>
                  <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted/60 p-1">
                    {RANGE_PRESETS.map(preset => {
                      const first = getVNDayKey(today);
                      const last = getVNDayKey(addVNDays(today, preset.days));
                      const active = preferences.fromDay === first && preferences.toDay === last;
                      return <button key={preset.days} type="button" aria-pressed={active}
                        onClick={() => setPreferences(current => ({ ...current, fromDay: first, toDay: last }))}
                        className={cn("rounded-lg px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring", active ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {tr(preset.labelKey)}
                      </button>;
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2.5 flex w-full items-center gap-2 text-sm font-medium"><Clock3 aria-hidden="true" className="size-4 text-muted-foreground" /> {tr("calendar.ai.setup.freeHoursLabel")} <span className="ml-auto text-xs font-normal text-muted-foreground">GMT+7</span></legend>
                  <div className="flex items-center gap-2">
                    <Input type="time" required aria-label={tr("calendar.occurrence.start")} value={preferences.dayStart} onChange={event => changePreference("dayStart", event.target.value)} className="h-10 flex-1 bg-background text-center tabular-nums" />
                    <span aria-hidden="true" className="text-muted-foreground">→</span>
                    <Input type="time" required aria-label={tr("calendar.occurrence.due")} value={preferences.dayEnd} onChange={event => changePreference("dayEnd", event.target.value)} className="h-10 flex-1 bg-background text-center tabular-nums" />
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="ai-schedule-prompt" className="mb-2.5 flex items-center gap-2 text-sm font-medium">
                    <Sparkles aria-hidden="true" className="size-4 text-muted-foreground" /> {tr("calendar.ai.setup.promptLabel")} <span className="ml-auto text-xs font-normal text-muted-foreground">{tr("calendar.ai.setup.optional")}</span>
                  </label>
                  <textarea id="ai-schedule-prompt" rows={2} maxLength={1500}
                    value={prompt} onChange={event => setPrompt(event.target.value)}
                    placeholder={tr("calendar.ai.setup.promptPlaceholder")}
                    className="block w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PROMPT_SUGGESTIONS.map(suggestionKey => {
                      const suggestion = tr(suggestionKey);
                      return (
                        <button key={suggestionKey} type="button"
                          onClick={() => setPrompt(current => `${current}${current ? tr("calendar.ai.suggestion.separator") : ""}${suggestion}`.slice(0, 1500))}
                          className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                          + {suggestion}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </main>

          <aside className="flex min-h-0 min-w-0 flex-col border-t border-border bg-muted/30 px-5 py-6 md:overflow-y-auto md:border-l md:border-t-0">
            {preview ? (
              <>
                <div className="mb-6">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{tr("calendar.ai.sidebar.planEyebrow")}</p>
                  <p className="text-4xl font-semibold tabular-nums tracking-tight">{included.length}<span className="ml-2 text-sm font-normal tracking-normal text-muted-foreground">{tr("calendar.ai.sidebar.selectedTasksUnit")}</span></p>
                </div>
                <dl className="space-y-3 border-y border-border py-4 text-xs">
                  <div className="flex items-center justify-between gap-3"><dt className="inline-flex items-center gap-2 text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" /> {tr("calendar.ai.sidebar.focusTime")}</dt><dd className="font-medium tabular-nums">{tr("calendar.duration.minutes", { minutes: selectedMinutes })}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="inline-flex items-center gap-2 text-muted-foreground"><CalendarDays aria-hidden="true" className="size-3.5" /> {tr("calendar.ai.sidebar.scheduledDays")}</dt><dd className="font-medium">{tr("calendar.ai.sidebar.daysUnit", { count: new Set(preview.slots.filter(slot => included.includes(slot.cardId)).map(slot => getVNDayKey(getVNDay(new Date(slot.startsAt))))).size })}</dd></div>
                </dl>
                <div className="mt-6">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold"><Sparkles aria-hidden="true" className="size-3.5 text-primary" /> {tr("calendar.ai.sidebar.aiNotes")}</p>
                  <p className="text-xs leading-6 text-muted-foreground">{preview.summary}</p>
                </div>
                <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">{tr("calendar.ai.sidebar.previewHint")}</p>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><ListTodo aria-hidden="true" className="size-4 text-muted-foreground" /> {tr("calendar.ai.sidebar.tasksTitle")}</h3>
                  <span className="rounded-md bg-background px-2 py-1 text-xs font-medium tabular-nums ring-1 ring-border">{selected.length}/{Math.min(cards.length, AI_SCHEDULE_TASK_LIMIT)}</span>
                </div>
                <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{tr("calendar.ai.sidebar.maxTasks", { limit: AI_SCHEDULE_TASK_LIMIT })}</span>
                  <button type="button" disabled={busy}
                    onClick={() => setSelected(selected.length ? [] : cards.slice(0, AI_SCHEDULE_TASK_LIMIT).map(card => card.cardId))}
                    className="rounded px-1 py-1 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
                    {selected.length ? tr("calendar.ai.sidebar.deselectAll") : tr("calendar.ai.sidebar.selectAll")}
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
              </>
            )}
          </aside>
        </Fade>
      </div>

      {error && <p ref={errorRef} role="alert" tabIndex={-1} className="mx-5 my-3 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive outline-none sm:mx-7"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</p>}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-popover px-5 py-4 sm:px-7">
        {preview ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => { setPreview(null); setError(null); }} className="h-10 gap-2 text-muted-foreground"><ArrowLeft aria-hidden="true" /> {tr("calendar.ai.footer.editRequest")}</Button>
        ) : <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-3.5" /> {tr("calendar.ai.footer.previewNote")}</span>}
        <Button type="submit" disabled={busy || (preview ? included.length === 0 : selected.length === 0)} className="ml-auto h-10 gap-2 rounded-lg px-5 shadow-sm">
          {busy ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-pulse" /> : preview ? <Check aria-hidden="true" /> : <WandSparkles aria-hidden="true" />}
          {status === "applying" ? tr("calendar.ai.footer.applying") : status === "generating" ? tr("calendar.ai.footer.generating") : preview ? tr("calendar.ai.footer.applyCount", { count: included.length }) : tr("calendar.ai.footer.generate")}
          {!busy && !preview && <ArrowRight aria-hidden="true" className="size-3.5" />}
        </Button>
      </footer>
    </form>
  );
};
