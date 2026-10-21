import type { BoardTimelineCard } from "@/types";

const DAY = 24 * 60 * 60 * 1000;
const VN_OFFSET = 7 * 60 * 60 * 1000;

/** Số thứ tự ngày theo lịch Việt Nam (UTC+7, không có giờ mùa hè): hai mốc cùng ngày VN cho cùng số. */
const vnDayIndex = (date: Date) => Math.floor((date.getTime() + VN_OFFSET) / DAY);

export type PriorityReason = { kind: "overdue" | "due" | "unlocks" | "chain" | "important"; label: string };

type TaskMetrics = {
  card: BoardTimelineCard;
  /** Số việc chưa xong đang chờ việc này (trực tiếp + gián tiếp). */
  unlocks: number;
  /** Số việc nối tiếp dài nhất phía sau, tính cả việc này. */
  chainLength: number;
  /** Số ngày (lịch VN) tới hạn; âm là đã quá hạn. */
  daysLeft: number | null;
  onCritical: boolean;
  reasons: PriorityReason[];
};

export type ReadyTask = TaskMetrics & { rank: number };

export type CustomOrderItem = { cardId: string; reason: string };

export type WaitingTask = { card: BoardTimelineCard; waitingOn: BoardTimelineCard[] };

export type PriorityPlan = {
  ready: ReadyTask[];
  waiting: WaitingTask[];
  /** Chuỗi việc dài nhất còn lại, bắt đầu từ một việc làm được ngay: trễ việc nào trên chuỗi là trễ cả chuỗi. */
  criticalPath: string[];
};

/** Quá hạn → hạn ≤ 3 ngày → trên chuỗi dài nhất → mở khóa nhiều việc → ⭐ → hạn sớm → thứ tự trên bảng. */
const compareMetrics = (a: TaskMetrics, b: TaskMetrics) => {
  const urgency = (task: TaskMetrics) => (task.daysLeft === null ? 2 : task.daysLeft < 0 ? 0 : task.daysLeft <= 3 ? 1 : 2);
  return (
    urgency(a) - urgency(b) ||
    Number(b.onCritical) - Number(a.onCritical) ||
    b.unlocks - a.unlocks ||
    Number(Boolean(b.card.isImportant)) - Number(Boolean(a.card.isImportant)) ||
    (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) ||
    a.card.listOrder - b.card.listOrder ||
    a.card.order - b.card.order
  );
};

/** Đồ thị các việc chưa xong + chỉ số ưu tiên của từng việc. */
const analyzeOpenCards = (cards: BoardTimelineCard[], now: Date) => {
  const open = new Map(cards.filter((card) => !card.isCompleted).map((card) => [card.id, card]));
  const next = new Map<string, string[]>();
  const prev = new Map<string, string[]>();
  for (const card of open.values()) {
    next.set(card.id, card.blockingDependencies.map((d) => d.cardId).filter((id) => open.has(id)));
    prev.set(card.id, card.blockedByDependencies.map((d) => d.cardId).filter((id) => open.has(id)));
  }

  // Chuỗi dài nhất phía sau (DFS có nhớ; gặp vòng thì cắt)
  const chainMemo = new Map<string, { length: number; path: string[] }>();
  const visiting = new Set<string>();
  const chainFrom = (id: string): { length: number; path: string[] } => {
    const cached = chainMemo.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return { length: 0, path: [] };
    visiting.add(id);
    let best: { length: number; path: string[] } = { length: 0, path: [] };
    for (const childId of next.get(id) ?? []) {
      const child = chainFrom(childId);
      if (child.length > best.length) best = child;
    }
    visiting.delete(id);
    const result = { length: best.length + 1, path: [id, ...best.path] };
    chainMemo.set(id, result);
    return result;
  };

  const countUnlocks = (id: string) => {
    const seen = new Set<string>();
    const stack = [...(next.get(id) ?? [])];
    while (stack.length) {
      const current = stack.pop()!;
      if (seen.has(current) || current === id) continue;
      seen.add(current);
      stack.push(...(next.get(current) ?? []));
    }
    return seen.size;
  };

  const today = vnDayIndex(now);
  const isReady = (id: string) => (prev.get(id) ?? []).length === 0;
  const readyIds = [...open.keys()].filter(isReady);
  const longest = Math.max(0, ...readyIds.map((id) => chainFrom(id).length));
  const criticalStartCandidates = readyIds.filter((id) => longest > 1 && chainFrom(id).length === longest);

  const metrics = new Map<string, TaskMetrics>();
  for (const card of open.values()) {
    const chainLength = chainFrom(card.id).length;
    const unlocks = countUnlocks(card.id);
    const daysLeft = card.dueDate ? vnDayIndex(new Date(card.dueDate)) - today : null;
    const onCritical = isReady(card.id) && criticalStartCandidates.includes(card.id);
    const reasons: PriorityReason[] = [];
    if (daysLeft !== null && daysLeft < 0) reasons.push({ kind: "overdue", label: `Quá hạn ${-daysLeft} ngày` });
    else if (daysLeft !== null && daysLeft <= 3) reasons.push({ kind: "due", label: daysLeft === 0 ? "Hạn hôm nay" : daysLeft === 1 ? "Hạn ngày mai" : `Còn ${daysLeft} ngày` });
    if (onCritical) reasons.push({ kind: "chain", label: `Mở đầu chuỗi ${chainLength} việc` });
    if (unlocks > 0) reasons.push({ kind: "unlocks", label: `Mở khóa ${unlocks} việc` });
    if (card.isImportant) reasons.push({ kind: "important", label: "Quan trọng" });
    metrics.set(card.id, { card, unlocks, chainLength, daysLeft, onCritical, reasons });
  }

  const sortedReady = readyIds.map((id) => metrics.get(id)!).sort(compareMetrics);
  const criticalStart = sortedReady.find((task) => task.onCritical);
  const criticalPath = criticalStart ? chainFrom(criticalStart.card.id).path : [];

  return { open, next, prev, metrics, sortedReady, criticalPath };
};

