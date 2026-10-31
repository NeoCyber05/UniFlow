"use client";

import { useState } from "react";
import { Bell, CalendarClock, Flag, X, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DesktopReminderControl } from "@/components/notifications/desktop-reminder-control";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  buildTaskDatesPatch,
  taskDatesToForm,
  type TaskDatesForm,
  type TaskDatesPatch,
} from "@/lib/cards/task-dates-form";
import { tr } from "@/lib/i18n";
import type { CardMessageKey } from "@/lib/i18n/messages/vi-card";
import { addVNDays, getVNDay, getVNDayKey } from "@/lib/my-tasks/vn-day";
import { cn } from "@/lib/utils";
import { getDefaultReminder } from "@/web/lib/local-prefs";
import type { CardWithList } from "@/types";

import { translateTaskDateMessage } from "./metadata-utils";

interface CardDatePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  data: CardWithList;
  isLoadingUpdate: boolean;
  onSave: (patch: TaskDatesPatch) => void;
  onClearSchedule: () => void;
  onClearLegacyStart: () => void;
}

const inputClass = "h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-300";
const chipClass = "h-6 cursor-pointer rounded-full border border-neutral-200 bg-white px-2.5 text-[11px] font-medium text-neutral-600 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50";
const ghostButtonClass = "h-8 rounded-lg px-3 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700";
const dayKeyFromToday = (offset: number) => getVNDayKey(addVNDays(getVNDay(new Date()), offset));
const DAY_CHIPS: ReadonlyArray<readonly [CardMessageKey, number]> = [
  ["cardMeta.today", 0],
  ["cardMeta.tomorrow", 1],
  ["cardMeta.nextWeek", 7],
];
const TIME_CHIPS = ["09:00", "12:00", "23:59"] as const;

