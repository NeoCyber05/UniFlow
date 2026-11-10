"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getIntlLocale, tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getMonthGridRange, getGmt7DayKey, getGmt7Parts, formatGmt7Time } from "../_lib/date-utils";
import { getWeekDays } from "../_lib/constants";
import { getOccurrenceTone } from "../_lib/item-utils";
import type { CalendarOccurrence } from "../_types";

type Props = {
  anchorDate: Date;
  today: string;
  occurrencesByDay: Record<string, CalendarOccurrence[]>;
  onSelect: (date: Date) => void;
  onOpen: (cardId: string) => void;
};

export function CalendarSidebar({ anchorDate, today, occurrencesByDay, onSelect, onOpen }: Props) {
  const selected = getGmt7DayKey(anchorDate);
  const parts = getGmt7Parts(anchorDate);
  const monthTitle = new Intl.DateTimeFormat(getIntlLocale(), { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(anchorDate);
  const selectedTitle = new Intl.DateTimeFormat(getIntlLocale(), { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(anchorDate);
  const rows = occurrencesByDay[selected] ?? [];
  const shiftMonth = (step: number) => onSelect(new Date(Date.UTC(parts.year, parts.month + step, 1, 5)));

  return (
    <aside className="hidden w-[240px] shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-5 xl:block">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold capitalize text-neutral-900">{monthTitle}</h2>
        <div className="flex">
          <button type="button" aria-label={tr("calendar.toolbar.prevMonth")} onClick={() => shiftMonth(-1)} className="rounded-md p-1.5 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-500"><ChevronLeft className="size-4" /></button>
          <button type="button" aria-label={tr("calendar.toolbar.nextMonth")} onClick={() => shiftMonth(1)} className="rounded-md p-1.5 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-500"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {getWeekDays().map((day) => <span key={day} className="pb-2 text-center text-xs font-medium text-neutral-500">{day}</span>)}
        {getMonthGridRange(anchorDate).days.map((day) => {
          const key = getGmt7DayKey(day);
          const active = key === selected;
          const hasItems = !!occurrencesByDay[key]?.length;
          return <button key={key} type="button" onClick={() => onSelect(day)} aria-label={key} aria-pressed={active} aria-current={key === today ? "date" : undefined} className={cn("relative flex h-9 items-center justify-center rounded-lg text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-neutral-500", active ? "bg-neutral-900 font-semibold text-white" : "bg-neutral-50 hover:bg-neutral-200", !active && getGmt7Parts(day).month !== parts.month && "text-neutral-400", key === today && !active && "ring-1 ring-inset ring-neutral-400")}>
            {getGmt7Parts(day).date}
            {hasItems && <span className="absolute bottom-1 size-0.5 rounded-full bg-current" />}
          </button>;
        })}
      </div>
      <div className="mt-6 border-t border-neutral-200 pt-5">
        <h2 className="mb-4 text-sm font-semibold capitalize text-neutral-900">{selectedTitle}</h2>
        <div className="space-y-2">
          {rows.map((row) => <button type="button" key={row.id} onClick={() => onOpen(row.item.cardId)} className={cn("block w-full rounded-lg border p-3 text-left focus-visible:ring-2 focus-visible:ring-neutral-500", getOccurrenceTone(row))}>
            <span className={cn("block text-sm font-medium", row.item.isCompleted && "line-through")}>{row.item.title}</span>
            <span className="mt-1 block text-xs opacity-75">{row.item.type === "card" && row.item.displayKind === "deadline" ? tr("calendar.occurrence.deadline") : tr("calendar.occurrence.work")} · {row.item.type === "card" && row.item.scheduledOn ? tr("calendar.occurrence.schedule") : formatGmt7Time(row.date)}</span>
          </button>)}
          {rows.length === 0 && <p className="text-xs leading-5 text-neutral-500">{tr("calendar.empty.day")}</p>}
        </div>
      </div>
    </aside>
  );
}
