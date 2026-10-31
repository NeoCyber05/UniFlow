import type { TooltipValueType } from "recharts";

import { intlDateFormat } from "@/lib/i18n";

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
export const formatDate = (value: string) =>
  intlDateFormat({
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
