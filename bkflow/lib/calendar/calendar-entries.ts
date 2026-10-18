import type { BoardCalendarCardItem, BoardCalendarChecklistItem } from "@/types";

export type CalendarEntryKind =
  | "work"
  | "deadline"
  | "work-day"
  | "deadline-day"
  | "legacy-start"
  | "checklist-deadline";

/** Một hiển thị trên lịch. Một card có thể sinh nhiều entry, không sinh thêm Card. */
export type CalendarEntry = {
  key: string;
  cardId: string;
  kind: CalendarEntryKind;
  startsAt: string | null;
  /** Chỉ `work` có endsAt; hạn nộp/marker không chiếm thời gian. */
  endsAt: string | null;
  /** YYYY-MM-DD cho entry chỉ-ngày. */
  day: string | null;
  /** Checklist markers can be returned without their parent's calendar card row. */
  title?: string;
};

export const isUnscheduledForWork = (
  card: Pick<BoardCalendarCardItem, "scheduledOn" | "scheduledStartAt" | "scheduledEndAt">,
) => !card.scheduledOn && !(card.scheduledStartAt && card.scheduledEndAt);

export const projectCalendarEntries = (cards: BoardCalendarCardItem[]): CalendarEntry[] =>
  cards.flatMap((card) => {
    const entry = (
      kind: CalendarEntryKind,
      fields: Partial<Pick<CalendarEntry, "startsAt" | "endsAt" | "day">>,
    ): CalendarEntry => ({
      key: `${card.cardId}:${kind}`,
      cardId: card.cardId,
      kind,
      startsAt: null,
      endsAt: null,
      day: null,
      ...fields,
    });
    const entries: CalendarEntry[] = [];

    if (card.scheduledStartAt && card.scheduledEndAt) {
      entries.push(entry("work", { startsAt: card.scheduledStartAt, endsAt: card.scheduledEndAt }));
    } else if (card.scheduledOn) {
      entries.push(entry("work-day", { day: card.scheduledOn }));
    }
    if (card.dueDate) entries.push(entry("deadline", { startsAt: card.dueDate }));
    else if (card.deadlineOn) entries.push(entry("deadline-day", { day: card.deadlineOn }));
    // startDate cũ chỉ là mốc, không dựng thành khoảng start -> hạn.
    if (card.startDate) entries.push(entry("legacy-start", { startsAt: card.startDate }));

    return entries;
  });

/** Checklist có hạn giữ ở dạng marker để không mất dữ liệu hiển thị. */
export const projectChecklistEntries = (items: BoardCalendarChecklistItem[]): CalendarEntry[] =>
  items.map((item) => ({
    key: `${item.cardId}:checklist-deadline:${item.checklistItemId}`,
    cardId: item.cardId,
    kind: "checklist-deadline",
    title: `${item.title} · ${item.cardTitle}`,
    startsAt: item.dueDate,
    endsAt: null,
    day: null,
  }));
