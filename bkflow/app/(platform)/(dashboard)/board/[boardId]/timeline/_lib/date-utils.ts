import {
  addDays,
  addMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  isAfter,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { getDateFnsLocale, getIntlLocale, tr } from "@/lib/i18n";

import type {
  TimelineDateOverride,
  TimelineInteraction,
  TimelineUnit,
  TimelineZoom,
} from "../_types";

export const ZOOM_OPTIONS: readonly TimelineZoom[] = ["day", "week", "month"];

export const getZoomLabel = (zoom: TimelineZoom): string => {
  if (zoom === "day") return tr("timeline.zoom.day");
  if (zoom === "week") return tr("timeline.zoom.week");
  return tr("timeline.zoom.month");
};

export const zoomLabels: Record<TimelineZoom, string> = {
  get day() {
    return tr("timeline.zoom.day");
  },
  get week() {
    return tr("timeline.zoom.week");
  },
  get month() {
    return tr("timeline.zoom.month");
  },
};

export const parseTimelineDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return startOfDay(date);
};

export const parseCardDateTime = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

export const formatTimelineDate = (value: string | null) => {
  const date = parseTimelineDate(value);

  if (!date) {
    return tr("timeline.date.unset");
  }

  const pattern = getIntlLocale() === "ja-JP" ? "yyyy/MM/dd" : "dd/MM/yyyy";
  return format(date, pattern, { locale: getDateFnsLocale() });
};

export const getTimelineUnits = (
  start: Date,
  end: Date,
  zoom: TimelineZoom,
): TimelineUnit[] => {
  const dateLocale = getDateFnsLocale();
  const isJa = getIntlLocale() === "ja-JP";
  const dayMonthPattern = isJa ? "MM/dd" : "dd/MM";

  if (zoom === "day") {
    return eachDayOfInterval({ start, end }).map((date) => ({
      key: format(date, "yyyy-MM-dd"),
      label: format(date, dayMonthPattern, { locale: dateLocale }),
      start: date,
      end: date,
    }));
  }

  if (zoom === "week") {
    return eachWeekOfInterval(
      { start, end },
      { weekStartsOn: 1 },
    ).map((date) => ({
      key: `week:${format(date, "yyyy-MM-dd")}`,
      label: tr("timeline.unit.week", { date: format(date, dayMonthPattern, { locale: dateLocale }) }),
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: addDays(startOfWeek(date, { weekStartsOn: 1 }), 6),
    }));
  }

  const monthPattern = isJa ? "yyyy年M月" : "MM/yyyy";
  return eachMonthOfInterval({ start, end }).map((date) => ({
    key: `month:${format(date, "yyyy-MM")}`,
    label: format(date, monthPattern, { locale: dateLocale }),
    start: startOfMonth(date),
    end: addDays(startOfMonth(new Date(date.getFullYear(), date.getMonth() + 1, 1)), -1),
  }));
};

export const shiftTimelineDate = (
  date: Date,
  deltaUnits: number,
  zoom: TimelineZoom,
) => {
  if (zoom === "month") {
    return addMonths(date, deltaUnits);
  }

  return addDays(date, zoom === "week" ? deltaUnits * 7 : deltaUnits);
};

export const getInteractionDateRange = (
  interaction: TimelineInteraction,
  zoom: TimelineZoom,
) => {
  if (interaction.mode === "move-milestone") {
    const originalSingleDate = interaction.originalSingleDate ??
      interaction.originalStartDate;
    const nextSingleDate = shiftTimelineDate(
      originalSingleDate,
      interaction.deltaUnits,
      zoom,
    );

    return {
      startDate: interaction.singleDateField === "startDate"
        ? nextSingleDate
        : interaction.originalStartDate,
      dueDate: interaction.singleDateField === "dueDate"
        ? nextSingleDate
        : interaction.originalDueDate,
    };
  }

  if (interaction.mode === "move") {
    return {
      startDate: shiftTimelineDate(
        interaction.originalStartDate,
        interaction.deltaUnits,
        zoom,
      ),
      dueDate: shiftTimelineDate(
        interaction.originalDueDate,
        interaction.deltaUnits,
        zoom,
      ),
    };
  }

  if (interaction.mode === "resize-start") {
    return {
      startDate: shiftTimelineDate(
        interaction.originalStartDate,
        interaction.deltaUnits,
        zoom,
      ),
      dueDate: interaction.originalDueDate,
    };
  }

  return {
    startDate: interaction.originalStartDate,
    dueDate: shiftTimelineDate(
      interaction.originalDueDate,
      interaction.deltaUnits,
      zoom,
    ),
  };
};

export const getInteractionDateOverride = (
  interaction: TimelineInteraction,
  zoom: TimelineZoom,
): TimelineDateOverride => {
  const nextRange = getInteractionDateRange(interaction, zoom);

  if (interaction.mode === "move-milestone") {
    return {
      startDate: interaction.singleDateField === "startDate"
        ? nextRange.startDate.toISOString()
        : null,
      dueDate: interaction.singleDateField === "dueDate"
        ? nextRange.dueDate.toISOString()
        : null,
    };
  }

  return {
    startDate: nextRange.startDate.toISOString(),
    dueDate: nextRange.dueDate.toISOString(),
  };
};

export const hasSameDateRange = (
  leftStartDate: Date,
  leftDueDate: Date,
  rightStartDate: Date,
  rightDueDate: Date,
) => (
  leftStartDate.getTime() === rightStartDate.getTime() &&
  leftDueDate.getTime() === rightDueDate.getTime()
);

export const isInvalidTimelineRange = (startDate: Date, dueDate: Date) =>
  isAfter(startDate, dueDate);
