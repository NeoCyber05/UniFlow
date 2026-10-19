"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  blur,
  ReducedMotionConfig,
  spring,
  transition,
  useTempoTransition,
} from "@animate-ui/react/utils/motion";
import {
  CalendarX2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";

import type { ViewMode } from "../_types";

type CalendarToolbarProps = {
  titleLabel: string;
  rangeLabel: string;
  scheduledItemsCount: number;
  completedItemsCount: number;
  overdueItemsCount: number;
  isUnscheduledCollapsed: boolean;
  filteredUnscheduledCount: number;
  viewMode: ViewMode;
  previousLabel: string;
  nextLabel: string;
  onToggleUnscheduledCollapsed: () => void;
  onChangeViewMode: (mode: ViewMode) => void;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
};

const VIEW_MODES = [
  ["month", "Tháng"],
  ["week", "Tuần"],
  ["day", "Ngày"],
] as const;

const navButtonClassName =
  "flex h-7 items-center justify-center rounded-md text-neutral-600 transition-colors duration-200 hover:bg-neutral-100 hover:text-neutral-900";

export const CalendarToolbar = ({
  titleLabel,
  rangeLabel,
  scheduledItemsCount,
  completedItemsCount,
  overdueItemsCount,
  isUnscheduledCollapsed,
  filteredUnscheduledCount,
  viewMode,
  previousLabel,
  nextLabel,
  onToggleUnscheduledCollapsed,
  onChangeViewMode,
  onPrevious,
  onToday,
  onNext,
}: CalendarToolbarProps) => {
  const slide = useTempoTransition(spring.selection);
  const swap = useTempoTransition(transition.swap);

  return (
    <ReducedMotionConfig>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            {/* Tiêu đề đổi theo khoảng xem: mờ qua nhau thay vì nhảy chữ */}
            <h1 className="relative h-7 overflow-hidden text-xl font-bold tracking-tight text-neutral-900">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={titleLabel}
                  className="block truncate capitalize"
                  initial={{ opacity: 0, filter: blur.icon }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: blur.icon }}
                  transition={swap}
                >
                  {titleLabel}
                </motion.span>
              </AnimatePresence>
            </h1>
            <p className="truncate text-xs text-neutral-500">
              {rangeLabel}
              {" · "}
              <span className="font-semibold text-neutral-700">{scheduledItemsCount}</span> có lịch
              {completedItemsCount > 0 && (
                <span className="text-emerald-700"> · <span className="font-semibold">{completedItemsCount}</span> xong</span>
              )}
              {overdueItemsCount > 0 && (
                <span className="text-rose-600"> · <span className="font-semibold">{overdueItemsCount}</span> quá hạn</span>
              )}
            </p>
          </div>

          <div className="flex h-8 shrink-0 items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
            <Hint description={previousLabel} side="top">
              <button type="button" onClick={onPrevious} aria-label={previousLabel} className={cn(navButtonClassName, "w-7")}>
                <ChevronLeft className="h-4 w-4" />
              </button>
            </Hint>
            <button type="button" onClick={onToday} className={cn(navButtonClassName, "px-2.5 text-xs font-semibold text-neutral-800")}>
              Hôm nay
            </button>
            <Hint description={nextLabel} side="top">
              <button type="button" onClick={onNext} aria-label={nextLabel} className={cn(navButtonClassName, "w-7")}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </Hint>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Chế độ xem lịch"
            className="flex h-8 shrink-0 items-center rounded-lg bg-neutral-100 p-0.5"
          >
            {VIEW_MODES.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={viewMode === mode}
                onClick={() => onChangeViewMode(mode)}
                className={cn(
                  "relative h-7 rounded-md px-3 text-xs font-semibold transition-colors duration-200",
                  viewMode === mode ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900",
                )}
              >
                {viewMode === mode && (
                  <motion.span
                    layoutId="calendar-view-mode"
                    transition={slide}
                    className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-neutral-200/70"
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleUnscheduledCollapsed}
            aria-pressed={!isUnscheduledCollapsed}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-sm transition-colors duration-200",
              isUnscheduledCollapsed
                ? "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
            )}
          >
            <CalendarX2 className="h-3.5 w-3.5 shrink-0" />
            Chưa xếp lịch
            <span
              className={cn(
                "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                isUnscheduledCollapsed ? "bg-neutral-100 text-neutral-700" : "bg-violet-600 text-white",
              )}
            >
              {filteredUnscheduledCount}
            </span>
          </button>
        </div>
      </div>
    </ReducedMotionConfig>
  );
};
