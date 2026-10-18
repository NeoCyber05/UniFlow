import { format } from "date-fns";
import { vi } from "date-fns/locale";

import type { CardWithList } from "@/types";

export const getDateSummary = ({
  startDate,
  dueDate,
  hasStartDate,
  hasDueDate,
}: {
  startDate: CardWithList["startDate"];
  dueDate: CardWithList["dueDate"];
  hasStartDate: boolean;
  hasDueDate: boolean;
}) => {
  const formattedDate = dueDate
    ? format(new Date(dueDate), "H:mm d 'thg' M", { locale: vi })
    : "";
  const formattedStartDate = startDate
    ? format(new Date(startDate), "H:mm d 'thg' M", { locale: vi })
    : "";

  return hasStartDate && hasDueDate
    ? `Bắt đầu ${formattedStartDate} - Hết hạn ${formattedDate}`
    : hasStartDate
      ? `Bắt đầu ${formattedStartDate}`
      : hasDueDate
        ? `Hết hạn ${formattedDate}`
        : "";
};

export const humanizeReminderMinutes = (mins: number) => {
  if (mins >= 1440) return `${Math.floor(mins / 1440)} ngày`;
  if (mins >= 60) return `${Math.floor(mins / 60)} giờ`;
  return `${mins} phút`;
};
