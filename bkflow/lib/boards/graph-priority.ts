import type { BoardTimelineCard } from "@/types";

const DAY = 24 * 60 * 60 * 1000;

export type PriorityReason = { kind: "overdue" | "due" | "unlocks" | "chain" | "important"; label: string };

export type ReadyTask = {
  card: BoardTimelineCard;
  rank: number;
  /** Số việc chưa xong đang chờ việc này (trực tiếp + gián tiếp). */
  unlocks: number;
  /** Số việc nối tiếp dài nhất phía sau, tính cả việc này. */
  chainLength: number;
  daysLeft: number | null;
  reasons: PriorityReason[];
};

export type CustomOrderItem = { cardId: string; reason: string };

/**
 * Áp thứ tự do AI xếp lên danh sách làm được ngay hiện tại.
 * Việc đã xong biến mất; việc mới mở khóa (AI chưa thấy) xếp sau theo heuristic và được đánh dấu `unranked`.
 */
export const applyCustomOrder = (ready: ReadyTask[], order: CustomOrderItem[]) => {
  const position = new Map(order.map((item, index) => [item.cardId, index]));
  const reasonById = new Map(order.map((item) => [item.cardId, item.reason]));
  const ranked = ready.filter((task) => position.has(task.card.id)).sort((a, b) => position.get(a.card.id)! - position.get(b.card.id)!);
  const unranked = ready.filter((task) => !position.has(task.card.id));
  return [...ranked, ...unranked].map((task, index) => ({
    ...task,
    rank: index + 1,
    aiReason: reasonById.get(task.card.id),
    unranked: !position.has(task.card.id),
  }));
};

export type WaitingTask ={ card: BoardTimelineCard; waitingOn: BoardTimelineCard[] };

export type PriorityPlan = {
  ready: ReadyTask[];
  waiting: WaitingTask[];
  /** Chuỗi việc dài nhất còn lại, bắt đầu từ một việc làm được ngay: trễ việc nào trên chuỗi là trễ cả chuỗi. */
  criticalPath: string[];
};

/**
 * Xếp hạng việc nên làm trước trên đồ thị phụ thuộc.
 * Chỉ việc chưa xong và không còn việc chặn nào chưa xong mới "làm được ngay".
 * Thứ tự: quá hạn → hạn gần (≤ 3 ngày) → nằm trên chuỗi dài nhất → mở khóa nhiều việc → ⭐ → hạn → thứ tự trên bảng.
 */
export const buildPriorityPlan = (cards: BoardTimelineCard[], now: Date = new Date()): PriorityPlan => {
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

  const daysUntil = (card: BoardTimelineCard) =>
    card.dueDate ? Math.floor((new Date(card.dueDate).getTime() - now.getTime()) / DAY) : null;

  const readyCards = [...open.values()].filter((card) => (prev.get(card.id) ?? []).length === 0);
  const longest = Math.max(0, ...readyCards.map((card) => chainFrom(card.id).length));

  const scored = readyCards.map((card) => {
    const chain = chainFrom(card.id);
    const unlocks = countUnlocks(card.id);
    const daysLeft = daysUntil(card);
    const onCritical = longest > 1 && chain.length === longest;
    const reasons: PriorityReason[] = [];
    if (daysLeft !== null && daysLeft < 0) reasons.push({ kind: "overdue", label: `Quá hạn ${-daysLeft} ngày` });
    else if (daysLeft !== null && daysLeft <= 3) reasons.push({ kind: "due", label: daysLeft === 0 ? "Hạn hôm nay" : `Còn ${daysLeft} ngày` });
    if (onCritical) reasons.push({ kind: "chain", label: `Mở đầu chuỗi ${chain.length} việc` });
    if (unlocks > 0) reasons.push({ kind: "unlocks", label: `Mở khóa ${unlocks} việc` });
    if (card.isImportant) reasons.push({ kind: "important", label: "Quan trọng" });
    const urgency = daysLeft === null ? 2 : daysLeft < 0 ? 0 : daysLeft <= 3 ? 1 : 2;
    return { card, unlocks, chainLength: chain.length, daysLeft, reasons, urgency, onCritical };
  });

  scored.sort(
    (a, b) =>
      a.urgency - b.urgency ||
      Number(b.onCritical) - Number(a.onCritical) ||
      b.unlocks - a.unlocks ||
      Number(Boolean(b.card.isImportant)) - Number(Boolean(a.card.isImportant)) ||
      (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) ||
      a.card.listOrder - b.card.listOrder ||
      a.card.order - b.card.order,
  );

  const ready = scored.map(({ card, unlocks, chainLength, daysLeft, reasons }, index) => ({
    card, rank: index + 1, unlocks, chainLength, daysLeft, reasons,
  }));

  const waiting = [...open.values()]
    .filter((card) => (prev.get(card.id) ?? []).length > 0)
    .map((card) => ({ card, waitingOn: (prev.get(card.id) ?? []).map((id) => open.get(id)!) }));

  const criticalStart = scored.find((item) => item.onCritical);
  const criticalPath = criticalStart ? chainFrom(criticalStart.card.id).path : [];

  return { ready, waiting, criticalPath };
};
