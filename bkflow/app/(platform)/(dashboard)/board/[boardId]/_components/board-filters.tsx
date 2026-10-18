"use client";

import { useState, useMemo } from "react";
import type { Label } from "@prisma/client";
import { Filter, X, ChevronDown, Clock, CalendarDays, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import { cn } from "@/lib/utils";

interface BoardFiltersProps {
  boardId: string;
  labels: Label[];
}

export const BoardFilters = ({
  boardId,
  labels,
}: BoardFiltersProps) => {
  const filters = useBoardFilters((state) =>
    state.filtersByBoardId[boardId] ?? emptyBoardFilters,
  );
  
  const toggleCompleted = useBoardFilters((state) => state.toggleCompleted);
  const toggleNotCompleted = useBoardFilters((state) => state.toggleNotCompleted);
  const toggleDueDateFilter = useBoardFilters((state) => state.toggleDueDateFilter);
  const toggleLabel = useBoardFilters((state) => state.toggleLabel);
  const toggleNoLabels = useBoardFilters((state) => state.toggleNoLabels);
  const setSelectedLabels = useBoardFilters((state) => state.setSelectedLabels);
  const clearFilters = useBoardFilters((state) => state.clearFilters);

  const [labelsExpanded, setLabelsExpanded] = useState(false);

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
          description="Lọc thẻ"
          side="bottom"
          sideOffset={8}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="transparent"
              className={cn(
                "relative h-8 w-8 rounded-lg border border-white/20 bg-white/10 text-white shadow-sm hover:bg-white/20 cursor-pointer",
                hasActiveFilters && "border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
              )}
              aria-label="Lọc thẻ"
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
          className="w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl overflow-y-auto max-h-[480px] styled-scrollbar"
        >
          {/* Header */}
          <div className="relative pb-2.5 mb-3.5 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-800 mx-auto">Lọc</span>
            <PopoverClose asChild>
              <button 
                type="button" 
                className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </PopoverClose>
          </div>

          <div className="space-y-4">
            {/* 1. Card Status Section */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-800 pl-0.5">
                Trạng thái thẻ
              </p>
              
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={completedEnabled}
                  onChange={() => toggleCompleted(boardId)}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <span className="text-sm text-neutral-700 font-normal">
                  Đã đánh dấu hoàn thành
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={notCompletedEnabled}
                  onChange={() => toggleNotCompleted(boardId)}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <span className="text-sm text-neutral-700 font-normal">
                  Chưa hoàn thành
                </span>
              </label>
            </div>

            {/* 2. Ngày hết hạn Section */}
            <div className="space-y-2 pt-3.5 border-t border-neutral-100">
              <p className="text-sm font-semibold text-neutral-800 pl-0.5">
                Ngày hết hạn
              </p>

              {/* Không có ngày hết hạn */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={selectedDueDateFilters.includes("no-due")}
                  onChange={() => toggleDueDateFilter(boardId, "no-due")}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Không có ngày hết hạn
                </span>
              </label>

              {/* Quá hạn */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={selectedDueDateFilters.includes("overdue")}
                  onChange={() => toggleDueDateFilter(boardId, "overdue")}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-rose-600 font-normal">
                  Đã quá hạn
                </span>
              </label>

              {/* Hết hạn vào ngày mai */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={selectedDueDateFilters.includes("due-tomorrow")}
                  onChange={() => toggleDueDateFilter(boardId, "due-tomorrow")}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-amber-600 font-normal">
                  Hạn vào ngày mai
                </span>
              </label>

              {/* Hết hạn trong tuần tới */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={selectedDueDateFilters.includes("due-next-week")}
                  onChange={() => toggleDueDateFilter(boardId, "due-next-week")}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Hạn vào tuần tới
                </span>
              </label>
            </div>

            {/* 3. Nhãn Section */}
            <div className="space-y-2 pt-3.5 border-t border-neutral-100">
              <p className="text-sm font-semibold text-neutral-800 pl-0.5">
                Nhãn
              </p>

              {/* Không có nhãn */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={noLabelsEnabled}
                  onChange={() => toggleNoLabels(boardId)}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <Tag className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Không có nhãn
                </span>
              </label>

              {/* Chọn nhãn collapsible */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setLabelsExpanded(!labelsExpanded)}
                  className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-50 transition text-left cursor-pointer select-none"
                >
                  <div className="flex items-center gap-x-2.5">
                    <input
                      type="checkbox"
                      checked={selectedLabelIds.length > 0}
                      readOnly
                      className="h-4 w-4 rounded border-neutral-300 accent-violet-600 pointer-events-none"
                    />
                    <span className="text-sm text-neutral-700 font-normal">
                      Chọn nhãn
                    </span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform", labelsExpanded && "rotate-180")} />
                </button>

                {labelsExpanded && (
                  <div className="pl-7 space-y-1 mt-1 max-h-40 overflow-y-auto pr-1 styled-scrollbar">
                    {labels.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic py-1 pl-2">Bảng chưa có nhãn</p>
                    ) : (
                      labels.map((label) => {
                        const checked = selectedLabelIds.includes(label.id);
                        return (
                          <label
                            key={label.id}
                            className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1 transition hover:bg-neutral-50 select-none"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLabel(boardId, label.id)}
                              className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                            />
                            <div
                              className="h-5 flex-1 rounded px-2 py-0.5 text-xs text-white font-medium truncate flex items-center shadow-xs"
                              style={{ backgroundColor: label.color }}
                            >
                              {label.title || "Không có tiêu đề"}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <div className="pt-2 border-t border-neutral-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => clearFilters(boardId)}
                  className="w-full text-xs text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 h-8"
                >
                  Xóa tất cả bộ lọc
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
