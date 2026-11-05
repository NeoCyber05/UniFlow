import { deadlineConditions } from "@/lib/cards/task-deadline";
import { db } from "@/lib/db";
import { summarizeAssistantHome } from "@/lib/ai/assistant/home-summary";
import { getZonedDayStart, getZonedWeekStart, resolveTimeZone } from "@/lib/ai/assistant/time";
import { workspaceBoardScope } from "@/lib/search/workspace-search";

const OPEN_CARD_LIMIT = 300;

// Dữ liệu màn chào của /assistant: chỉ đọc DB, không gọi model, nên trang mở tức thì.
export const loadAssistantHome = async ({ timeZone: requested }: { timeZone?: string }, userId: string) => {
  const timeZone = resolveTimeZone(requested);
  const now = new Date();
  const endOfToday = getZonedDayStart(now, timeZone, 1);
  const weekStart = getZonedWeekStart(now, timeZone);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const scope = { archivedAt: null, kind: "TASK" as const, list: { archivedAt: null, board: workspaceBoardScope(userId) } };

  const [openCards, doneThisWeek, doneLastWeek] = await Promise.all([
    db.card.findMany({
      where: { ...scope, isCompleted: false, OR: deadlineConditions({ lt: endOfToday }) },
      select: { id: true, title: true, dueDate: true, deadlineOn: true, list: { select: { boardId: true } } },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      take: OPEN_CARD_LIMIT,
    }),
    db.card.count({ where: { ...scope, isCompleted: true, updatedAt: { gte: weekStart, lt: now } } }),
    db.card.count({ where: { ...scope, isCompleted: true, updatedAt: { gte: lastWeekStart, lt: weekStart } } }),
  ]);

  return {
    timeZone,
    now: now.toISOString(),
    ...summarizeAssistantHome({
      now,
      endOfToday,
      doneThisWeek,
      doneLastWeek,
      openCards: openCards.map((card) => ({
        id: card.id,
        title: card.title,
        boardId: card.list.boardId,
        dueDate: card.dueDate,
        deadlineOn: card.deadlineOn?.toISOString().slice(0, 10) ?? null,
      })),
    }),
  };
};