/**
 * Xếp hạng việc nên làm trước trên đồ thị phụ thuộc.
 * Chỉ việc chưa xong và không còn việc chặn nào chưa xong mới "làm được ngay".
 */
export const buildPriorityPlan = (cards: BoardTimelineCard[], now: Date = new Date()): PriorityPlan => {
  const { open, prev, sortedReady, criticalPath } = analyzeOpenCards(cards, now);
  const ready = sortedReady.map((task, index) => ({ ...task, rank: index + 1 }));
  const waiting = [...open.values()]
    .filter((card) => (prev.get(card.id) ?? []).length > 0)
    .map((card) => ({ card, waitingOn: (prev.get(card.id) ?? []).map((id) => open.get(id)!) }));
  return { ready, waiting, criticalPath };
};

export type ScheduledTask = TaskMetrics & {
  /** Làm được ngay (không còn việc chặn chưa xong). */
  ready: boolean;
  waitingOn: BoardTimelineCard[];
  aiReason?: string;
  /** Đang xếp bằng AI nhưng việc này AI chưa thấy (vừa mở khóa / mới tạo). */
  unranked: boolean;
  /** Theo lịch này việc rơi vào sau ngày hạn chót. */
  lateRisk: boolean;
};

export type ScheduleDay = { offset: number; date: Date; tasks: ScheduledTask[] };

export type Schedule = {
  days: ScheduleDay[];
  /** Kẹt trong vòng phụ thuộc, không xếp được. */
  stuck: BoardTimelineCard[];
  lateCount: number;
};

/**
 * Chia mọi việc chưa xong vào từng ngày, `perDay` việc mỗi ngày, bắt đầu từ hôm nay.
 * Việc chỉ được xếp sau khi mọi việc chặn nó đã được xếp (Kahn), mỗi bước chọn việc ưu tiên nhất đang làm được.
 * Có `order` (AI) thì việc AI đã xếp đi trước theo thứ tự AI, việc AI chưa thấy theo heuristic.
 */
export const buildSchedule = (
  cards: BoardTimelineCard[],
  { perDay, order, now = new Date() }: { perDay: number; order?: CustomOrderItem[]; now?: Date },
): Schedule => {
  const { open, next, prev, metrics } = analyzeOpenCards(cards, now);
  const position = new Map(order?.map((item, index) => [item.cardId, index]));
  const reasonById = new Map(order?.map((item) => [item.cardId, item.reason]));
  const compare = (a: TaskMetrics, b: TaskMetrics) => {
    const pa = position.get(a.card.id);
    const pb = position.get(b.card.id);
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return compareMetrics(a, b);
  };

  const remaining = new Map([...open.keys()].map((id) => [id, (prev.get(id) ?? []).length]));
  const available = [...remaining].filter(([, count]) => count === 0).map(([id]) => id);
  const sequence: string[] = [];
  while (available.length) {
    available.sort((a, b) => compare(metrics.get(a)!, metrics.get(b)!));
    const id = available.shift()!;
    sequence.push(id);
    remaining.delete(id);
    for (const childId of next.get(id) ?? []) {
      const count = (remaining.get(childId) ?? 0) - 1;
      remaining.set(childId, count);
      if (count === 0) available.push(childId);
    }
  }

  const size = Math.max(1, Math.floor(perDay));
  const today = vnDayIndex(now);
  const days: ScheduleDay[] = [];
  let lateCount = 0;
  sequence.forEach((id, index) => {
    const offset = Math.floor(index / size);
    if (!days[offset]) days[offset] = { offset, date: new Date((today + offset) * DAY - VN_OFFSET + 12 * 60 * 60 * 1000), tasks: [] };
    const task = metrics.get(id)!;
    const blockers = (prev.get(id) ?? []).map((blockerId) => open.get(blockerId)!);
    const lateRisk = task.daysLeft !== null && task.daysLeft >= 0 && task.daysLeft < offset;
    if (lateRisk) lateCount += 1;
    days[offset].tasks.push({
      ...task,
      ready: blockers.length === 0,
      waitingOn: blockers,
      aiReason: reasonById.get(id) || undefined,
      unranked: Boolean(order) && !position.has(id),
      lateRisk,
    });
  });

  return { days, stuck: [...remaining.keys()].map((id) => open.get(id)!), lateCount };
};
