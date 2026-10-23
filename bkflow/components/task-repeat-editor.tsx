"use client";

import { useState } from "react";
import { Briefcase, CalendarDays, CalendarHeart, CalendarRange, Check, Sun, X } from "lucide-react";
import { PopoverClose } from "@/components/ui/popover";
import type { RepeatUnit, TaskRepeat } from "@/lib/cards/task-repeat";
import { cn } from "@/lib/utils";

const presets = [
  { label: "Hằng ngày", icon: Sun, unit: "day" },
  { label: "Ngày trong tuần (T2–T6)", icon: Briefcase, unit: "weekday" },
  { label: "Hằng tuần", icon: CalendarDays, unit: "week" },
  { label: "Hằng tháng", icon: CalendarRange, unit: "month" },
  { label: "Hằng năm", icon: CalendarHeart, unit: "year" },
] as const;
const units = [["day", "ngày"], ["week", "tuần"], ["month", "tháng"], ["year", "năm"]] as const;
const fieldClass = "h-8 min-w-0 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TaskRepeatEditor({ value, onChange, disabled = false }: {
  value: TaskRepeat | null;
  onChange: (value: TaskRepeat | null) => void;
  disabled?: boolean;
}) {
  const [every, setEvery] = useState(value?.every ?? 2);
  const [unit, setUnit] = useState<Exclude<RepeatUnit, "weekday">>(value && value.unit !== "weekday" ? value.unit : "day");
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2 disabled:opacity-60">
      <legend className="sr-only">Lặp lại công việc</legend>
      <div className="space-y-0.5">
        {presets.map(({ label, icon: Icon, unit }) => {
          const selected = value?.unit === unit && value.every === 1;
          return (
            <PopoverClose asChild key={unit}>
              <button type="button" aria-pressed={selected} onClick={() => onChange({ unit, every: 1 })} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring", selected && "bg-primary/10 text-primary")}>
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {selected && <Check className="size-3.5" aria-hidden="true" />}
              </button>
            </PopoverClose>
          );
        })}
      </div>
      <div className="space-y-2 border-t border-border pt-2">
        <p className="px-1 text-xs font-semibold">Tùy chỉnh</p>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">Mỗi</span>
          <input type="number" min={1} max={99} aria-label="Số lần lặp" value={every} onChange={event => setEvery(Number(event.target.value))} className={cn(fieldClass, "w-14")} />
          <select aria-label="Đơn vị lặp" value={unit} onChange={event => setUnit(event.target.value as typeof unit)} className={cn(fieldClass, "flex-1")}>
            {units.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <PopoverClose asChild>
            <button type="button" onClick={() => onChange({ unit, every: Math.min(99, Math.max(1, Math.round(every) || 1)) })} className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Lưu</button>
          </PopoverClose>
        </div>
      </div>
      {value && <PopoverClose asChild><button type="button" onClick={() => onChange(null)} className="flex w-full items-center gap-2 border-t border-border px-2 pt-2 text-xs text-muted-foreground hover:text-foreground"><X className="size-3.5" />Không lặp lại</button></PopoverClose>}
    </fieldset>
  );
}
