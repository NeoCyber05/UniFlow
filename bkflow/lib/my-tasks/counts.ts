import "server-only";

import { deadlineWhere } from "@/lib/cards/task-deadline";
import { db } from "@/lib/db";
import { PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { pickCurrentWorkspace } from "@/lib/workspaces";
import { getOrCreateWorkspaces } from "@/lib/workspaces-db";

import { buildTodoBaseWhere, getTodayWindow } from "./query";
import type { MyTaskCounts } from "./types";

export const getMyTaskCounts = async (userId: string, now: Date = new Date()): Promise<MyTaskCounts> => {
  const currentWorkspace = userId ? pickCurrentWorkspace(await getOrCreateWorkspaces(userId)) : null;
  const workspaceBoard = currentWorkspace
    ? await db.board.findUnique({ where: { workspaceId: currentWorkspace.id }, select: { id: true } })
    : null;

  if (!workspaceBoard) {
    return { today: 0, byCourse: {} };
  }

  const { startOfToday, endOfToday } = getTodayWindow(now);
  const base = buildTodoBaseWhere({ userId, boardId: workspaceBoard.id, includeTeam: true });

  const [today, byCourseRows] = await Promise.all([
    db.card.count({
      where: {
        AND: [
          base,
          { isCompleted: false, kind: "TASK" },
          {
            OR: [
              deadlineWhere({ lte: endOfToday }),
              { userStates: { some: { userId, myDayAt: { gte: startOfToday } } } },
            ],
          },
        ],
      },
    }),
    db.card.groupBy({
      by: ["courseId"],
      where: {
        archivedAt: null,
        isCompleted: false,
        kind: "TASK",
        list: { archivedAt: null, boardId: workspaceBoard.id },
      },
      _count: { _all: true },
    }),
  ]);

  const byCourse: Record<string, number> = {};

  for (const row of byCourseRows) {
    byCourse[row.courseId ?? PERSONAL_COURSE_FILTER] = row._count._all;
  }

  return { today, byCourse };
};
