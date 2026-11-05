import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";

export type HomeCard = { id: string; title: string; boardId: string; dueDate: Date | string | null; deadlineOn: string | null };
export type HomeItem = { id: string; title: string; boardId: string; dueAt: string };

export type AssistantHomeSummary = {
  dueToday: { count: number; first: HomeItem | null };
  overdue: { count: number; first: HomeItem | null };
  done: { thisWeek: number; lastWeek: number };
};

/**
 * Tóm tắt "Hôm nay của bạn": hạn còn lại trong ngày, việc quá hạn (cũ nhất trước) và số việc xong
 * tuần này so với tuần trước. Ngày xong là ước lượng theo lần cập nhật cuối (giống biểu đồ week_compare).
 */
export const summarizeAssistantHome = (input: {
  openCards: HomeCard[];
  now: Date;
  endOfToday: Date;
  doneThisWeek: number;
  doneLastWeek: number;
}): AssistantHomeSummary => {
  const today: HomeItem[] = [];
  const overdue: HomeItem[] = [];
  for (const card of input.openCards) {
    const due = getTaskDeadlineAt({ dueDate: card.dueDate, deadlineOn: card.deadlineOn });
    if (!due) continue;
    const item = { id: card.id, title: card.title, boardId: card.boardId, dueAt: due.toISOString() };
    if (due < input.now) overdue.push(item);
    else if (due < input.endOfToday) today.push(item);
  }
  const byDue = (a: HomeItem, b: HomeItem) => a.dueAt.localeCompare(b.dueAt);
  today.sort(byDue);
  overdue.sort(byDue);
  return {
    dueToday: { count: today.length, first: today[0] ?? null },
    overdue: { count: overdue.length, first: overdue[0] ?? null },
    done: { thisWeek: input.doneThisWeek, lastWeek: input.doneLastWeek },
  };
};
