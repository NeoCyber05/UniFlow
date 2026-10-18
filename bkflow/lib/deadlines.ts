// Người dùng ở Việt Nam (UTC+7, không có DST) — server có thể chạy UTC nên tự tính mốc ngày
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const UPCOMING_WINDOW_DAYS = 7;

export const getEndOfDayVN = (now: Date = new Date()): Date => {
  const local = new Date(now.getTime() + VN_OFFSET_MS);
  local.setUTCHours(23, 59, 59, 999);

  return new Date(local.getTime() - VN_OFFSET_MS);
};

type DeadlineCard = {
  dueDate: Date | null;
  isCompleted: boolean;
};

export type DeadlineBuckets<T> = {
  overdue: T[];
  today: T[];
  upcoming: T[];
};

/**
 * Chia thẻ chưa xong theo hạn: quá hạn / trong hôm nay / trong N ngày tới.
 * Thẻ đã xong, không có hạn hoặc hạn xa hơn bị bỏ qua. Mỗi nhóm sắp theo hạn tăng dần.
 */
export const bucketDeadlines = <T extends DeadlineCard>(
  cards: T[],
  now: Date = new Date(),
  windowDays: number = UPCOMING_WINDOW_DAYS,
): DeadlineBuckets<T & { dueDate: Date }> => {
  const endOfToday = getEndOfDayVN(now);
  const windowEnd = new Date(endOfToday.getTime() + windowDays * DAY_MS);
  const buckets: DeadlineBuckets<T & { dueDate: Date }> = { overdue: [], today: [], upcoming: [] };

  for (const card of cards) {
    if (card.isCompleted || !card.dueDate) continue;

    const withDue = card as T & { dueDate: Date };
    const due = card.dueDate.getTime();

    if (due < now.getTime()) {
      buckets.overdue.push(withDue);
    } else if (due <= endOfToday.getTime()) {
      buckets.today.push(withDue);
    } else if (due <= windowEnd.getTime()) {
      buckets.upcoming.push(withDue);
    }
  }

  const byDue = (a: { dueDate: Date }, b: { dueDate: Date }) => a.dueDate.getTime() - b.dueDate.getTime();
  buckets.overdue.sort(byDue);
  buckets.today.sort(byDue);
  buckets.upcoming.sort(byDue);

  return buckets;
};
