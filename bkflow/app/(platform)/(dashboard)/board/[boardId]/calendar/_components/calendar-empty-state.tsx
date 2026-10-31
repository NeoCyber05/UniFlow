"use client";

import { CalendarDays } from "lucide-react";

import { tr } from "@/lib/i18n";

import type { ViewMode } from "../_types";

type CalendarEmptyStateProps = {
  viewMode: ViewMode;
  filtersAreActive: boolean;
};

export const CalendarEmptyState = ({
  viewMode,
  filtersAreActive,
}: CalendarEmptyStateProps) => {
  if (viewMode === "day") {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-neutral-700">
          {filtersAreActive
            ? tr("calendar.empty.filtered")
            : tr("calendar.empty.day")}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 text-center">
      <CalendarDays className="mb-2 h-6 w-6 text-neutral-400" />
      <p className="text-sm font-semibold text-neutral-700">
        {filtersAreActive
          ? tr("calendar.empty.filtered")
          : tr("calendar.empty.range")}
      </p>
      {!filtersAreActive && (
        <p className="mt-1 max-w-md text-xs text-neutral-500">
          {tr("calendar.empty.rangeHint")}
        </p>
      )}
    </div>
  );
};
