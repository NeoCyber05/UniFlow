"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  blur,
  ReducedMotionConfig,
  spring,
  transition,
  useTempoTransition,
} from "@animate-ui/react/utils/motion";
import type { KeyboardEvent } from "react";
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
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
  ["month", "Tháng", CalendarDays],
  ["week", "Tuần", CalendarRange],
  ["day", "Ngày", CalendarClock],
] as const;

const controlClassName =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-lg outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-violet-500/60";

const iconButtonClassName = "w-9 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900";

const StatChip = ({
  dotClassName,
  count,
  label,
  tone = "text-neutral-600",
}: {
  dotClassName: string;
  count: number;
  label: string;
  tone?: string;
}) => (
  <li className={cn("flex h-7 items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 text-xs", tone)}>
    <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dotClassName)} />
    <span className="font-semibold tabular-nums text-neutral-900">{count}</span>
    {label}
  </li>
);

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

  // Radiogroup chuẩn ARIA: mũi tên trái/phải đổi chế độ, chỉ nút đang chọn nhận Tab
  const handleViewModeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = VIEW_MODES.findIndex(([mode]) => mode === viewMode);
    const next = (index + step + VIEW_MODES.length) % VIEW_MODES.length;
    onChangeViewMode(VIEW_MODES[next][0]);
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  };

  return (
    <ReducedMotionConfig>
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-neutral-200/80 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToday}
            className={cn(controlClassName, "border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-800 shadow-xs hover:bg-neutral-50")}
          >
            Hôm nay
          </button>

          <div className="flex items-center">
            <Hint description={previousLabel} side="bottom">
              <button type="button" onClick={onPrevious} aria-label={previousLabel} className={cn(controlClassName, iconButtonClassName)}>
                <ChevronLeft className="h-[18px] w-[18px]" />
              </button>
            </Hint>
            <Hint description={nextLabel} side="bottom">
              <button type="button" onClick={onNext} aria-label={nextLabel} className={cn(controlClassName, iconButtonClassName)}>
                <ChevronRight className="h-[18px] w-[18px]" />
              </button>
            </Hint>
          </div>

          <div className="min-w-0">
            {/* Tiêu đề đổi theo khoảng xem: mờ qua nhau thay vì nhảy chữ */}
            <h1 className="relative h-7 overflow-hidden text-lg font-semibold leading-7 tracking-tight text-neutral-900">
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
            <p className="truncate text-xs text-neutral-500">{rangeLabel}</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <ul aria-label="Thống kê lịch" className="hidden items-center gap-1.5 md:flex">
            <StatChip dotClassName="bg-violet-500" count={scheduledItemsCount} label="có lịch" />
            {completedItemsCount > 0 && (
              <StatChip dotClassName="bg-emerald-500" count={completedItemsCount} label="xong" />
            )}
            {overdueItemsCount > 0 && (
              <StatChip dotClassName="bg-rose-500" count={overdueItemsCount} label="quá hạn" tone="text-rose-700" />
            )}
          </ul>

          <div
            role="radiogroup"
            aria-label="Chế độ xem lịch"
            onKeyDown={handleViewModeKeyDown}
            className="flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-neutral-200 bg-neutral-100/80 p-[3px]"
          >
            {VIEW_MODES.map(([mode, label, Icon]) => {
              const isActive = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => onChangeViewMode(mode)}
                  className={cn(
                    "relative flex h-full items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors duration-200",
                    "focus-visible:ring-2 focus-visible:ring-violet-500/60",
                    isActive ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-800",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="calendar-view-mode"
                      transition={slide}
                      className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-black/5"
                    />
                  )}
                  <Icon
                    aria-hidden
                    className={cn("relative z-10 h-4 w-4 transition-colors duration-200", isActive ? "text-violet-600" : "text-neutral-400")}
                  />
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onToggleUnscheduledCollapsed}
            aria-pressed={!isUnscheduledCollapsed}
            className={cn(
              controlClassName,
              "gap-2 border px-3 text-sm font-medium shadow-xs",
              isUnscheduledCollapsed
                ? "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
            )}
          >
            <CalendarX2 aria-hidden className="h-4 w-4 shrink-0" />
            Chưa xếp lịch
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                isUnscheduledCollapsed ? "bg-neutral-100 text-neutral-600" : "bg-violet-600 text-white",
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