const Section = ({ icon: Icon, title, tone, action, children }: {
  icon: LucideIcon;
  title: string;
  tone: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <fieldset className="space-y-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-3">
    <div className="flex items-center justify-between">
      <legend className="float-left flex items-center gap-2 text-xs font-semibold text-neutral-700">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", tone)}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        {title}
      </legend>
      {action}
    </div>
    <div className="clear-both space-y-2.5">{children}</div>
  </fieldset>
);

export const CardDatePopover = ({
  open,
  onOpenChange,
  trigger,
  data,
  isLoadingUpdate,
  onSave,
  onClearSchedule,
  onClearLegacyStart,
}: CardDatePopoverProps) => {
  const [form, setForm] = useState<TaskDatesForm>(() => taskDatesToForm(data));
  const patchForm = (patch: Partial<TaskDatesForm>) => setForm((current) => {
    const next = { ...current, ...patch };
    // Thẻ vừa có hạn nộp và chưa chọn nhắc: dùng mức nhắc mặc định trong Cài đặt > Thông báo.
    if (!current.deadlineDate && next.deadlineDate && next.reminder === "none") next.reminder = getDefaultReminder();
    return next;
  });
  const set = (key: keyof TaskDatesForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    patchForm({ [key]: event.target.value });
  const preview = buildTaskDatesPatch(form);
  const hasSchedule = Boolean(form.scheduleStartDate);

  const handleOpenChange = (next: boolean) => {
    // Mở lại luôn nạp giá trị đã lưu; khi lưu lỗi popover chưa đóng nên nháp được giữ.
    if (next) setForm(taskDatesToForm(data));
    onOpenChange(next);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ("patch" in preview) onSave(preview.patch);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[9999] w-[360px] gap-0 rounded-2xl border border-neutral-200 bg-white p-0 shadow-xl" sideOffset={6}>
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-neutral-800">{tr("cardMeta.datePopoverTitle")}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">{tr("cardMeta.datePopoverDesc")}</p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            aria-label={tr("cardModal.close")}
            className="cursor-pointer rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          <Section
            icon={Flag}
            title={tr("cardMeta.deadlineSection")}
            tone="bg-rose-100 text-rose-600"
            action={form.deadlineDate && (
              <button
                type="button"
                onClick={() => patchForm({ deadlineDate: "", deadlineTime: "", reminder: "none" })}
                className="cursor-pointer text-[11px] text-neutral-400 transition-colors hover:text-rose-600"
              >
                {tr("cardMeta.removeDeadline")}
              </button>
            )}
          >
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <input aria-label={tr("cardMeta.deadlineDateAria")} type="date" value={form.deadlineDate} onChange={set("deadlineDate")} disabled={isLoadingUpdate} className={inputClass} />
              <input aria-label={tr("cardMeta.deadlineTimeAria")} type="time" value={form.deadlineTime} onChange={set("deadlineTime")} disabled={isLoadingUpdate || !form.deadlineDate} className={inputClass} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DAY_CHIPS.map(([labelKey, offset]) => (
                <button key={labelKey} type="button" disabled={isLoadingUpdate} onClick={() => patchForm({ deadlineDate: dayKeyFromToday(offset) })} className={chipClass}>{tr(labelKey)}</button>
              ))}
              <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-neutral-200" />
              {TIME_CHIPS.map((time) => (
                <button key={time} type="button" disabled={isLoadingUpdate || !form.deadlineDate} onClick={() => patchForm({ deadlineTime: time })} className={cn(chipClass, "tabular-nums")}>{time}</button>
              ))}
            </div>
          </Section>

          <Section icon={CalendarClock} title={tr("cardMeta.scheduleSection")} tone="bg-violet-100 text-violet-600">
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <input aria-label={tr("cardMeta.scheduleStartDateAria")} type="date" value={form.scheduleStartDate} onChange={set("scheduleStartDate")} disabled={isLoadingUpdate} className={inputClass} />
              <input aria-label={tr("cardMeta.scheduleStartTimeAria")} type="time" value={form.scheduleStartTime} onChange={set("scheduleStartTime")} disabled={isLoadingUpdate || !hasSchedule} className={inputClass} />
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <input aria-label={tr("cardMeta.scheduleEndDateAria")} type="date" value={form.scheduleEndDate} onChange={set("scheduleEndDate")} disabled={isLoadingUpdate || !hasSchedule} className={inputClass} />
              <input aria-label={tr("cardMeta.scheduleEndTimeAria")} type="time" value={form.scheduleEndTime} onChange={set("scheduleEndTime")} disabled={isLoadingUpdate || !hasSchedule} className={inputClass} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DAY_CHIPS.slice(0, 2).map(([labelKey, offset]) => (
                <button key={labelKey} type="button" disabled={isLoadingUpdate} onClick={() => patchForm({ scheduleStartDate: dayKeyFromToday(offset) })} className={chipClass}>{tr(labelKey)}</button>
              ))}
              <p className="ml-auto text-[11px] text-neutral-400">{tr("cardMeta.scheduleTimeHint")}</p>
            </div>
          </Section>

          <Section icon={Bell} title={tr("cardMeta.reminderSection")} tone="bg-amber-100 text-amber-600">
            <select
              aria-label={tr("cardMeta.reminderAria")}
              value={form.reminder}
              onChange={set("reminder")}
              disabled={isLoadingUpdate || !form.deadlineDate}
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="none">{tr("cardMeta.reminderNone")}</option>
              <option value="0">{tr("cardMeta.reminderAtDue")}</option>
              <option value="5">{tr("cardMeta.reminder5m")}</option>
              <option value="10">{tr("cardMeta.reminder10m")}</option>
              <option value="15">{tr("cardMeta.reminder15m")}</option>
              <option value="30">{tr("cardMeta.reminder30m")}</option>
              <option value="60">{tr("cardMeta.reminder1h")}</option>
              <option value="120">{tr("cardMeta.reminder2h")}</option>
              <option value="1440">{tr("cardMeta.reminder1d")}</option>
              <option value="2880">{tr("cardMeta.reminder2d")}</option>
              <option value="10080">{tr("cardMeta.reminder1w")}</option>
              <option value="20160">{tr("cardMeta.reminder2w")}</option>
            </select>
            {!form.deadlineDate && <p className="text-[11px] text-neutral-400">{tr("cardMeta.reminderNeedDeadlineHint")}</p>}
            {form.deadlineDate && !form.deadlineTime && (
              <p className="text-[11px] text-neutral-400">{tr("cardMeta.reminderDateOnlyHint")}</p>
            )}
            <DesktopReminderControl />
          </Section>

          {"error" in preview && (
            <p role="alert" className="text-xs text-red-600">{translateTaskDateMessage(preview.error)}</p>
          )}
          {"warning" in preview && preview.warning && (
            <p role="status" className="text-xs text-amber-600">{translateTaskDateMessage(preview.warning)}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
            <Button
              type="submit"
              size="sm"
              disabled={isLoadingUpdate || "error" in preview}
              className="h-8 rounded-lg bg-violet-600 px-5 text-xs text-white hover:bg-violet-700"
            >
              {tr("cardMeta.save")}
            </Button>
            {Boolean(data.scheduledOn || data.scheduledStartAt) && (
              <Button type="button" size="sm" variant="ghost" disabled={isLoadingUpdate} onClick={onClearSchedule} className={ghostButtonClass}>
                {tr("cardMeta.clearScheduleKeepDeadline")}
              </Button>
            )}
            {data.startDate && (
              <Button type="button" size="sm" variant="ghost" disabled={isLoadingUpdate} onClick={onClearLegacyStart} className={ghostButtonClass}>
                {tr("cardMeta.clearLegacyStart")}
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};
