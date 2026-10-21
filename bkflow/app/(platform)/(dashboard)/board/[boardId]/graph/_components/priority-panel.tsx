"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ReducedMotionConfig, blur, scale, spring, transition, useTempoTransition,
} from "@animate-ui/react/utils/motion";
import {
  AlarmClock, Check, ChevronDown, Crosshair, ExternalLink, Flag, Loader2, Lock, Route, Sparkles, Star, Target, Unlock, Wand2,
} from "lucide-react";

import type { PriorityPlan, PriorityReason, ReadyTask } from "@/lib/boards/graph-priority";
import { cn } from "@/lib/utils";

type PanelTask = ReadyTask & { aiReason?: string; unranked?: boolean };
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

// Thời gian để thấy dấu tick trước khi việc rời danh sách và danh sách tự xếp lại
const CHECK_HOLD_MS = 420;

const Tags = ({ task, fresh }: { task: PanelTask; fresh: boolean }) => (
  <span className="flex flex-wrap gap-1">
    {fresh && (
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, transition: spring.checkPop }}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white"
      >
        <Unlock aria-hidden="true" className="h-2.5 w-2.5" />
        Vừa mở khóa
      </motion.span>
    )}
    {task.aiReason ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
        <Sparkles aria-hidden="true" className="h-2.5 w-2.5" />
        {task.aiReason}
      </span>
    ) : (
      task.reasons.map((reason) => {
        const { icon: Icon, className } = REASON_STYLE[reason.kind];
        return (
          <span key={reason.kind} className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset", className)}>
            <Icon aria-hidden="true" className="h-2.5 w-2.5" />
            {reason.label}
          </span>
        );
      })
    )}
    {task.unranked && (
      <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
        Chưa được AI xếp
      </span>
    )}
  </span>
);

