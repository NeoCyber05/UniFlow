"use client";

import type { MouseEvent } from "react";
import {
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  Circle,
  ExternalLink,
  MoreHorizontal,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { tr } from "@/lib/i18n";
import type { BoardCalendarItem } from "@/types";

import { isCalendarCardItem } from "../../_lib/item-utils";
import type { CalendarOccurrence } from "../../_types";

type QuickActionsMenuProps = {
  occurrence: CalendarOccurrence;
  isUpdatingCardDate: boolean;
  canPlanSchedule: (occurrence: CalendarOccurrence) => boolean;
  canClearSchedule: (occurrence: CalendarOccurrence) => boolean;
  onQuickActionClick: (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => void;
  onOpenCardDirect: (
    cardId: string,
    options?: { checklistItemId?: string },
  ) => void;
  onToggleComplete: (occurrence: CalendarOccurrence) => void;
  onPlanSchedule: (occurrence: CalendarOccurrence) => void;
  onClearSchedule: (occurrence: CalendarOccurrence) => void;
};

export const QuickActionsMenu = ({
  occurrence,
  isUpdatingCardDate,
  canPlanSchedule,
  canClearSchedule,
  onQuickActionClick,
  onOpenCardDirect,
  onToggleComplete,
  onPlanSchedule,
  onClearSchedule,
}: QuickActionsMenuProps) => {
  const isCardItem = isCalendarCardItem(occurrence.item);

  if (!isCardItem) {
    const checklistItem = occurrence.item as Extract<
      BoardCalendarItem,
      { type: "checklist-item" }
    >;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onDragStart={(event) => event.preventDefault()}
            aria-label={tr("calendar.quickActions.checklistAria", { title: occurrence.item.title })}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 opacity-100 transition hover:bg-white/70 hover:text-neutral-900 focus-visible:bg-white/70 focus-visible:text-neutral-900 sm:opacity-0 sm:group-hover/event:opacity-100 sm:group-focus-within/event:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-56 gap-1 p-1.5"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={(event) => onQuickActionClick(event, () => onOpenCardDirect(checklistItem.cardId, {
              checklistItemId: checklistItem.checklistItemId,
            }))}
            className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
            {tr("calendar.action.openCard")}
          </button>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onDragStart={(event) => event.preventDefault()}
          disabled={isUpdatingCardDate}
          aria-label={tr("calendar.quickActions.cardAria", { title: occurrence.item.title })}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 opacity-100 transition hover:bg-white/70 hover:text-neutral-900 focus-visible:bg-white/70 focus-visible:text-neutral-900 disabled:cursor-wait disabled:opacity-40 sm:opacity-0 sm:group-hover/event:opacity-100 sm:group-focus-within/event:opacity-100"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-56 gap-1 p-1.5"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          disabled={isUpdatingCardDate}
          onClick={(event) => onQuickActionClick(event, () => onOpenCardDirect(occurrence.item.cardId))}
          className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
        >
          <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
          {tr("calendar.action.openCard")}
        </button>
        <button
          type="button"
          disabled={isUpdatingCardDate}
          onClick={(event) => onQuickActionClick(event, () => onToggleComplete(occurrence))}
          className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
        >
          {occurrence.item.isCompleted ? (
            <Circle className="h-3.5 w-3.5 text-neutral-500" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          )}
          {occurrence.item.isCompleted ? tr("calendar.action.markIncomplete") : tr("calendar.action.markComplete")}
        </button>
        {isCardItem && canPlanSchedule(occurrence) && (
          <button
            type="button"
            disabled={isUpdatingCardDate}
            onClick={(event) => onQuickActionClick(event, () => onPlanSchedule(occurrence))}
            className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-sky-600" />
            {tr("calendar.action.schedule")}
          </button>
        )}
        {isCardItem && canClearSchedule(occurrence) && (
          <button
            type="button"
            disabled={isUpdatingCardDate}
            onClick={(event) => onQuickActionClick(event, () => onClearSchedule(occurrence))}
            className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
          >
            <CalendarX2 className="h-3.5 w-3.5 text-violet-600" />
            {tr("calendar.action.clearSchedule")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};
