import { format, formatDistanceToNow, isPast } from "date-fns";
import { getDateFnsLocale, tr, useLocale } from "@/lib/i18n";

import { NotificationItem } from "@/components/notifications/types";
import { formatNotificationText } from "@/lib/utils";

const parseNotificationDate = (date: string | null) => {
  if (!date) {
    return null;
  }

  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateTimePattern = () =>
  useLocale.getState().locale === "ja" ? "yyyy/MM/dd HH:mm" : "dd/MM/yyyy 'lúc' HH:mm";

export const formatNotificationDateTime = (date: string | null) => {
  const parsed = parseNotificationDate(date);

  return parsed ? format(parsed, dateTimePattern(), { locale: getDateFnsLocale() }) : null;
};

export const getReminderNotificationDisplay = (
  notification: NotificationItem,
) => {
  const formatted = formatNotificationText(notification.title, notification.message);
  const dueDate = parseNotificationDate(notification.dueDate);
  const cardTitle = notification.cardTitle?.trim() || null;

  if (!dueDate) {
    return {
      title: formatted.title,
      message: formatted.message,
      dueDateText: null,
      statusText: null,
      overdue: false,
    };
  }

  const locale = getDateFnsLocale();
  const overdue = isPast(dueDate);
  const timeText = format(dueDate, "HH:mm", { locale });
  const relative = formatDistanceToNow(dueDate, { locale });
  const reminderActionText = overdue ? tr("notif.overdueAt") : tr("notif.dueAt");
  const fallbackSubject = overdue ? tr("notif.cardOverdue") : tr("notif.cardDue");

  return {
    title: overdue ? tr("notif.cardOverdue") : tr("notif.cardSoon"),
    message: cardTitle
      ? tr("notif.cardTemplate", { title: cardTitle, action: reminderActionText, time: timeText })
      : tr("notif.atTime", { subject: fallbackSubject, time: timeText }),
    dueDateText: format(dueDate, dateTimePattern(), { locale }),
    statusText: overdue
      ? tr("notif.overdueBy", { relative })
      : tr("notif.dueIn", { relative }),
    overdue,
  };
};
