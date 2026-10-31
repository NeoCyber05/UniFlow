"use client";

import { useMemo } from "react";
import type { Label } from "@prisma/client";
import { AlarmClock, CalendarDays, CalendarOff, Check, CheckCircle2, Circle, Clock, Filter, Tag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const CHIP_TONES = {
  violet: "border-violet-300 bg-violet-50 text-violet-800",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-800",
  rose: "border-rose-300 bg-rose-50 text-rose-700",
  amber: "border-amber-300 bg-amber-50 text-amber-800",
};

const FilterSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{title}</p>
    {children}
  </section>
);

/** Ô bật/tắt một điều kiện lọc; bật thì tô màu theo ý nghĩa và hiện dấu tick. */
const FilterChip = ({
  icon: Icon,
  label,
  active,
  onToggle,
  tone = "violet",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onToggle: () => void;
  tone?: keyof typeof CHIP_TONES;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onToggle}
    className={cn(
      "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
      active ? CHIP_TONES[tone] : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
    )}
  >
    <Icon className="h-3.5 w-3.5 shrink-0" />
    <span className="truncate">{label}</span>
    {active && <Check aria-hidden="true" className="ml-auto h-3.5 w-3.5 shrink-0" />}
  </button>
);

interface BoardFiltersProps {
  boardId: string;
  labels: Pick<Label, "id" | "title" | "color">[];
  tone?: "dark" | "light";
}

export const BoardFilters = ({
  boardId,
  labels,
  tone = "dark",
}: BoardFiltersProps) => {
  const filters = useBoardFilters((state) =>
    state.filtersByBoardId[boardId] ?? emptyBoardFilters,
  );
  
  const toggleCompleted = useBoardFilters((state) => state.toggleCompleted);
  const toggleNotCompleted = useBoardFilters((state) => state.toggleNotCompleted);
  const toggleDueDateFilter = useBoardFilters((state) => state.toggleDueDateFilter);
  const toggleLabel = useBoardFilters((state) => state.toggleLabel);
  const toggleNoLabels = useBoardFilters((state) => state.toggleNoLabels);
  const clearFilters = useBoardFilters((state) => state.clearFilters);

  const {
    completedEnabled,
    notCompletedEnabled,
    selectedDueDateFilters,
    selectedLabelIds = [],
    noLabelsEnabled = false,
  } = filters;

  const activeFilterCount = useMemo(() => {
    return (
      (completedEnabled ? 1 : 0) +
      (notCompletedEnabled ? 1 : 0) +
      selectedDueDateFilters.length +
      selectedLabelIds.length +
      (noLabelsEnabled ? 1 : 0)
    );
  }, [
    completedEnabled,
    notCompletedEnabled,
    selectedDueDateFilters,
    selectedLabelIds,
    noLabelsEnabled,
  ]);

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="flex items-center gap-x-1.5">
      <Popover>
        <Hint
          description={tr("boardShell.filters.title")}
          side="bottom"
          sideOffset={8}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="transparent"
              className={cn(
                "relative h-8 w-8 rounded-lg shadow-sm cursor-pointer",
                tone === "dark"
                  ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                hasActiveFilters && "border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
              )}
              aria-label={tr("boardShell.filters.title")}
            >
              <Filter className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </Hint>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-80 gap-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-0 shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <Filter aria-hidden="true" className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-semibold text-neutral-900">{tr("boardShell.filters.title")}</span>
            {hasActiveFilters && (
              <span className="rounded-full bg-violet-100 px-1.5 text-[11px] font-semibold tabular-nums text-violet-700">{activeFilterCount}</span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => clearFilters(boardId)}
                className="ml-auto cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
              >
                {tr("boardShell.filters.clear")}
              </button>
            )}
            <PopoverClose asChild>
              <button
                type="button"
                aria-label={tr("boardShell.filters.close")}
                className={cn("cursor-pointer rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700", !hasActiveFilters && "ml-auto")}
              >
                <X className="h-4 w-4" />
              </button>
            </PopoverClose>
          </div>

          <div className="max-h-[420px] space-y-4 overflow-y-auto px-4 py-3.5 styled-scrollbar">
            <FilterSection title={tr("boardShell.filters.sectionStatus")}>
              <div className="grid grid-cols-2 gap-1.5">
                <FilterChip icon={CheckCircle2} label={tr("boardShell.filters.completed")} active={completedEnabled} onToggle={() => toggleCompleted(boardId)} tone="emerald" />
                <FilterChip icon={Circle} label={tr("boardShell.filters.notCompleted")} active={notCompletedEnabled} onToggle={() => toggleNotCompleted(boardId)} />
              </div>
            </FilterSection>

            <FilterSection title={tr("boardShell.filters.sectionDueDate")}>
              <div className="grid grid-cols-2 gap-1.5">
                <FilterChip icon={AlarmClock} label={tr("boardShell.filters.overdue")} active={selectedDueDateFilters.includes("overdue")} onToggle={() => toggleDueDateFilter(boardId, "overdue")} tone="rose" />
                <FilterChip icon={Clock} label={tr("boardShell.filters.dueTomorrow")} active={selectedDueDateFilters.includes("due-tomorrow")} onToggle={() => toggleDueDateFilter(boardId, "due-tomorrow")} tone="amber" />
                <FilterChip icon={CalendarDays} label={tr("boardShell.filters.dueNextWeek")} active={selectedDueDateFilters.includes("due-next-week")} onToggle={() => toggleDueDateFilter(boardId, "due-next-week")} />
                <FilterChip icon={CalendarOff} label={tr("boardShell.filters.noDue")} active={selectedDueDateFilters.includes("no-due")} onToggle={() => toggleDueDateFilter(boardId, "no-due")} />
              </div>
            </FilterSection>

            <FilterSection title={tr("boardShell.filters.sectionLabels")}>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip icon={Tag} label={tr("boardShell.filters.noLabels")} active={noLabelsEnabled} onToggle={() => toggleNoLabels(boardId)} />
                {labels.map((label) => {
                  const active = selectedLabelIds.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleLabel(boardId, label.id)}
                      className={cn(
                        "inline-flex h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                        active ? "border-violet-300 bg-violet-50 text-violet-800" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
                      )}
                    >
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
                      <span className="truncate">{label.title || tr("boardShell.filters.untitledLabel")}</span>
                      {active && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {labels.length === 0 && <p className="mt-1.5 text-xs text-neutral-400">{tr("boardShell.filters.emptyLabels")}</p>}
            </FilterSection>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
