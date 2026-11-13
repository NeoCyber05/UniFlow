import "server-only";

import { db } from "@/lib/db";
import { getBoardCourses } from "@/lib/courses/board-courses";
import { pickCurrentWorkspace } from "@/lib/workspaces";
import { getOrCreateWorkspaces } from "@/lib/workspaces-db";

import { resolveCurrentWorkspaceBoardId } from "./current-workspace-board";
import type { MyTasksContext } from "./types";

export const getMyTasksContext = async (userId: string): Promise<MyTasksContext> => {
  if (!userId) {
    return { board: null, courses: [] };
  }

  const workspaces = await getOrCreateWorkspaces(userId);
  const currentWorkspace = pickCurrentWorkspace(workspaces);
  const boardId = currentWorkspace ? await resolveCurrentWorkspaceBoardId(userId, currentWorkspace) : null;

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
    board,
    courses,
  };
};
