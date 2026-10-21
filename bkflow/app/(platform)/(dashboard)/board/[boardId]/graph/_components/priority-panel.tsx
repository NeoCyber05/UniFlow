"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ReducedMotionConfig, blur, scale, spring, transition, useTempoTransition,
} from "@animate-ui/react/utils/motion";
import {
  AlarmClock, AlertTriangle, Check, ChevronDown, ExternalLink, Flag, Loader2, Lock, Minus, Plus, Route, Sparkles, Star,
  Target, Unlock, Wand2,
} from "lucide-react";

import type { PriorityPlan, PriorityReason, Schedule, ScheduleDay, ScheduledTask } from "@/lib/boards/graph-priority";
import { cn } from "@/lib/utils";

type SortMode = "auto" | "ai";

const REASON_STYLE: Record<PriorityReason["kind"], { icon: typeof Flag; className: string }> = {
  overdue: { icon: AlarmClock, className: "bg-rose-50 text-rose-700 ring-rose-200" },
  due: { icon: AlarmClock, className: "bg-amber-50 text-amber-700 ring-amber-200" },
  chain: { icon: Route, className: "bg-violet-50 text-violet-700 ring-violet-200" },
  unlocks: { icon: Unlock, className: "bg-sky-50 text-sky-700 ring-sky-200" },
  important: { icon: Star, className: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
};

const AI_PRESETS = [
  "Việc nhanh, dễ trước để lấy đà",
  "Gấp nhất trước, bỏ qua việc chưa có hạn",
  "Ưu tiên ôn thi và môn quan trọng",
  "Việc khó, cần tập trung làm buổi sáng",
];

// Thời gian để thấy dấu tick trước khi việc rời lộ trình và các ngày tự dồn lên
const CHECK_HOLD_MS = 420;
// Mặc định chỉ mở vài ngày đầu: nhiều thẻ vẫn gọn, phần sau bấm để xem
const VISIBLE_DAYS = 3;
const PER_DAY_MIN = 1;
const PER_DAY_MAX = 10;

const formatDay = (day: ScheduleDay) => {
  const date = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(day.date);
  if (day.offset === 0) return { title: "Hôm nay", date };
  if (day.offset === 1) return { title: "Ngày mai", date };
  const weekday = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long" }).format(day.date);
  return { title: weekday.charAt(0).toUpperCase() + weekday.slice(1), date };
};

const formatDue = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(new Date(iso));

const Chip = ({ className, icon: Icon, children }: { className: string; icon?: typeof Flag; children: React.ReactNode }) => (
  <span className={cn("inline-flex max-w-full items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset", className)}>
    {Icon && <Icon aria-hidden="true" className="h-2.5 w-2.5 shrink-0" />}
    <span className="truncate">{children}</span>
  </span>
);

/** Tối đa vài chip để hàng không phình: rủi ro trễ hạn > vừa mở khóa > lý do AI hoặc 2 lý do heuristic. */
const TaskMeta = ({ task, fresh }: { task: ScheduledTask; fresh: boolean }) => (
  <span className="flex flex-wrap gap-1">
    {task.lateRisk && task.card.dueDate && (
      <Chip icon={AlertTriangle} className="bg-rose-50 text-rose-700 ring-rose-200">Hạn {formatDue(task.card.dueDate)}, sẽ trễ</Chip>
    )}
    {fresh && <Chip icon={Unlock} className="bg-emerald-500 text-white ring-emerald-500">Vừa mở khóa</Chip>}
    {task.aiReason ? (
      <Chip icon={Sparkles} className="bg-violet-50 text-violet-700 ring-violet-200">{task.aiReason}</Chip>
    ) : (
      task.reasons
        .filter((reason) => !(task.lateRisk && reason.kind === "due"))
        .slice(0, 2)
        .map((reason) => (
          <Chip key={reason.kind} icon={REASON_STYLE[reason.kind].icon} className={REASON_STYLE[reason.kind].className}>{reason.label}</Chip>
        ))
    )}
    {task.unranked && <Chip className="bg-neutral-100 text-neutral-500 ring-neutral-200">AI chưa xếp</Chip>}
  </span>
);

/** Nút tròn tick xong; vùng bấm rộng hơn vòng tròn để dễ trúng. */
const CheckCircle = ({ checked, onCheck, title }: { checked: boolean; onCheck: () => void; title: string }) => {
  const press = useTempoTransition(spring.press);
  const checkPop = useTempoTransition(spring.checkPop);
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Đánh dấu xong: ${title}`}
      disabled={checked}
      whileTap={{ scale: scale.press, transition: press }}
      onClick={(event) => { event.stopPropagation(); onCheck(); }}
      className="group/check -m-1.5 shrink-0 rounded-full p-1.5 focus-visible:outline-2 focus-visible:outline-violet-500"
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-200",
          checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-300 bg-white group-hover/check:border-violet-500 group-hover/check:bg-violet-50",
        )}
      >
        <AnimatePresence initial={false}>
          {checked && (
            <motion.span
              initial={{ opacity: 0, scale: scale.icon, filter: blur.icon }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: checkPop }}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
};

type Row =
  | { kind: "day"; key: string; day: ScheduleDay }
  | { kind: "task"; key: string; task: ScheduledTask; isNow: boolean };

type PriorityPanelProps = {
  plan: PriorityPlan;
  schedule: Schedule;
  perDay: number;
  onPerDayChange: (value: number) => void;
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusedCardId: string | null;
  onFocusCard: (cardId: string) => void;
  onOpenCard: (cardId: string) => void;
  onComplete: (cardId: string) => void;
  recentlyUnlocked: Set<string>;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  aiSummary?: string;
  hasAiOrder: boolean;
  /** Yêu cầu AI đã lưu, điền sẵn lại vào ô nhập. */
  lastAiRequest?: string;
  isRankingAi: boolean;
  onRankWithAi: (request: string) => void;
};

/** "Làm gì trước?": lộ trình theo ngày, mỗi ngày `perDay` việc, đúng thứ tự phụ thuộc; tick xong thì các ngày tự dồn lên. */
export const PriorityPanel = ({
  plan, schedule, perDay, onPerDayChange, canEdit, open, onOpenChange, focusedCardId, onFocusCard, onOpenCard, onComplete,
  recentlyUnlocked, sortMode, onSortModeChange, aiSummary, hasAiOrder, lastAiRequest, isRankingAi, onRankWithAi,
}: PriorityPanelProps) => {
  const [showAllDays, setShowAllDays] = useState(false);
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [request, setRequest] = useState(lastAiRequest ?? "");
  const slide = useTempoTransition(spring.slide);
  const move = useTempoTransition(spring.reflow);
  const fade = useTempoTransition(transition.fade);
  const press = useTempoTransition(spring.press);
  const select = useTempoTransition(spring.selection);
  const height = useTempoTransition(spring.height);

  const check = (cardId: string) => {
    setChecking((current) => new Set(current).add(cardId));
    window.setTimeout(() => {
      onComplete(cardId);
      setChecking((current) => {
        const next = new Set(current);
        next.delete(cardId);
        return next;
      });
    }, CHECK_HOLD_MS);
  };

  const submitAi = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isRankingAi) return;
    setRequest(trimmed);
    onRankWithAi(trimmed);
  };

  const { days, stuck, lateCount } = schedule;
  const total = days.reduce((sum, day) => sum + day.tasks.length, 0);
  const visibleDays = showAllDays ? days : days.slice(0, VISIBLE_DAYS);
  const hiddenDays = days.slice(visibleDays.length);
  const hiddenTaskCount = hiddenDays.reduce((sum, day) => sum + day.tasks.length, 0);
  const hasUnranked = sortMode === "ai" && days.some((day) => day.tasks.some((task) => task.unranked));
  const todayCount = days[0]?.offset === 0 ? days[0].tasks.length : 0;

  // Một danh sách phẳng (tiêu đề ngày + việc) để việc dồn từ ngày sau lên ngày trước trượt liền mạch
  const rows: Row[] = visibleDays.flatMap((day) => [
    { kind: "day" as const, key: `day-${day.offset}`, day },
    ...day.tasks.map((task, index) => ({ kind: "task" as const, key: task.card.id, task, isNow: day.offset === 0 && index === 0 })),
  ]);

  return (
    <ReducedMotionConfig>
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.aside
            key="panel"
            data-graph-overlay
            aria-label="Lộ trình ưu tiên"
            initial={{ opacity: 0, x: 24, filter: blur.panel }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)", transition: { ...slide, opacity: fade, filter: fade } }}
            exit={{ opacity: 0, x: 24, filter: blur.panel, transition: transition.panelOut }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-y-3 right-3 z-30 flex w-[min(360px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/95 shadow-xl backdrop-blur-md"
          >
            <header className="space-y-2.5 border-b border-neutral-100 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1.5 text-sm font-bold text-neutral-900">
                    <Target aria-hidden="true" className="h-4 w-4 text-violet-600" />
                    Làm gì trước?
                  </h2>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {total > 0 ? `${total} việc, xong trong khoảng ${days.length} ngày` : "Không còn việc nào đang mở"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Thu gọn lộ trình"
                  className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90" />
                </button>
              </div>

              {/* Cách xếp: nền trắng trượt giữa hai lựa chọn */}
              <div role="radiogroup" aria-label="Cách xếp thứ tự" className="grid grid-cols-2 rounded-xl bg-neutral-100 p-1 text-xs font-medium">
                {([
                  ["auto", "Tự động", Route],
                  ["ai", "AI theo ý bạn", Wand2],
                ] as const).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={sortMode === mode}
                    disabled={mode === "ai" && !canEdit}
                    onClick={() => onSortModeChange(mode)}
                    className={cn(
                      "relative flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors duration-200 disabled:opacity-50",
                      sortMode === mode ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900",
                    )}
                  >
                    {sortMode === mode && (
                      <motion.span layoutId="graph-priority-sort" transition={select} className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-neutral-200/70" />
                    )}
                    <Icon aria-hidden="true" className={cn("relative z-10 h-3.5 w-3.5", sortMode === mode && "text-violet-600")} />
                    <span className="relative z-10">{label}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence initial={false}>
                {sortMode === "ai" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1, transition: { height, opacity: fade } }}
                    exit={{ height: 0, opacity: 0, transition: transition.collapse }}
                    className="overflow-hidden"
                  >
                    <form className="space-y-2 pt-0.5" onSubmit={(event) => { event.preventDefault(); submitAi(request); }}>
                      <div className="flex gap-1.5">
                        <input
                          value={request}
                          maxLength={300}
                          onChange={(event) => setRequest(event.target.value)}
                          placeholder="Vd: thứ 6 thi Giải tích, ưu tiên môn đó"
                          aria-label="Bạn muốn ưu tiên thế nào?"
                          className="h-8 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs outline-none focus-visible:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-100"
                        />
                        <motion.button
                          type="submit"
                          whileTap={{ scale: scale.press, transition: press }}
                          disabled={isRankingAi || !request.trim() || plan.ready.length === 0}
                          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:opacity-50"
                        >
                          {isRankingAi ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />}
                          Xếp
                        </motion.button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {AI_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            disabled={isRankingAi}
                            onClick={() => submitAi(preset)}
                            className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-600 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      {!hasAiOrder && !isRankingAi && <p className="text-[11px] text-neutral-500">Chưa xếp bằng AI: đang dùng thứ tự tự động.</p>}
                      {aiSummary && <p className="text-[11px] leading-snug text-violet-700">{aiSummary}</p>}
                      {hasUnranked && (
                        <button type="button" onClick={() => submitAi(request)} disabled={isRankingAi || !request.trim()} className="text-[11px] font-semibold text-violet-600 hover:underline disabled:opacity-50">
                          Có việc mới mở khóa, xếp lại bằng AI
                        </button>
                      )}
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sức làm mỗi ngày quyết định việc rơi vào ngày nào */}
              <div className="flex items-center justify-between gap-2 text-xs text-neutral-600">
                <span id="graph-per-day-label">Mỗi ngày làm</span>
                <div role="group" aria-labelledby="graph-per-day-label" className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Bớt một việc mỗi ngày"
                    disabled={perDay <= PER_DAY_MIN}
                    onClick={() => onPerDayChange(Math.max(PER_DAY_MIN, perDay - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
                  >
                    <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                  <span aria-live="polite" className="min-w-14 text-center font-semibold tabular-nums text-neutral-900">{perDay} việc</span>
                  <button
                    type="button"
                    aria-label="Thêm một việc mỗi ngày"
                    disabled={perDay >= PER_DAY_MAX}
                    onClick={() => onPerDayChange(Math.min(PER_DAY_MAX, perDay + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
                  >
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {lateCount > 0 && (
                <p role="status" className="flex items-start gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] leading-snug text-rose-700 ring-1 ring-inset ring-rose-200">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span><b>{lateCount} việc</b> rơi vào sau hạn chót. Tăng số việc mỗi ngày hoặc dời hạn.</span>
                </p>
              )}
            </header>

            <div className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-3 styled-scrollbar transition-opacity", isRankingAi && "opacity-60")}>
              {total === 0 && stuck.length === 0 && (
                <p className="rounded-xl bg-neutral-50 px-3 py-6 text-center text-xs text-neutral-500">Không còn việc nào đang mở.</p>
              )}

              <ol aria-label="Lộ trình theo ngày" className="flex flex-col">
                <AnimatePresence mode="popLayout" initial={false}>
                  {rows.map((row, rowIndex) => {
                    if (row.kind === "day") {
                      const { title, date } = formatDay(row.day);
                      const isToday = row.day.offset === 0;
                      const hasLate = row.day.tasks.some((task) => task.lateRisk);
                      return (
                        <motion.li
                          key={row.key}
                          layout="position"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, transition: fade }}
                          exit={{ opacity: 0, transition: fade }}
                          transition={move}
                          className={cn("relative pb-2 pl-8", rowIndex > 0 && "pt-1")}
                        >
                          {/* Đường ray nối các ngày; ray bắt đầu từ chấm của ngày đầu tiên */}
                          <span aria-hidden="true" className={cn("absolute bottom-0 left-[11px] w-px bg-neutral-200", rowIndex === 0 ? "top-2" : "top-0")} />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute left-[5px] flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white",
                              rowIndex === 0 ? "top-0.5" : "top-1.5",
                              isToday ? "bg-violet-600" : hasLate ? "bg-rose-500" : "bg-neutral-300",
                            )}
                          >
                            {isToday && <span className="absolute inset-0 rounded-full bg-violet-500 opacity-50 motion-safe:animate-ping" />}
                          </span>
                          <p className="flex items-baseline gap-1.5">
                            <span className={cn("text-xs font-bold", isToday ? "text-violet-700" : "text-neutral-800")}>{title}</span>
                            <span className="text-[11px] tabular-nums text-neutral-400">{date}</span>
                            <span className="ml-auto text-[11px] tabular-nums text-neutral-400">{row.day.tasks.length} việc</span>
                          </p>
                        </motion.li>
                      );
                    }

                    const { task, isNow } = row;
                    const isChecking = checking.has(task.card.id);
                    const fresh = recentlyUnlocked.has(task.card.id);
                    return (
                      <motion.li
                        key={row.key}
                        layout="position"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { ...move, opacity: fade } }}
                        exit={{ opacity: 0, scale: 0.96, transition: fade }}
                        transition={move}
                        className="relative pb-2 pl-8"
                      >
                        <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-0 w-px bg-neutral-200" />
                        <div
                          className={cn(
                            "group flex items-start gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
                            task.ready ? "border-neutral-200 bg-white shadow-xs hover:border-violet-200" : "border-dashed border-neutral-300 bg-neutral-50/80",
                            isNow && "border-violet-300 bg-violet-50/70 shadow-sm shadow-violet-100",
                            fresh && "border-emerald-300 bg-emerald-50/70",
                            focusedCardId === task.card.id && "ring-2 ring-violet-500",
                          )}
                        >
                          {task.ready && canEdit ? (
                            <CheckCircle checked={isChecking} title={task.card.title} onCheck={() => check(task.card.id)} />
                          ) : (
                            <span
                              title={task.ready ? undefined : "Làm sau khi xong việc chặn"}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200/70 text-neutral-500"
                            >
                              {task.ready ? null : <Lock aria-hidden="true" className="h-2.5 w-2.5" />}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => onFocusCard(task.card.id)}
                            onDoubleClick={() => onOpenCard(task.card.id)}
                            title="Bấm để xem trên sơ đồ, bấm đúp để mở thẻ"
                            className="min-w-0 flex-1 space-y-1 text-left focus-visible:outline-none"
                          >
                            <span className={cn(
                              "line-clamp-2 block text-xs font-medium leading-snug transition-colors",
                              task.ready ? "text-neutral-800" : "text-neutral-500",
                              isNow && "font-semibold text-neutral-900",
                              isChecking && "text-neutral-400 line-through",
                            )}>
                              {isNow && (
                                <span className="mr-1.5 inline-flex -translate-y-px items-center rounded-full bg-violet-600 px-1.5 py-px align-middle text-[9px] font-bold uppercase tracking-wide text-white">
                                  Làm ngay
                                </span>
                              )}
                              {task.card.title}
                            </span>
                            {!task.ready && (
                              <span className="line-clamp-1 block text-[10px] text-neutral-400">
                                Sau: {task.waitingOn.map((blocker) => blocker.title).join(", ")}
                              </span>
                            )}
                            <TaskMeta task={task} fresh={fresh} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenCard(task.card.id)}
                            aria-label={`Mở thẻ ${task.card.title}`}
                            className="shrink-0 rounded p-0.5 text-neutral-400 opacity-0 transition-opacity hover:text-violet-600 focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ol>

              {hiddenDays.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllDays(true)}
                  className="ml-8 mt-1 w-[calc(100%-2rem)] rounded-lg border border-dashed border-neutral-300 py-2 text-[11px] font-semibold text-violet-600 transition-colors hover:border-violet-300 hover:bg-violet-50"
                >
                  Xem thêm {hiddenDays.length} ngày ({hiddenTaskCount} việc)
                </button>
              )}
              {showAllDays && days.length > VISIBLE_DAYS && (
                <button type="button" onClick={() => setShowAllDays(false)} className="ml-8 mt-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-800">
                  Thu gọn
                </button>
              )}

              {stuck.length > 0 && (
                <section className="mt-3 rounded-xl bg-rose-50 px-3 py-2 ring-1 ring-inset ring-rose-200">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
                    <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                    {stuck.length} việc chờ nhau thành vòng, chưa xếp được
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {stuck.map((card) => (
                      <li key={card.id}>
                        <button type="button" onClick={() => onFocusCard(card.id)} className="line-clamp-1 text-left text-[11px] text-rose-700/90 hover:underline">
                          {card.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </motion.aside>
        ) : (
          <motion.button
            key="toggle"
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, transition: { ...spring.pop, opacity: fade } }}
            exit={{ opacity: 0, scale: 0.9, transition: transition.popOut }}
            whileTap={{ scale: scale.press, transition: press }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onOpenChange(true); }}
            className="absolute right-3 top-3 z-30 inline-flex h-9 items-center gap-1.5 rounded-full border border-violet-200 bg-white/95 px-3.5 text-xs font-semibold text-violet-700 shadow-lg backdrop-blur-md hover:bg-violet-50"
          >
            <Target aria-hidden="true" className="h-3.5 w-3.5" />
            Làm gì trước?
            {todayCount > 0 && (
              <span className="rounded-full bg-violet-600 px-1.5 text-[10px] tabular-nums text-white" aria-label={`${todayCount} việc hôm nay`}>{todayCount}</span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </ReducedMotionConfig>
  );
};
