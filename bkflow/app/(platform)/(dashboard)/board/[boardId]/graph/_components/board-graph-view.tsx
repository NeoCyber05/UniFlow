"use client";

import { BoardMemberRole } from "@/types";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "@/web/shims/next-navigation";
import { toast } from "sonner";
import { useLocalStorage } from "usehooks-ts";
import { AnimatePresence, motion } from "motion/react";
import { ReducedMotionConfig, scale, spring, transition, useTempoTransition } from "@animate-ui/react/utils/motion";
import { AlertTriangle, CheckCheck, ChevronRight, Loader2, Minus, Plus, Route, Sparkles, Target, Undo2, Wand2 } from "lucide-react";

import { useCardModal } from "@/hooks/use-card-modal";
import { useAction } from "@/hooks/use-action";
import { rankAiPriorities } from "@/actions/ai/rank-ai-priorities";
import { saveGraphPlan } from "@/actions/boards/save-graph-plan";
import { setCardCompleted } from "@/actions/cards/set-card-completed";
import type { GraphPlan } from "@/lib/boards/graph-plan";
import { buildSchedule, type ScheduleDay, type ScheduledTask } from "@/lib/boards/graph-priority";
import { cn } from "@/lib/utils";
import type { BoardTimelineBoardMember, BoardTimelineList } from "@/types";

import { FlowCard } from "./flow-card";
import { FlowEdges } from "./flow-edges";

type BoardGraphViewProps = {
  boardId: string;
  boardTitle: string;
  lists: BoardTimelineList[];
  boardMembers: BoardTimelineBoardMember[];
  currentUserId: string;
  currentBoardMemberId: string;
  currentMemberRole: BoardMemberRole;
  plan: GraphPlan | null;
  onPlanChange: (plan: GraphPlan) => void;
};

type Range = "today" | "week" | "month";
type Lane = { key: string; title: string; subtitle: string; tasks: ScheduledTask[]; isToday: boolean };

const RANGES: { id: Range; label: string; days: number }[] = [
  { id: "today", label: "Hôm nay", days: 1 },
  { id: "week", label: "Tuần này", days: 7 },
  { id: "month", label: "Tháng này", days: 30 },
];

const AI_PRESETS = [
  "Việc nhanh, dễ trước để lấy đà",
  "Gấp nhất trước, bỏ qua việc chưa có hạn",
  "Ưu tiên ôn thi và môn quan trọng",
  "Việc khó, cần tập trung làm buổi sáng",
];

// Thời gian để thấy dấu tick trước khi việc rời dòng chảy và các ngày tự dồn lên
const CHECK_HOLD_MS = 420;
const AI_DEFAULT_REQUEST = "Xếp hợp lý theo hạn nộp và mức quan trọng";
const PER_DAY_MIN = 1;
const PER_DAY_MAX = 10;
// Giới hạn của action rank-ai-priorities
const AI_MAX_CARDS = 60;
const EMPTY_PLAN: GraphPlan = { arranged: null, range: "week", aiOrder: null };

const shortDate = (date: Date) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(date);

const dayTitle = (day: ScheduleDay) => {
  if (day.offset === 0) return "Hôm nay";
  if (day.offset === 1) return "Ngày mai";
  const weekday = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long" }).format(day.date);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
};

/** Tuần/tháng: mỗi cột một ngày, tháng gộp 7 ngày một cột để không quá dài. */
const buildLanes = (days: ScheduleDay[], range: Range): Lane[] => {
  if (range !== "month") {
    return days.map((day) => ({ key: `d${day.offset}`, title: dayTitle(day), subtitle: shortDate(day.date), tasks: day.tasks, isToday: day.offset === 0 }));
  }
  const weeks: ScheduleDay[][] = [];
  for (const day of days) (weeks[Math.floor(day.offset / 7)] ??= []).push(day);
  return weeks.filter(Boolean).map((week, index) => ({
    key: `w${index}`,
    title: index === 0 ? "7 ngày tới" : `Tuần ${index + 1}`,
    subtitle: `${shortDate(week[0].date)} – ${shortDate(week[week.length - 1].date)}`,
    tasks: week.flatMap((day) => day.tasks),
    isToday: index === 0,
  }));
};

