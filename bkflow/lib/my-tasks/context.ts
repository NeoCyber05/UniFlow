import "server-only";

import { db } from "@/lib/db";
import { getBoardCourses } from "@/lib/courses/board-courses";
import { pickCurrentSemester } from "@/lib/semesters";
import { getOrSeedSemesters } from "@/lib/semesters-db";

import { resolveCurrentSemesterBoardId } from "./current-semester-board";
import type { MyTasksContext } from "./types";

export const getMyTasksContext = async (userId: string): Promise<MyTasksContext> => {
  const personalOrgId = userId;

  if (!personalOrgId) {
    return { personalOrgId: null, semesters: [], currentSemesterId: null, board: null, courses: [] };
  }

  const semesters = await getOrSeedSemesters(personalOrgId);
  const currentSemester = pickCurrentSemester(semesters);
  const boardId = currentSemester ? await resolveCurrentSemesterBoardId(userId, currentSemester) : null;

  const [boardData, courses] = boardId
    ? await Promise.all([
        db.board.findUnique({
          where: { id: boardId },
          select: {
            id: true,
            lists: {
              where: { archivedAt: null },
              orderBy: { order: "asc" },
              select: { id: true, title: true },
            },
            labels: {
              orderBy: { createdAt: "asc" },
              select: { id: true, title: true, color: true },
            },
          },
        }),
        getBoardCourses(boardId),
      ])
    : [null, []];

  const board = boardData
    ? {
        ...boardData,
        members: [],
      }
    : null;

  return {
    personalOrgId,
    semesters: semesters.map((semester) => ({
      ...semester,
      startDate: semester.startDate.toISOString(),
      endDate: semester.endDate.toISOString(),
      createdAt: semester.createdAt.toISOString(),
      updatedAt: semester.updatedAt.toISOString(),
    })),
    currentSemesterId: currentSemester?.id ?? null,
    board,
    courses,
  };
};
