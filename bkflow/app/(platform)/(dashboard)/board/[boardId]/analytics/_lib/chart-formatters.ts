import type { TooltipValueType } from "recharts";

export const legendColors = ["#10b981", "#3b82f6", "#f43f5e", "#737373"];
export const scheduleGradients = [
  "url(#colorCompleted)",
  "url(#colorActive)",
  "url(#colorOverdue)",
  "url(#colorUnscheduled)",
];

export const formatTooltipValue = (value: TooltipValueType | undefined) => {
  if (Array.isArray(value)) {
    return value.join(" - ");
  }

  return value ?? "";
};

// Một formatter dùng chung: tạo mới cho mỗi giá trị rất chậm khi biểu đồ có nhiều điểm
const DATE_FORMAT = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const formatDate = (value: string) => DATE_FORMAT.format(new Date(value));
