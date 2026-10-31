import { taskDatesToForm } from "@/lib/cards/task-dates-form";
import { intlDateFormat, tr } from "@/lib/i18n";
import type { CardMessageKey } from "@/lib/i18n/messages/vi-card";
import type { CardWithList } from "@/types";

export const formatDayMonth = (value: string) =>
  intlDateFormat({ day: "numeric", month: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );

export const formatFullDay = (value: string) =>
  intlDateFormat({ year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );

/** Các dòng ngày hiển thị tách bạch: hạn nộp, lịch làm, mốc bắt đầu cũ (legacy). */
export const getDateLines = (
  data: CardWithList,
  options?: { includeDeadline?: boolean },
) => {
  const includeDeadline = options?.includeDeadline ?? true;
  const form = taskDatesToForm(data);
  const lines: string[] = [];

  if (includeDeadline && form.deadlineDate) {
    lines.push(
      tr("cardMeta.lineDeadline", {
        value: `${form.deadlineTime ? `${form.deadlineTime} ` : ""}${formatDayMonth(form.deadlineDate)}`,
      }),
    );
  }

  if (form.scheduleStartDate) {
    if (form.scheduleStartTime) {
      const endsOtherDay = form.scheduleEndDate && form.scheduleEndDate !== form.scheduleStartDate;

      lines.push(
        tr("cardMeta.lineSchedule", {
          value: `${form.scheduleStartTime}–${form.scheduleEndTime}${endsOtherDay ? ` (${formatDayMonth(form.scheduleEndDate)})` : ""} ${formatDayMonth(form.scheduleStartDate)}`,
        }),
      );
    } else {
      lines.push(
        tr("cardMeta.lineSchedule", {
          value: formatDayMonth(form.scheduleStartDate),
        }),
      );
    }
  }

  if (data.startDate) {
    // Tái dùng bộ đổi VN-time: coi startDate như một mốc có giờ.
    const legacy = taskDatesToForm({ ...data, dueDate: data.startDate, deadlineOn: null });

    lines.push(
      tr("cardMeta.lineLegacyStart", {
        value: `${legacy.deadlineTime} ${formatDayMonth(legacy.deadlineDate)}${form.scheduleStartDate ? "" : tr("cardMeta.lineLegacyUnscheduledSuffix")}`,
      }),
    );
  }

  return lines;
};

export const humanizeReminderMinutes = (mins: number) => {
  if (mins >= 1440) return tr("cardMeta.unitDays", { count: Math.floor(mins / 1440) });
  if (mins >= 60) return tr("cardMeta.unitHours", { count: Math.floor(mins / 60) });
  return tr("cardMeta.unitMinutes", { count: mins });
};

const COLOR_NAME_KEYS: Record<string, CardMessageKey> = {
  // Row 1
  "#bbf7d0": "cardMeta.color.lightGreen",
  "#fef08a": "cardMeta.color.lightYellow",
  "#fed7aa": "cardMeta.color.lightOrange",
  "#fecaca": "cardMeta.color.lightRed",
  "#f3e8ff": "cardMeta.color.lightPurple",
  // Row 2
  "#4ade80": "cardMeta.color.green",
  "#facc15": "cardMeta.color.yellow",
  "#fb923c": "cardMeta.color.orange",
  "#f87171": "cardMeta.color.red",
  "#c084fc": "cardMeta.color.purple",
  // Row 3
  "#15803d": "cardMeta.color.darkGreen",
  "#a16207": "cardMeta.color.darkYellow",
  "#c2410c": "cardMeta.color.darkOrange",
  "#b91c1c": "cardMeta.color.darkRed",
  "#7e22ce": "cardMeta.color.darkPurple",
  // Row 4
  "#dbeafe": "cardMeta.color.lightBlue",
  "#e0f2fe": "cardMeta.color.lightSky",
  "#d9f99d": "cardMeta.color.lightLime",
  "#fce7f3": "cardMeta.color.lightPink",
  "#e5e7eb": "cardMeta.color.lightGray",
  // Row 5
  "#3b82f6": "cardMeta.color.blue",
  "#0ea5e9": "cardMeta.color.sky",
  "#84cc16": "cardMeta.color.lime",
  "#db2777": "cardMeta.color.pink",
  "#9ca3af": "cardMeta.color.gray",
  // Row 6
  "#1d4ed8": "cardMeta.color.darkBlue",
  "#0369a1": "cardMeta.color.darkSky",
  "#4d7c0f": "cardMeta.color.darkLime",
  "#9d174d": "cardMeta.color.darkPink",
  "#4b5563": "cardMeta.color.darkGray",
  // Seeded default blue
  "#60a5fa": "cardMeta.color.blue",
};

export const getLocalizedColorName = (colorHex: string): string => {
  const key = COLOR_NAME_KEYS[colorHex.toLowerCase()];
  return key ? tr(key) : tr("cardMeta.color.other");
};

const TASK_DATE_MESSAGE_KEYS: Record<string, CardMessageKey> = {
  "Chọn ngày hạn nộp.": "cardMeta.errPickDeadlineDate",
  "Chọn ngày bắt đầu lịch làm.": "cardMeta.errPickScheduleStart",
  "Lịch làm nhiều ngày cần giờ bắt đầu và kết thúc.": "cardMeta.errMultiDayNeedTime",
  "Lịch làm theo giờ cần cả giờ bắt đầu và giờ kết thúc.": "cardMeta.errTimedNeedBoth",
  "Chỉ chọn ngày làm hoặc khoảng giờ làm, không chọn đồng thời.": "cardMeta.errExclusiveSchedule",
  "Lịch làm cần có cả giờ bắt đầu và giờ kết thúc.": "cardMeta.errNeedBothTimes",
  "Giờ kết thúc phải sau giờ bắt đầu.": "cardMeta.errEndAfterStart",
  "Buổi làm nằm sau hạn nộp. Hạn nộp vẫn được giữ nguyên.": "cardMeta.warnAfterDeadline",
};

export const translateTaskDateMessage = (msg: string): string => {
  const key = TASK_DATE_MESSAGE_KEYS[msg];
  return key ? tr(key) : msg;
};
