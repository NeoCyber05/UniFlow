"use client";

import { tr } from "@/lib/i18n";

interface ChecklistProgressProps {
  completedCount: number;
  totalCount: number;
  compact?: boolean;
}

export const ChecklistProgress = ({
  completedCount,
  totalCount,
  compact = false,
}: ChecklistProgressProps) => {
  const percentage = totalCount > 0
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  return (
    <div className={`flex w-full items-center gap-3 ${compact ? "" : "pl-[52px]"}`}>
      <span className="text-xs text-neutral-500 font-semibold w-8 shrink-0">
        {percentage}%
      </span>
      <div role="progressbar" aria-label={tr("checklist.progressAria")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          style={{ transform: `scaleX(${percentage / 100})` }}
          className="h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
        />
      </div>
    </div>
  );
};
