"use client";

import { format } from "date-fns";
import { tr } from "@/lib/i18n";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Hint } from "@/components/hint";
import { isOverdue } from "@/lib/date-utils";

interface DueDateBadgeProps {
  dueDate?: Date | string | null;
  startDate?: Date | string | null;
  isCompleted?: boolean;
  className?: string;
  isCard?: boolean;
}

export const getDueDateStatus = (
  dueDate: Date | string,
  isCompleted = false,
) => {
  if (isCompleted) {
    return "completed";
  }

  const date = new Date(dueDate);
  const now = new Date();
  const dayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (isOverdue(date, now)) {
    return "overdue";
  }

  if (date <= dayFromNow) {
    return "warning";
  }

  return "normal";
};

export const DueDateBadge = ({
  dueDate,
  startDate,
  isCompleted = false,
  className,
  isCard = false,
}: DueDateBadgeProps) => {
  if (!startDate && !dueDate) {
    return null;
  }

  const hasStart = !!startDate;
  const hasDue = !!dueDate;

  const status = isCompleted
    ? "completed"
    : (hasDue ? getDueDateStatus(dueDate, isCompleted) : "normal");

  let tooltipText = "";
  if (isCompleted) {
    tooltipText = tr("dueBadge.done");
  } else if (hasDue) {
    if (status === "overdue") {
      tooltipText = tr("dueBadge.overdue");
    } else if (status === "warning") {
      tooltipText = tr("dueBadge.soon");
    } else {
      tooltipText = tr("dueBadge.onTime");
    }
  } else {
    tooltipText = tr("dueBadge.started");
  }

  const formatDateValue = (d: Date | string) => {
    const dateObj = new Date(d);
    const isCurrentYear = dateObj.getFullYear() === new Date().getFullYear();
    const formatStr = isCard
      ? (isCurrentYear ? "dd/MM HH:mm" : "dd/MM/yy HH:mm")
      : "dd/MM/yyyy HH:mm";
    return format(dateObj, formatStr);
  };

  let displayString = "";
  if (hasStart && !hasDue) {
    displayString = tr("dueBadge.startsOn", { date: formatDateValue(startDate) });
  } else if (hasStart && hasDue) {
    displayString = `${formatDateValue(startDate)} - ${formatDateValue(dueDate)}`;
  } else if (hasDue) {
    displayString = formatDateValue(dueDate);
  }

  return (
    <Hint description={tooltipText} side="bottom">
      <span
        className={cn(
          "task-badge h-7 max-w-full !cursor-pointer",
          isCard ? "px-2 gap-x-1" : "px-2.5 gap-x-1.5",
          status === "normal" && "task-badge-neutral",
          status === "warning" && "task-badge-warning",
          status === "overdue" && "task-badge-danger",
          status === "completed" && "task-badge-success",
          className,
        )}
      >
        <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{displayString}</span>
      </span>
    </Hint>
  );
};
