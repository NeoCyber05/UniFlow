import { taskDatesToForm } from "@/lib/cards/task-dates-form";
import type { CardWithList } from "@/types";

const day = (value: string) => {
  const [, month, date] = value.split("-");

  return `${Number(date)}/${Number(month)}`;
};

/** Các dòng ngày hiển thị tách bạch: hạn nộp, lịch làm, mốc bắt đầu cũ (legacy). */
export const getDateLines = (data: CardWithList) => {
  const form = taskDatesToForm(data);
  const lines: string[] = [];

  if (form.deadlineDate) {
    lines.push(`Hạn nộp ${form.deadlineTime ? `${form.deadlineTime} ` : ""}${day(form.deadlineDate)}`);
  }

  if (form.scheduleStartDate) {
    if (form.scheduleStartTime) {
      const endsOtherDay = form.scheduleEndDate && form.scheduleEndDate !== form.scheduleStartDate;

      lines.push(`Lịch làm ${form.scheduleStartTime}–${form.scheduleEndTime}${endsOtherDay ? ` (${day(form.scheduleEndDate)})` : ""} ${day(form.scheduleStartDate)}`);
    } else {
      lines.push(`Lịch làm ${day(form.scheduleStartDate)}`);
    }
  }

  if (data.startDate) {
    // Tái dùng bộ đổi VN-time: coi startDate như một mốc có giờ.
    const legacy = taskDatesToForm({ ...data, dueDate: data.startDate, deadlineOn: null });

    lines.push(`Mốc bắt đầu cũ ${legacy.deadlineTime} ${day(legacy.deadlineDate)}${form.scheduleStartDate ? "" : " — chưa xếp lịch làm"}`);
  }

  return lines;
};

export const humanizeReminderMinutes = (mins: number) => {
  if (mins >= 1440) return `${Math.floor(mins / 1440)} ngày`;
  if (mins >= 60) return `${Math.floor(mins / 60)} giờ`;
  return `${mins} phút`;
};
