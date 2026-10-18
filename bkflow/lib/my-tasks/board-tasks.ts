import "server-only";

import { db } from "@/lib/db";

import { myTaskSelect, toMyTaskDTO } from "./query";
import type { TaskListResponse } from "./types";

/**
 * Việc của một bảng, nhóm theo cột (List) theo thứ tự cột.
 * Gọi sau khi đã kiểm tra user là thành viên bảng.
 */
export const getBoardTaskGroups = async ({
  boardId,
  userId,
}: {
  boardId: string;
  userId: string;
}): Promise<TaskListResponse> => {
  const lists = await db.list.findMany({
    where: { boardId, archivedAt: null },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      cards: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        select: myTaskSelect(userId),
      },
    },
  });

  return {
    groups: lists.map((list) => ({
      key: list.id,
      label: list.title,
      tasks: list.cards.map(toMyTaskDTO),
    })),
    suggestions: [],
  };
};
