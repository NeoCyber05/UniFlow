"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import type { BoardCalendarItem } from "@/types";
import { cn } from "@/lib/utils";
import { getDayViewBlocks, getOverlappingDayBlockLayout, getDayViewBlockTone } from "../_lib/day-view-layout";
import { formatGmt7Time, getGmt7DayKey } from "../_lib/date-utils";

import type { CalendarWeekRow } from "./board-calendar/calendar-week-row";

type RowProps = ComponentProps<typeof CalendarWeekRow>;
type Props = {
  interactions: Pick<RowProps, "onDayDrop" | "onDayDragOver" | "onOccurrenceDragStart" | "onOccurrenceDragEnd" | "occurrencesByDay" | "rangeOccurrencesByDay">;
  days: Date[];
  items: BoardCalendarItem[];
  onOpen: (cardId: string) => void;
};

export function CalendarWeekTimeline({ days, items, onOpen, interactions }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * 64;
  }, []);

  return (
    <div ref={scrollRef} className="max-h-[65vh] overflow-auto border-x border-b border-neutral-200">
      <div className="relative grid min-w-[700px]" style={{ height: 24 * 64, gridTemplateColumns: "var(--cal-cols, repeat(7, minmax(0, 1fr)))" }}>
        {days.map((day, index) => {
          const layout = getOverlappingDayBlockLayout(getDayViewBlocks(items, day), Number.MAX_SAFE_INTEGER);
          return <div onDragOver={(event) => interactions.onDayDragOver(event, getGmt7DayKey(day))} onDrop={(event) => interactions.onDayDrop(event, day)} key={getGmt7DayKey(day)} className={cn("relative border-r border-neutral-200 last:border-r-0", index >= 5 && "bg-neutral-50/60")}>
            {Array.from({ length: 24 }, (_, hour) => <div key={hour} className="absolute w-full border-t border-neutral-200" style={{ top: hour * 64 }}>
              <span className="ml-1 bg-white/80 text-[10px] tabular-nums text-neutral-400">{String(hour).padStart(2, "0")}:00</span>
            </div>)}
            {layout.visibleBlocks.map((block) => {
              const occurrence = [...(interactions.occurrencesByDay[getGmt7DayKey(day)] ?? []), ...(interactions.rangeOccurrencesByDay[getGmt7DayKey(day)] ?? [])].find((entry) => entry.item.id === block.item.id);
              return <div draggable={!!occurrence} onDragStart={(event) => { if (occurrence) interactions.onOccurrenceDragStart(event, occurrence); }} onDragEnd={interactions.onOccurrenceDragEnd} key={block.id} role="button" tabIndex={0} onClick={() => onOpen(block.item.cardId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(block.item.cardId); } }} title={`${block.item.title} · ${formatGmt7Time(block.startsAt)} – ${formatGmt7Time(block.endsAt)}`} className={cn("absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-neutral-600", getDayViewBlockTone(block))} style={{ top: block.startMinute / 60 * 64, height: Math.max(24, (block.endMinute - block.startMinute) / 60 * 64 - 2), left: `calc(${block.leftPercent}% + 3px)`, width: `calc(${block.widthPercent}% - 6px)` }}>
              <span className="block truncate text-[10px] tabular-nums opacity-75">{formatGmt7Time(block.startsAt)} – {formatGmt7Time(block.endsAt)}</span>
              <span className={cn("block text-xs font-medium", block.item.isCompleted && "line-through")}>{block.item.title}</span>
            </div>;
            })}
          </div>;
        })}
      </div>
    </div>
  );
}
