"use client";

import { AnimatePresence, motion } from "motion/react";
import { blur, scale, spring, useTempoTransition } from "@animate-ui/react/utils/motion";
import { AlarmClock, AlertTriangle, Check, Lock, Route, Sparkles, Star, Unlock } from "lucide-react";

import { useBoardCourse } from "@/hooks/use-board-courses";
import type { PriorityReason, ScheduledTask } from "@/lib/boards/graph-priority";
import { getCourseColor, getCourseShortLabel } from "@/lib/courses/course-colors";
import { intlDateFormat, tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const REASON_STYLE: Record<PriorityReason["kind"], { icon: typeof Star; className: string }> = {
  overdue: { icon: AlarmClock, className: "bg-rose-50 text-rose-700 ring-rose-200" },
  due: { icon: AlarmClock, className: "bg-amber-50 text-amber-700 ring-amber-200" },
  chain: { icon: Route, className: "bg-violet-50 text-violet-700 ring-violet-200" },
  unlocks: { icon: Unlock, className: "bg-sky-50 text-sky-700 ring-sky-200" },
  important: { icon: Star, className: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
};

// Tạo Intl.DateTimeFormat tốn kém: dùng chung một bản cho mọi thẻ
const formatDue = (iso: string) =>
  intlDateFormat({ timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(new Date(iso));

const formatPriorityReason = (task: ScheduledTask, reason: PriorityReason): string => {
  switch (reason.kind) {
    case "overdue":
      return tr("graph.reason.overdue", { days: task.daysLeft !== null ? -task.daysLeft : 0 });
    case "due":
      if (task.daysLeft === 0) return tr("graph.reason.dueToday");
      if (task.daysLeft === 1) return tr("graph.reason.dueTomorrow");
      return tr("graph.reason.dueInDays", { days: task.daysLeft ?? 0 });
    case "chain":
      return tr("graph.reason.chain", { count: task.chainLength });
    case "unlocks":
      return tr("graph.reason.unlocks", { count: task.unlocks });
    case "important":
      return tr("graph.reason.important");
  }
};

const Chip = ({ className, icon: Icon, children }: { className: string; icon?: typeof Star; children: React.ReactNode }) => (
  <span className={cn("inline-flex max-w-full items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset", className)}>
    {Icon && <Icon aria-hidden="true" className="h-2.5 w-2.5 shrink-0" />}
    <span className="truncate">{children}</span>
  </span>
);

/** Nút tròn tick xong; vùng bấm 32px rộng hơn vòng tròn để dễ trúng. */
const CheckCircle = ({ checked, onCheck, title }: { checked: boolean; onCheck: () => void; title: string }) => {
  const press = useTempoTransition(spring.press);
  const checkPop = useTempoTransition(spring.checkPop);
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={tr("graph.card.markDoneAria", { title })}
      title={tr("graph.card.markDoneTitle")}
      disabled={checked}
      whileTap={{ scale: scale.press, transition: press }}
      onClick={(event) => { event.stopPropagation(); onCheck(); }}
      className="group/check -m-1.5 shrink-0 cursor-pointer rounded-full p-1.5 focus-visible:outline-2 focus-visible:outline-violet-500"
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-200",
          checked
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-neutral-300 bg-white text-transparent group-hover/check:border-emerald-500 group-hover/check:text-emerald-500",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {checked ? (
            <motion.span key="on" initial={{ opacity: 0, scale: scale.icon, filter: blur.icon }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: checkPop }}>
              <Check className="h-3 w-3" strokeWidth={3} />
            </motion.span>
          ) : (
            // Gợi ý dấu tick mờ khi rê chuột
            <Check key="off" className="h-3 w-3" strokeWidth={3} />
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
};

type FlowCardProps = {
  boardId: string;
  task: ScheduledTask;
  /** Chưa sắp xếp thì không có số bước, không cảnh báo trễ theo lịch. */
  step?: number;
  isNow: boolean;
  checking: boolean;
  canEdit: boolean;
  onCheck: () => void;
  onOpen: () => void;
};

export const FlowCard = ({ boardId, task, step, isNow, checking, canEdit, onCheck, onOpen }: FlowCardProps) => {
  const { card } = task;
  const course = useBoardCourse(boardId, card.courseId);
  const courseColor = course ? getCourseColor(course.color) : null;
  const lateRisk = step !== undefined && task.lateRisk;
  const reasons = task.reasons.filter((reason) => !(lateRisk && reason.kind === "due")).slice(0, 2);

  return (
    <div
      className={cn(
        "group flex w-full items-start gap-2.5 rounded-xl border bg-white p-3 shadow-xs transition-[border-color,box-shadow] duration-200 hover:border-violet-300 hover:shadow-md",
        isNow && "border-violet-300 bg-violet-50/60 shadow-sm shadow-violet-100 ring-1 ring-violet-200",
        !task.ready && "border-dashed bg-neutral-50",
        lateRisk && !isNow && "border-rose-200",
      )}
    >
      {task.ready && canEdit ? (
        <CheckCircle checked={checking} title={card.title} onCheck={onCheck} />
      ) : (
        <span
          title={task.ready ? undefined : tr("graph.card.lockedTitle")}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200/70 text-neutral-500"
        >
          {!task.ready && <Lock aria-hidden="true" className="h-2.5 w-2.5" />}
        </span>
      )}

      <button
        type="button"
        onClick={onOpen}
        title={tr("graph.card.openDetailTitle")}
        className="min-w-0 flex-1 cursor-pointer space-y-1.5 text-left focus-visible:outline-none"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[10px]">
          {/* Số bước nằm trong thẻ để không đè lên mũi tên nối */}
          {step !== undefined && <span
            aria-label={tr("graph.card.stepAria", { step })}
            className={cn(
              "flex h-4 min-w-4 shrink-0 items-center justify-center rounded px-1 font-bold tabular-nums text-white",
              isNow ? "bg-violet-600" : step <= 3 ? "bg-neutral-800" : "bg-neutral-400",
            )}
          >
            {step}
          </span>}
          {isNow && (
            <span className="shrink-0 rounded-full bg-violet-600 px-1.5 py-px font-bold uppercase tracking-wide text-white">
              {tr("graph.card.doNowBadge")}
            </span>
          )}
          {course && courseColor && (
            <span className={cn("truncate rounded px-1.5 py-px font-semibold ring-1 ring-inset", courseColor.chip)}>{getCourseShortLabel(course)}</span>
          )}
          <span className="truncate text-neutral-400">{card.listTitle}</span>
        </span>
        <span
          className={cn(
            "line-clamp-2 block text-[13px] font-semibold leading-snug text-neutral-800 transition-colors",
            !task.ready && "text-neutral-500",
            checking && "text-neutral-400 line-through",
          )}
        >
          {card.title}
        </span>
        {!task.ready && (
          <span className="line-clamp-1 block text-[10px] text-neutral-400">
            {tr("graph.card.waitingAfter", {
              titles: task.waitingOn.map((blocker) => blocker.title).join(", "),
            })}
          </span>
        )}
        <span className="flex flex-wrap gap-1">
          {lateRisk && card.dueDate && (
            <Chip icon={AlertTriangle} className="bg-rose-50 text-rose-700 ring-rose-200">
              {tr("graph.card.dueLateChip", { date: formatDue(card.dueDate) })}
            </Chip>
          )}
          {task.aiReason ? (
            <Chip icon={Sparkles} className="bg-violet-50 text-violet-700 ring-violet-200">{task.aiReason}</Chip>
          ) : (
            reasons.map((reason) => (
              <Chip key={reason.kind} icon={REASON_STYLE[reason.kind].icon} className={REASON_STYLE[reason.kind].className}>
                {formatPriorityReason(task, reason)}
              </Chip>
            ))
          )}
          {!lateRisk && card.dueDate && reasons.every((reason) => reason.kind !== "due" && reason.kind !== "overdue") && (
            <Chip className="bg-neutral-50 text-neutral-500 ring-neutral-200">
              {tr("graph.card.dueChip", { date: formatDue(card.dueDate) })}
            </Chip>
          )}
          {step !== undefined && task.unranked && (
            <Chip className="bg-neutral-100 text-neutral-500 ring-neutral-200">
              {tr("graph.card.unrankedChip")}
            </Chip>
          )}
        </span>
      </button>
    </div>
  );
};
