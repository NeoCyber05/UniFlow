"use client";

import { useState } from "react";
import { X } from "lucide-react";

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
import type { CardWithList } from "@/types";

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

const inputClass = "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200";
const labelClass = "text-[11px] font-bold text-neutral-500 uppercase";

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
  const set = (key: keyof TaskDatesForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
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
      <PopoverContent align="start" className="w-[320px] p-3 rounded-xl border border-neutral-200 shadow-xl bg-white z-[9999]" sideOffset={6}>
        <div className="relative pb-2.5 mb-3 border-b border-neutral-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700 mx-auto">Hạn nộp và lịch làm</span>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            aria-label="Đóng"
            className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className={labelClass}>Hạn nộp</legend>
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Ngày hạn nộp" type="date" value={form.deadlineDate} onChange={set("deadlineDate")} disabled={isLoadingUpdate} className={inputClass} />
              <input aria-label="Giờ hạn nộp (để trống nếu chỉ có ngày)" type="time" value={form.deadlineTime} onChange={set("deadlineTime")} disabled={isLoadingUpdate || !form.deadlineDate} className={inputClass} />
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className={labelClass}>Lịch làm</legend>
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Ngày bắt đầu làm" type="date" value={form.scheduleStartDate} onChange={set("scheduleStartDate")} disabled={isLoadingUpdate} className={inputClass} />
              <input aria-label="Giờ bắt đầu làm" type="time" value={form.scheduleStartTime} onChange={set("scheduleStartTime")} disabled={isLoadingUpdate || !hasSchedule} className={inputClass} />
              <input aria-label="Ngày kết thúc làm (để trống nếu cùng ngày)" type="date" value={form.scheduleEndDate} onChange={set("scheduleEndDate")} disabled={isLoadingUpdate || !hasSchedule} className={inputClass} />
              <input aria-label="Giờ kết thúc làm" type="time" value={form.scheduleEndTime} onChange={set("scheduleEndTime")} disabled={isLoadingUpdate || !hasSchedule} className={inputClass} />
            </div>
            <p className="text-[11px] text-neutral-400">Chỉ chọn ngày nếu chưa biết giờ. Đổi lịch làm không đổi hạn nộp.</p>
          </fieldset>

          <div className="flex flex-col gap-y-1">
            <span className={labelClass}>Thiết lập nhắc nhở</span>
            <select
              aria-label="Thiết lập nhắc nhở"
              value={form.reminder}
              onChange={set("reminder")}
              disabled={isLoadingUpdate || !form.deadlineDate}
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 cursor-pointer"
            >
              <option value="none">Không có</option>
              <option value="0">Vào thời điểm hết hạn</option>
              <option value="5">5 phút trước</option>
              <option value="10">10 phút trước</option>
              <option value="15">15 phút trước</option>
              <option value="30">30 phút trước</option>
              <option value="60">1 giờ trước</option>
              <option value="120">2 giờ trước</option>
              <option value="1440">1 ngày trước</option>
              <option value="2880">2 ngày trước</option>
              <option value="10080">1 tuần trước</option>
              <option value="20160">2 tuần trước</option>
            </select>
            {form.deadlineDate && !form.deadlineTime && (
              <p className="text-[11px] text-neutral-400">Hạn chỉ có ngày: nhắc tính từ 09:00 ngày hạn.</p>
            )}
            <DesktopReminderControl />
          </div>

          {"error" in preview && (
            <p role="alert" className="text-xs text-red-600">{preview.error}</p>
          )}
          {"warning" in preview && preview.warning && (
            <p role="status" className="text-xs text-amber-600">{preview.warning}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={isLoadingUpdate || "error" in preview}
              className="h-8 rounded-lg bg-violet-600 px-4 text-xs text-white hover:bg-violet-700"
            >
              Lưu
            </Button>
            {Boolean(data.scheduledOn || data.scheduledStartAt) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isLoadingUpdate}
                onClick={onClearSchedule}
                className="h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 text-xs px-3"
              >
                Bỏ lịch làm (giữ hạn)
              </Button>
            )}
            {data.startDate && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isLoadingUpdate}
                onClick={onClearLegacyStart}
                className="h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 text-xs px-3"
              >
                Xóa mốc bắt đầu cũ
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};