/** Nút tròn tick xong: lấp đầy + dấu tick nảy lên, rồi việc mới rời danh sách. */
const CheckCircle = ({ checked, disabled, onCheck, title }: { checked: boolean; disabled?: boolean; onCheck: () => void; title: string }) => {
  const press = useTempoTransition(spring.press);
  const checkPop = useTempoTransition(spring.checkPop);
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Đánh dấu xong: ${title}`}
      disabled={disabled || checked}
      whileTap={{ scale: scale.press, transition: press }}
      onClick={(event) => { event.stopPropagation(); onCheck(); }}
      className={cn(
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
        checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-300 bg-white hover:border-violet-500 hover:bg-violet-50",
        disabled && !checked && "cursor-not-allowed opacity-50",
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
    </motion.button>
  );
};

const VISIBLE_READY = 6;

type PriorityPanelProps = {
  plan: PriorityPlan;
  readyTasks: PanelTask[];
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

/** "Làm gì trước?": việc làm được ngay, xếp bằng heuristic hoặc AI theo yêu cầu; tick xong thì tự xếp lại. */
export const PriorityPanel = ({
  plan, readyTasks, canEdit, open, onOpenChange, focusedCardId, onFocusCard, onOpenCard, onComplete,
  recentlyUnlocked, sortMode, onSortModeChange, aiSummary, hasAiOrder, lastAiRequest, isRankingAi, onRankWithAi,
}: PriorityPanelProps) => {
  const [showAll, setShowAll] = useState(false);
  const [waitingOpen, setWaitingOpen] = useState(false);
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

  const [first, ...rest] = readyTasks;
  const visibleRest = showAll ? rest : rest.slice(0, VISIBLE_READY - 1);
  const hasUnranked = sortMode === "ai" && readyTasks.some((task) => task.unranked);

  return (
    <ReducedMotionConfig>
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.aside
            key="panel"
            data-graph-overlay
            aria-label="Gợi ý thứ tự làm việc"
            initial={{ opacity: 0, x: 24, filter: blur.panel }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)", transition: { ...slide, opacity: fade, filter: fade } }}
            exit={{ opacity: 0, x: 24, filter: blur.panel, transition: transition.panelOut }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-y-3 right-3 z-30 flex w-[min(360px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/95 shadow-xl backdrop-blur-md"
          >
            <header className="space-y-2.5 border-b border-neutral-100 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-1.5 text-sm font-bold text-neutral-900">
                    <Target aria-hidden="true" className="h-4 w-4 text-violet-600" />
                    Làm gì trước?
                  </h2>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {plan.ready.length} việc làm được ngay · {plan.waiting.length} việc đang chờ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Thu gọn gợi ý"
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
                    <form
                      className="space-y-2 pt-0.5"
                      onSubmit={(event) => { event.preventDefault(); submitAi(request); }}
                    >
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
                      {!hasAiOrder && !isRankingAi && (
                        <p className="text-[11px] text-neutral-500">Chưa xếp bằng AI: đang dùng thứ tự tự động.</p>
                      )}
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
            </header>

            <div className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-3 styled-scrollbar transition-opacity", isRankingAi && "opacity-60")}>
              {!first ? (
                <p className="rounded-xl bg-neutral-50 px-3 py-6 text-center text-xs text-neutral-500">
                  {plan.waiting.length > 0
                    ? "Mọi việc còn lại đang chờ nhau (có vòng phụ thuộc). Mở một thẻ và bỏ bớt liên kết."
                    : "Không còn việc nào đang mở."}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Việc số 1: tick xong thì việc kế tiếp trượt lên thay chỗ */}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={first.card.id}
                      layout="position"
                      initial={{ opacity: 0, y: 8, filter: blur.surface }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { ...move, opacity: fade, filter: fade } }}
                      exit={{ opacity: 0, scale: 0.96, transition: fade }}
                      transition={move}
                      className={cn(
                        "rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-3 shadow-sm",
                        focusedCardId === first.card.id && "ring-2 ring-violet-500",
                      )}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Bắt đầu với</p>
                      <div className="mt-1 flex items-start gap-2.5">
                        {canEdit && <CheckCircle checked={checking.has(first.card.id)} title={first.card.title} onCheck={() => check(first.card.id)} />}
                        <p className={cn("line-clamp-2 text-sm font-semibold leading-snug text-neutral-900 transition-colors", checking.has(first.card.id) && "text-neutral-400 line-through")}>
                          {first.card.title}
                        </p>
                      </div>
                      <div className="mt-2">
                        <Tags task={first} fresh={recentlyUnlocked.has(first.card.id)} />
                      </div>
                      <div className="mt-3 flex gap-1.5">
                        <motion.button
                          type="button"
                          whileTap={{ scale: scale.press, transition: press }}
                          onClick={() => onFocusCard(first.card.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
                        >
                          <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
                          Xem trên sơ đồ
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: scale.press, transition: press }}
                          onClick={() => onOpenCard(first.card.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                        >
                          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                          Mở thẻ
                        </motion.button>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {rest.length > 0 && (
                    <section aria-label="Tiếp theo">
                      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Tiếp theo</p>
                      <ol className="flex flex-col gap-1.5">
                        <AnimatePresence mode="popLayout" initial={false}>
                          {visibleRest.map((task) => {
                            const isChecking = checking.has(task.card.id);
                            const fresh = recentlyUnlocked.has(task.card.id);
                            return (
                              <motion.li
                                key={task.card.id}
                                layout="position"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0, transition: { ...move, opacity: fade } }}
                                exit={{ opacity: 0, scale: 0.96, transition: fade }}
                                transition={move}
                                className={cn(
                                  "flex items-start gap-2.5 rounded-xl border px-2 py-2 transition-colors",
                                  fresh ? "border-emerald-200 bg-emerald-50/60" : "border-transparent hover:border-neutral-200 hover:bg-neutral-50",
                                  focusedCardId === task.card.id && "border-violet-200 bg-violet-50/60",
                                )}
                              >
                                {canEdit ? (
                                  <CheckCircle checked={isChecking} title={task.card.title} onCheck={() => check(task.card.id)} />
                                ) : (
                                  <span className="mt-0.5 h-5 w-5 shrink-0" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => onFocusCard(task.card.id)}
                                  onDoubleClick={() => onOpenCard(task.card.id)}
                                  title="Bấm để xem trên sơ đồ, bấm đúp để mở thẻ"
                                  className="min-w-0 flex-1 space-y-1 text-left"
                                >
                                  <span className={cn("line-clamp-2 block text-xs font-medium leading-snug text-neutral-800 transition-colors", isChecking && "text-neutral-400 line-through")}>
                                    {task.card.title}
                                  </span>
                                  <Tags task={task} fresh={fresh} />
                                </button>
                                <motion.span
                                  key={task.rank}
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0, transition: fade }}
                                  className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-bold tabular-nums text-white"
                                >
                                  {task.rank}
                                </motion.span>
                              </motion.li>
                            );
                          })}
                        </AnimatePresence>
                      </ol>
                      {rest.length > VISIBLE_READY - 1 && (
                        <button
                          type="button"
                          onClick={() => setShowAll((value) => !value)}
                          className="mt-1 w-full rounded-lg py-1.5 text-[11px] font-semibold text-violet-600 hover:bg-violet-50"
                        >
                          {showAll ? "Thu gọn" : `Xem thêm ${rest.length - (VISIBLE_READY - 1)} việc`}
                        </button>
                      )}
                    </section>
                  )}
                </div>
              )}

              {plan.waiting.length > 0 && (
                <section className="mt-3 border-t border-neutral-100 pt-2">
                  <button
                    type="button"
                    aria-expanded={waitingOpen}
                    onClick={() => setWaitingOpen((value) => !value)}
                    className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-600"
                  >
                    <span className="flex items-center gap-1.5"><Lock aria-hidden="true" className="h-3 w-3" />Đang chờ việc khác ({plan.waiting.length})</span>
                    <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform duration-200", waitingOpen && "rotate-180")} />
                  </button>
                  <AnimatePresence initial={false}>
                    {waitingOpen && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1, transition: { height, opacity: fade } }}
                        exit={{ height: 0, opacity: 0, transition: transition.collapse }}
                        className="flex flex-col gap-1 overflow-hidden"
                      >
                        {plan.waiting.map(({ card, waitingOn }) => (
                          <li key={card.id}>
                            <button
                              type="button"
                              onClick={() => onFocusCard(card.id)}
                              className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-neutral-50"
                            >
                              <span className="line-clamp-1 block text-xs text-neutral-600">{card.title}</span>
                              <span className="line-clamp-1 block text-[10px] text-neutral-400">
                                Chờ: {waitingOn.map((blocker) => blocker.title).join(", ")}
                              </span>
                            </button>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
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
            {plan.ready.length > 0 && (
              <span className="rounded-full bg-violet-600 px-1.5 text-[10px] tabular-nums text-white">{plan.ready.length}</span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </ReducedMotionConfig>
  );
};
