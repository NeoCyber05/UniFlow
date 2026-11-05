import { getZonedDayStart, getZonedParts, getZonedWeekStart } from "./time";

/** Loại biểu đồ Trợ lý có thể vẽ trong khung chat. */
export const CHART_KINDS = ["course_workload", "status", "list_distribution", "daily_progress", "deadline_load"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

/** Lọc thẻ theo hạn chót cho các biểu đồ dạng phân bổ; "all" giữ cả thẻ chưa có hạn. */
export const CHART_PERIODS = ["all", "this_week", "next_7_days", "next_14_days"] as const;
export type ChartPeriod = (typeof CHART_PERIODS)[number];

export const CHART_DAYS = { min: 3, max: 30, defaultPast: 14, defaultAhead: 7 } as const;
const MAX_BARS = 12;
const DAY_MS = 86_400_000;

/** Tên trạng thái khớp ScheduleHealthChart (nó tự dịch theo các tên này). */
export const STATUS_NAMES = ["Hoàn thành", "Đang làm", "Quá hạn", "Chưa có hạn"] as const;
export const PERSONAL_BUCKET = { id: "personal", name: "Cá nhân", color: "neutral" } as const;

export type ChartCard = {
  id: string;
  title: string;
  listId: string;
  listTitle: string;
  courseId: string | null;
  courseName: string | null;
  labels: string[];
  dueDate: Date | null;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ChartCourse = { id: string; name: string; color: string | null };
export type ChartList = { id: string; title: string };

export type ChartRequest = {
  kind: ChartKind;
  period?: ChartPeriod;
  days?: number;
  query?: string;
  title?: string;
};

type ChartBase = { title: string | null; period: ChartPeriod; query: string | null; matchedCards: number };

export type AssistantChart = ChartBase & (
  | { kind: "course_workload"; items: { id: string; name: string; color: string; completed: number; open: number; overdue: number }[] }
  | { kind: "status"; completionRate: number; items: { name: (typeof STATUS_NAMES)[number]; value: number }[] }
  | { kind: "list_distribution"; items: { id: string; name: string; count: number }[] }
  | { kind: "daily_progress"; days: number; totals: { created: number; completed: number }; points: { date: string; created: number; completed: number }[] }
  | { kind: "deadline_load"; days: number; overdue: number; points: { date: string; open: number; completed: number }[] }
);

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().trim();

const pad = (value: number) => String(value).padStart(2, "0");

/** Khoá ngày "YYYY-MM-DD" theo múi giờ người dùng. */
export const zonedDayKey = (date: Date, timeZone: string) => {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
};

const clampDays = (days: number | undefined, fallback: number) =>
  Math.min(CHART_DAYS.max, Math.max(CHART_DAYS.min, Math.round(days ?? fallback)));

const matchesQuery = (card: ChartCard, query: string) => {
  const haystack = normalize([card.title, card.courseName ?? "", card.listTitle, ...card.labels].join(" "));
  return normalize(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
};

const inPeriod = (card: ChartCard, period: ChartPeriod, now: Date, timeZone: string) => {
  if (period === "all") return true;
  if (!card.dueDate) return false;
  const todayStart = getZonedDayStart(now, timeZone);
  const end = period === "this_week"
    ? new Date(getZonedWeekStart(now, timeZone).getTime() + 7 * DAY_MS)
    : getZonedDayStart(now, timeZone, period === "next_7_days" ? 7 : 14);
  // Thẻ quá hạn chưa xong vẫn là việc phải gánh trong khoảng này.
  const overdueOpen = !card.isCompleted && card.dueDate < todayStart;
  return overdueOpen || (card.dueDate >= todayStart && card.dueDate < end);
};

const dayKeys = (now: Date, timeZone: string, from: number, count: number) =>
  Array.from({ length: count }, (_, index) => zonedDayKey(getZonedDayStart(now, timeZone, from + index), timeZone));

/**
 * Dựng dữ liệu biểu đồ từ thẻ của bảng hiện tại. Thuần (không đọc DB) để test được;
 * kết quả vừa là thứ UI vẽ ra, vừa là số liệu để model viết nhận xét.
 */
export const buildAssistantChart = (
  request: ChartRequest,
  data: { cards: ChartCard[]; courses: ChartCourse[]; lists: ChartList[] },
  now: Date,
  timeZone: string,
): AssistantChart => {
  const query = request.query?.trim() || null;
  const period = request.period ?? "all";
  const scoped = query ? data.cards.filter((card) => matchesQuery(card, query)) : data.cards;
  const usesPeriod = request.kind === "course_workload" || request.kind === "status" || request.kind === "list_distribution";
  const cards = usesPeriod ? scoped.filter((card) => inPeriod(card, period, now, timeZone)) : scoped;
  const base: ChartBase = { title: request.title?.trim() || null, period: usesPeriod ? period : "all", query, matchedCards: cards.length };
  const isOverdue = (card: ChartCard) => !card.isCompleted && Boolean(card.dueDate && card.dueDate < now);

  switch (request.kind) {
    case "course_workload": {
      const buckets = new Map(
        [...data.courses.map((course) => ({ id: course.id, name: course.name, color: course.color ?? "violet" })), PERSONAL_BUCKET]
          .map((bucket) => [bucket.id, { ...bucket, completed: 0, open: 0, overdue: 0 }]),
      );
      for (const card of cards) {
        const bucket = buckets.get(card.courseId ?? PERSONAL_BUCKET.id) ?? buckets.get(PERSONAL_BUCKET.id)!;
        if (card.isCompleted) bucket.completed += 1;
        else if (isOverdue(card)) bucket.overdue += 1;
        else bucket.open += 1;
      }
      const items = [...buckets.values()]
        .filter((bucket) => bucket.completed + bucket.open + bucket.overdue > 0)
        .sort((a, b) => b.open + b.overdue - (a.open + a.overdue) || b.completed - a.completed)
        .slice(0, MAX_BARS);
      return { ...base, kind: "course_workload", items };
    }
    case "status": {
      const completed = cards.filter((card) => card.isCompleted).length;
      const values = [
        completed,
        cards.filter((card) => !card.isCompleted && card.dueDate && card.dueDate >= now).length,
        cards.filter(isOverdue).length,
        cards.filter((card) => !card.isCompleted && !card.dueDate).length,
      ];
      return {
        ...base,
        kind: "status",
        completionRate: cards.length === 0 ? 0 : Math.round((completed / cards.length) * 100),
        items: STATUS_NAMES.map((name, index) => ({ name, value: values[index] })),
      };
    }
    case "list_distribution": {
      const items = data.lists
        .map((list) => ({ id: list.id, name: list.title, count: cards.filter((card) => card.listId === list.id).length }))
        .slice(0, MAX_BARS);
      return { ...base, kind: "list_distribution", items };
    }
    case "daily_progress": {
      const days = clampDays(request.days, CHART_DAYS.defaultPast);
      const keys = dayKeys(now, timeZone, -(days - 1), days);
      const points = new Map(keys.map((date) => [date, { date, created: 0, completed: 0 }]));
      for (const card of cards) {
        const created = points.get(zonedDayKey(card.createdAt, timeZone));
        if (created) created.created += 1;
        // Chưa lưu thời điểm hoàn thành: lấy lần cập nhật cuối của thẻ đã xong.
        const completed = card.isCompleted ? points.get(zonedDayKey(card.updatedAt, timeZone)) : undefined;
        if (completed) completed.completed += 1;
      }
      const list = [...points.values()];
      return {
        ...base,
        kind: "daily_progress",
        days,
        totals: list.reduce((sum, point) => ({ created: sum.created + point.created, completed: sum.completed + point.completed }), { created: 0, completed: 0 }),
        points: list,
      };
    }
    case "deadline_load": {
      const days = clampDays(request.days, CHART_DAYS.defaultAhead);
      const points = new Map(dayKeys(now, timeZone, 0, days).map((date) => [date, { date, open: 0, completed: 0 }]));
      let overdue = 0;
      for (const card of cards) {
        if (!card.dueDate) continue;
        if (isOverdue(card)) { overdue += 1; continue; }
        const point = points.get(zonedDayKey(card.dueDate, timeZone));
        if (!point) continue;
        if (card.isCompleted) point.completed += 1;
        else point.open += 1;
      }
      return { ...base, kind: "deadline_load", days, overdue, points: [...points.values()] };
    }
  }
};
