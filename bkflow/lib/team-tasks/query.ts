import "server-only";

import { BoardMemberRole, BoardType } from "@prisma/client";

import { db } from "@/lib/db";
import { getOrganizationMembers } from "@/lib/clerk-org-members";
import { myTaskSelect, toMyTaskDTO } from "@/lib/my-tasks/query";

import type { TeamOverviewResponse } from "./types";

const MAX_TASKS = 1000;

/** Bảng dự án của org mà user là thành viên + toàn bộ việc trên các bảng đó. */
export const getTeamOverview = async ({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string;
}): Promise<TeamOverviewResponse> => {
  const boards = await db.board.findMany({
    where: { orgId, boardType: BoardType.TEAM_PROJECT, members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      members: {
        where: { role: { not: BoardMemberRole.VIEWER } },
        orderBy: { createdAt: "asc" },
        select: { userId: true, userName: true },
      },
    },
  });
  const boardIds = boards.map((board) => board.id);

  const [rows, orgMembers] = await Promise.all([
    boardIds.length > 0
      ? db.card.findMany({
          where: { archivedAt: null, list: { archivedAt: null, boardId: { in: boardIds } } },
          select: myTaskSelect(userId),
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
          take: MAX_TASKS,
        })
      : Promise.resolve([]),
    getOrganizationMembers(orgId),
  ]);
  const tasks = rows.map(toMyTaskDTO);

  return {
    boards: boards.map((board) => ({
      id: board.id,
      title: board.title,
      members: board.members,
      openCount: tasks.filter((task) => task.boardId === board.id && !task.isCompleted).length,
    })),
    members: orgMembers.map((member) => ({
      userId: member.userId,
      name: member.name,
      imageUrl: member.imageUrl,
    })),
    tasks,
  };
};