export const BoardGraphView = ({ boardId, lists, currentMemberRole, plan: savedPlan, onPlanChange }: BoardGraphViewProps) => {
  const router = useRouter();
  const cardModal = useCardModal();
  const canEdit = currentMemberRole !== BoardMemberRole.VIEWER;

  // Tick xong lạc quan: ghi đè theo revision lúc bấm, server trả bản mới (updatedAt đổi) thì tự hết hiệu lực
  const [completionOverrides, setCompletionOverrides] = useState<Map<string, { value: boolean; updatedAt: string }>>(new Map());
  const allCards = useMemo(
    () =>
      lists.flatMap((list) =>
        list.cards.map((card) => {
          const override = completionOverrides.get(card.id);
          return override && override.updatedAt === card.updatedAt ? { ...card, isCompleted: override.value } : card;
        }),
      ),
    [lists, completionOverrides],
  );

  // Thứ tự lưu trên server theo người và bảng: mở ở trình duyệt/thiết bị khác vẫn còn
  // arranged null = chưa xếp: thẻ hiện theo danh sách của bảng, chưa nối; chỉ xếp khi người dùng bấm
  const plan = savedPlan ?? EMPTY_PLAN;
  const { arranged, range, aiOrder } = plan;
  const updatePlan = (patch: Partial<GraphPlan>) => {
    const next = { ...plan, ...patch };
    onPlanChange(next);
    void saveGraphPlan({ boardId, plan: next }).then((result) => {
      if (result.error) toast.error(result.error);
      else onPlanChange(next);
    }).catch(() => toast.error("Không lưu được thứ tự, thử lại sau."));
  };
  const setRange = (value: Range) => updatePlan({ range: value });
  const setArranged = (value: GraphPlan["arranged"]) => updatePlan({ arranged: value });
  // Sức làm mỗi ngày là thói quen của người dùng, không riêng bảng nào
  const [perDay, setPerDay] = useLocalStorage("uniflow:graph-priority-per-day", 3);
  const [request, setRequest] = useState(aiOrder?.request ?? "");
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const flowRef = useRef<HTMLDivElement>(null);

  const press = useTempoTransition(spring.press);
  const select = useTempoTransition(spring.selection);
  const move = useTempoTransition(spring.reflow);
  const fade = useTempoTransition(transition.fade);
  const height = useTempoTransition(spring.height);

  const schedule = useMemo(
    () => buildSchedule(allCards, { perDay, order: plan.arranged === "ai" ? plan.aiOrder?.order : undefined }),
    [allCards, perDay, plan],
  );
  const flat = schedule.days.flatMap((day) => day.tasks);
  const stepById = new Map(flat.map((task, index) => [task.card.id, index + 1]));
  const rangeDays = RANGES.find((item) => item.id === range)!.days;
  const daysInRange = schedule.days.filter((day) => day.offset < rangeDays);
  const lanes = buildLanes(daysInRange, range);
  const shownCount = daysInRange.reduce((sum, day) => sum + day.tasks.length, 0);
  const laterCount = flat.length - shownCount;
  const countFor = (days: number) => schedule.days.filter((day) => day.offset < days).reduce((sum, day) => sum + day.tasks.length, 0);
  const readyIds = flat.filter((task) => task.ready).map((task) => task.card.id);
  const hasUnranked = arranged === "ai" && flat.some((task) => task.unranked);
  // Chưa xếp: mỗi danh sách của bảng một cột, giữ thứ tự thẻ trên bảng
  const taskById = new Map(flat.map((task) => [task.card.id, task]));
  const listLanes = lists
    .map((list) => ({
      key: list.id,
      title: list.title,
      tasks: [...list.cards].sort((a, b) => a.order - b.order).flatMap((card) => taskById.get(card.id) ?? []),
    }))
    .filter((lane) => lane.tasks.length > 0);
  const nextRange = RANGES[RANGES.findIndex((item) => item.id === range) + 1];

  const { execute: executeRankAi, isLoading: isRankingAi } = useAction(rankAiPriorities, {
    onSuccess: (result) => {
      updatePlan({ aiOrder: { ...result, request: request.trim() }, arranged: "ai" });
    },
    onError: (error) => toast.error(error),
  });

  const submitAi = (value: string) => {
    // Không ghi yêu cầu thì AI xếp theo mặc định (hạn, mức quan trọng)
    const trimmed = value.trim() || AI_DEFAULT_REQUEST;
    if (isRankingAi || readyIds.length === 0) return;
    // shortcut: AI chỉ xếp 60 việc đầu, phần còn lại theo heuristic; tăng giới hạn schema nếu bảng lớn hơn.
    executeRankAi({ boardId, cardIds: readyIds.slice(0, AI_MAX_CARDS), request: trimmed });
  };

  const setCompletion = async (cardId: string, value: boolean) => {
    const card = allCards.find((item) => item.id === cardId);
    if (!card) return;
    const remember = (next: { value: boolean; updatedAt: string } | null) =>
      setCompletionOverrides((current) => {
        const copy = new Map(current);
        if (next) copy.set(cardId, next);
        else copy.delete(cardId);
        return copy;
      });
    remember({ value, updatedAt: card.updatedAt });
    if (value) {
      toast.success(`Đã xong "${card.title}"`, {
        action: { label: "Hoàn tác", onClick: () => void setCompletion(cardId, false) },
      });
    }

    const result = await setCardCompleted({ cardId, value });
    if (result.error) {
      remember(null);
      toast.error(result.error);
      return;
    }
    router.refresh();
  };

  const check = (cardId: string) => {
    setChecking((current) => new Set(current).add(cardId));
    window.setTimeout(() => {
      void setCompletion(cardId, true);
      setChecking((current) => {
        const next = new Set(current);
        next.delete(cardId);
        return next;
      });
    }, CHECK_HOLD_MS);
  };

  const renderCard = (task: ScheduledTask) => {
    const step = arranged ? stepById.get(task.card.id) : undefined;
    return (
      <div data-flow-id={task.card.id} className="relative">
      <FlowCard
        boardId={boardId}
        task={task}
        step={step}
        isNow={step === 1}
        checking={checking.has(task.card.id)}
        canEdit={canEdit}
        onCheck={() => check(task.card.id)}
        onOpen={() => cardModal.onOpen(task.card.id)}
      />
      </div>
    );
  };

  const cardMotion = {
    layout: "position" as const,
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { ...move, opacity: fade } },
    exit: { opacity: 0, scale: 0.96, transition: fade },
    transition: move,
  };

  return (
    <ReducedMotionConfig>
      <div className="flex h-full flex-col gap-3">
        {/* Một khối điều khiển: ràng buộc (mỗi ngày, yêu cầu cho AI) rồi bấm xếp */}
        <header className="space-y-3 rounded-2xl border border-neutral-200/80 bg-white/95 p-4 shadow-xs backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-base font-bold text-neutral-900">
                <Target aria-hidden="true" className="h-5 w-5 text-violet-600" />
                Làm gì trước?
              </h1>
              <p className="mt-0.5 text-xs text-neutral-500">
                {flat.length === 0
                  ? "Không còn việc nào đang mở"
                  : arranged
                    ? `${flat.length} việc, xong trong khoảng ${schedule.days.length} ngày nếu làm ${perDay} việc/ngày`
                    : `${flat.length} việc đang mở trong ${listLanes.length} danh sách. Bấm sắp xếp để biết nên làm gì trước.`}
              </p>
            </div>

            {arranged && (
              <div role="tablist" aria-label="Khoảng thời gian" className="flex rounded-xl bg-neutral-100 p-1 text-xs font-semibold">
                {RANGES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={range === item.id}
                    onClick={() => setRange(item.id)}
                    className={cn(
                      "relative flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors duration-200",
                      range === item.id ? "text-violet-700" : "text-neutral-500 hover:text-neutral-900",
                    )}
                  >
                    {range === item.id && <motion.span layoutId={`graph-range-${boardId}`} transition={select} className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-neutral-200/70" />}
                    <span className="relative z-10">{item.label}</span>
                    <span className="relative z-10 rounded-full bg-neutral-200/70 px-1.5 text-[10px] tabular-nums text-neutral-600">{countFor(item.days)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => { event.preventDefault(); if (canEdit) submitAi(request); }}
            className="space-y-2 rounded-xl bg-violet-50/60 p-2.5 ring-1 ring-inset ring-violet-100"
          >
            <div className="flex flex-wrap items-center gap-2">
              {/* Ràng buộc: số việc tối đa mỗi ngày quyết định việc rơi vào ngày nào */}
              <div role="group" aria-labelledby="graph-per-day-label" className="flex h-9 shrink-0 items-center gap-0.5 rounded-xl border border-neutral-200 bg-white px-1 text-xs text-neutral-600">
                <span id="graph-per-day-label" className="px-1.5">Mỗi ngày tối đa</span>
                <button
                  type="button"
                  aria-label="Bớt một việc mỗi ngày"
                  disabled={perDay <= PER_DAY_MIN}
                  onClick={() => setPerDay(Math.max(PER_DAY_MIN, perDay - 1))}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-neutral-100 disabled:cursor-default disabled:opacity-40"
                >
                  <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
                <span aria-live="polite" className="min-w-12 text-center font-semibold tabular-nums text-neutral-900">{perDay} việc</span>
                <button
                  type="button"
                  aria-label="Thêm một việc mỗi ngày"
                  disabled={perDay >= PER_DAY_MAX}
                  onClick={() => setPerDay(Math.min(PER_DAY_MAX, perDay + 1))}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-neutral-100 disabled:cursor-default disabled:opacity-40"
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="relative min-w-[220px] flex-1">
                <Sparkles aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-violet-500" />
                <input
                  value={request}
                  maxLength={300}
                  disabled={!canEdit}
                  onChange={(event) => setRequest(event.target.value)}
                  placeholder="Yêu cầu thêm cho AI (không bắt buộc), vd: thứ 6 thi Giải tích"
                  aria-label="Yêu cầu thêm cho AI"
                  className="h-9 w-full rounded-xl border border-neutral-200 bg-white pl-8 pr-3 text-xs outline-none transition-shadow focus-visible:border-violet-400 focus-visible:ring-3 focus-visible:ring-violet-100"
                />
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <motion.button
                  type="button"
                  whileTap={{ scale: scale.press, transition: press }}
                  onClick={() => setArranged("auto")}
                  disabled={flat.length === 0}
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold transition-colors disabled:cursor-default disabled:opacity-50",
                    arranged === "auto" ? "border-violet-400 text-violet-700 ring-2 ring-violet-200" : "border-neutral-200 text-neutral-700 hover:border-violet-300 hover:text-violet-700",
                  )}
                >
                  <Route aria-hidden="true" className="h-3.5 w-3.5" />
                  Tự động sắp xếp
                </motion.button>
                <motion.button
                  type="submit"
                  whileTap={{ scale: scale.press, transition: press }}
                  disabled={!canEdit || isRankingAi || readyIds.length === 0}
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-default disabled:opacity-50",
                    arranged === "ai" && "ring-2 ring-violet-300",
                  )}
                >
                  {isRankingAi ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Wand2 aria-hidden="true" className="h-3.5 w-3.5" />}
                  {isRankingAi ? "AI đang xếp…" : "AI sắp xếp"}
                </motion.button>
                {arranged && (
                  <button
                    type="button"
                    onClick={() => setArranged(null)}
                    title="Về dạng danh sách, bỏ nối"
                    className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-xl px-2.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-white hover:text-neutral-800"
                  >
                    <Undo2 aria-hidden="true" className="h-3.5 w-3.5" />
                    Bỏ sắp xếp
                  </button>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-neutral-400">Gợi ý:</span>
                {AI_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isRankingAi}
                    onClick={() => setRequest(preset)}
                    className={cn(
                      "cursor-pointer rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                      request === preset ? "border-violet-300 text-violet-700" : "border-neutral-200 text-neutral-600 hover:border-violet-300 hover:text-violet-700",
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence initial={false} mode="popLayout">
              {arranged && (
                <motion.p
                  key={arranged}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, transition: { ...height, opacity: fade } }}
                  exit={{ opacity: 0, transition: transition.collapse }}
                  className="flex items-start gap-1.5 text-[11px] leading-snug text-violet-800"
                >
                  {arranged === "ai" ? <Sparkles aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" /> : <Route aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />}
                  <span>
                    {arranged === "ai"
                      ? aiOrder?.summary || "AI đã xếp theo yêu cầu của bạn."
                      : "Đã xếp tự động: quá hạn và sắp tới hạn trước, rồi đến việc gắn sao và hạn sớm."}
                    {hasUnranked && (
                      <button type="button" onClick={() => submitAi(request)} disabled={isRankingAi} className="ml-1.5 cursor-pointer font-semibold text-violet-600 hover:underline disabled:opacity-50">
                        Có việc mới, xếp lại bằng AI
                      </button>
                    )}
                  </span>
                </motion.p>
              )}
            </AnimatePresence>
          </form>

          {arranged && schedule.lateCount > 0 && (
            <p role="status" className="flex items-start gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] leading-snug text-rose-700 ring-1 ring-inset ring-rose-200">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span><b>{schedule.lateCount} việc</b> rơi vào sau hạn chót. Tăng số việc mỗi ngày hoặc dời hạn.</span>
            </p>
          )}
        </header>

        {/* Dòng chảy công việc */}
        <section aria-label="Thứ tự nên làm" className={cn("min-h-0 flex-1 overflow-auto rounded-2xl border border-neutral-200/80 bg-white/80 p-5 shadow-xs backdrop-blur-sm styled-scrollbar transition-opacity", isRankingAi && "opacity-60")}>
          {flat.length === 0 && schedule.stuck.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCheck aria-hidden="true" className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-neutral-800">Xong hết rồi!</p>
              <p className="text-xs text-neutral-500">Không còn việc nào đang mở trên bảng này.</p>
            </div>
          ) : !arranged ? (
            // Chưa xếp: các danh sách của bảng, chưa có thứ tự hay mũi tên
            <ol className="flex min-w-max items-start gap-x-5 pb-2">
              {listLanes.map((lane) => (
                <li key={lane.key} className="w-72 shrink-0 rounded-xl bg-neutral-50/80 p-2.5 ring-1 ring-inset ring-neutral-200/70">
                  <p className="mb-2.5 flex items-baseline gap-1.5 px-0.5">
                    <span className="truncate text-sm font-bold text-neutral-800">{lane.title}</span>
                    <span className="ml-auto text-[11px] tabular-nums text-neutral-400">{lane.tasks.length} việc</span>
                  </p>
                  <ol className="flex flex-col gap-2">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {lane.tasks.map((task) => (
                        <motion.li key={task.card.id} {...cardMotion}>
                          {renderCard(task)}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ol>
                </li>
              ))}
            </ol>
          ) : shownCount === 0 ? (
            <p className="py-12 text-center text-xs text-neutral-500">Không có việc nào trong khoảng này.</p>
          ) : range === "today" ? (
            // Hôm nay: một hàng ① → ② → ③, cuộn ngang thay vì xuống dòng để đường nối không gãy
            <div ref={flowRef} className="relative w-max">
              <FlowEdges containerRef={flowRef} nodes={lanes[0].tasks.map((task) => ({ id: task.card.id, lane: "row" }))} />
              <ol className="relative flex items-center gap-x-16 pb-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {lanes[0].tasks.map((task) => (
                    <motion.li key={task.card.id} {...cardMotion} className="w-72">
                      {renderCard(task)}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            </div>
          ) : (
            // Tuần/tháng: mỗi cột một mốc; đường cong nối việc này → việc sau, cả sang cột kế
            <div ref={flowRef} className="relative w-max">
            <FlowEdges containerRef={flowRef} nodes={lanes.flatMap((lane) => lane.tasks.map((task) => ({ id: task.card.id, lane: lane.key })))} />
            <ol className="relative flex items-start gap-x-16 pb-2">
              {lanes.map((lane) => (
                <li key={lane.key} className="flex items-start">
                  <div className="w-72 shrink-0">
                  <div className="mb-3 flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative mt-0.5 flex h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white",
                        lane.isToday ? "bg-violet-600" : lane.tasks.some((task) => task.lateRisk) ? "bg-rose-500" : "bg-neutral-300",
                      )}
                    >
                      {lane.isToday && <span className="absolute inset-0 rounded-full bg-violet-500 opacity-50 motion-safe:animate-ping" />}
                    </span>
                    <div className="min-w-0 flex-1 bg-white/0">
                      <p className="flex items-baseline gap-1.5">
                        <span className={cn("text-sm font-bold", lane.isToday ? "text-violet-700" : "text-neutral-800")}>{lane.title}</span>
                        <span className="text-[11px] tabular-nums text-neutral-400">{lane.subtitle}</span>
                        <span className="ml-auto text-[11px] tabular-nums text-neutral-400">{lane.tasks.length} việc</span>
                      </p>
                    </div>
                  </div>
                  <ol className="flex flex-col gap-y-9">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {lane.tasks.map((task) => (
                        <motion.li key={task.card.id} {...cardMotion}>
                          {renderCard(task)}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ol>
                  </div>
                </li>
              ))}
            </ol>
            </div>
          )}

          {arranged && laterCount > 0 && shownCount > 0 && (
            <button
              type="button"
              onClick={() => nextRange && setRange(nextRange.id)}
              disabled={!nextRange}
              className="mt-6 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-violet-600 transition-colors hover:border-violet-300 hover:bg-violet-50 disabled:cursor-default disabled:text-neutral-500 disabled:hover:bg-transparent"
            >
              Còn {laterCount} việc sau {RANGES.find((item) => item.id === range)!.label.toLowerCase()}
              {nextRange && <><span className="font-normal text-neutral-400">·</span> Xem {nextRange.label.toLowerCase()} <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" /></>}
            </button>
          )}

          {schedule.stuck.length > 0 && (
            <section className="mt-6 max-w-md rounded-xl bg-rose-50 px-3 py-2 ring-1 ring-inset ring-rose-200">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                {schedule.stuck.length} việc chờ nhau thành vòng, chưa xếp được
              </p>
              <ul className="mt-1 space-y-0.5">
                {schedule.stuck.map((card) => (
                  <li key={card.id}>
                    <button type="button" onClick={() => cardModal.onOpen(card.id)} className="line-clamp-1 cursor-pointer text-left text-[11px] text-rose-700/90 hover:underline">
                      {card.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      </div>
    </ReducedMotionConfig>
  );
};
