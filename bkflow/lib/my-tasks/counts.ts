import "server-only";

import { deadlineWhere } from "@/lib/cards/task-deadline";
import { db } from "@/lib/db";
import { PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { pickCurrentSemester } from "@/lib/semesters";
import { getOrSeedSemesters } from "@/lib/semesters-db";

import { buildTodoBaseWhere, getTodayWindow } from "./query";
import type { MyTaskCounts } from "./types";

export const getMyTaskCounts = async (userId: string, now: Date = new Date()): Promise<MyTaskCounts> => {
  const personalOrgId = userId;
  const currentSemester = personalOrgId
    ? pickCurrentSemester(await getOrSeedSemesters(personalOrgId))
    : null;
  const semesterBoard = currentSemester
    ? await db.board.findUnique({ where: { semesterId: currentSemester.id }, select: { id: true } })
    : null;

  if (!semesterBoard) {
    return { today: 0, byCourse: {} };
  }

  const { startOfToday, endOfToday } = getTodayWindow(now);
  const base = buildTodoBaseWhere({ userId, boardId: semesterBoard.id, includeTeam: true });

  const [today, byCourseRows] = await Promise.all([
    db.card.count({
      where: {
        AND: [
          base,
          { isCompleted: false },
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
        list: { archivedAt: null, boardId: semesterBoard.id },
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
