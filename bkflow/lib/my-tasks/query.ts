import "server-only";

import { BoardMemberRole, BoardType, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { pickCurrentSemester } from "@/lib/semesters";
import { getOrSeedSemesters } from "@/lib/semesters-db";

import { groupAgendaTasks, type BucketTask, type TaskGroup } from "./buckets";
import type { MyTask, TaskListResponse } from "./types";
import { getEndOfVNDay, getStartOfVNDay, getVNDay } from "./vn-day";

const MAX_TASKS = 300;

/** Thẻ của một bảng kỳ; kèm thẻ bảng nhóm được giao cho user khi `includeTeam`. */
export const buildTodoBaseWhere = ({
  userId,
  boardId,
  includeTeam,
}: {
  userId: string;
  boardId: string;
  includeTeam: boolean;
}): Prisma.CardWhereInput => ({
  archivedAt: null,
  AND: [
    { list: { archivedAt: null } },
    {
      OR: [
        { list: { boardId } },
        ...(includeTeam
          ? [{
              list: { board: { boardType: BoardType.TEAM_PROJECT } },
              assignees: { some: { boardMember: { userId } } },
            }]
          : []),
      ],
    },
  ],
});

export const getTodayWindow = (now: Date) => {
  const today = getVNDay(now);

  return {
    startOfToday: getStartOfVNDay(today),
    endOfToday: getEndOfVNDay(today),
  };
};

/** Bảng có thuộc học kỳ hiện tại của org không — quyết định có gộp việc nhóm. */
const isCurrentSemesterBoard = async (boardId: string) => {
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { orgId: true, semesterId: true },
  });

  if (!board?.semesterId) return false;

  return pickCurrentSemester(await getOrSeedSemesters(board.orgId))?.id === board.semesterId;
};

export const myTaskSelect = (userId: string) => ({
  id: true,
  title: true,
  isCompleted: true,
  dueDate: true,
  updatedAt: true,
  listId: true,
  course: { select: { id: true, name: true, code: true, color: true } },
  labels: { select: { labelId: true }, orderBy: { createdAt: "asc" as const } },
  list: {
    select: {
      board: { select: { id: true, title: true, boardType: true } },
    },
  },
  assignees: {
    where: { boardMember: { role: { not: BoardMemberRole.VIEWER } } },
    select: { boardMember: { select: { id: true, userId: true, userName: true, userImage: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  userStates: { where: { userId }, select: { isImportant: true, myDayAt: true } },
  checklists: { select: { items: { select: { isCompleted: true } } } },
}) satisfies Prisma.CardSelect;

export type MyTaskRow = Prisma.CardGetPayload<{ select: ReturnType<typeof myTaskSelect> }>;

type BucketRow = BucketTask & { dto: MyTask };

const toBucketRow = (row: MyTaskRow): BucketRow => {
  const state = row.userStates[0];
  const board = row.list.board;
  const checklistItems = row.checklists.flatMap((checklist) => checklist.items);

  return {
    id: row.id,
    dueDate: row.dueDate,
    isCompleted: row.isCompleted,
    updatedAt: row.updatedAt,
    myDayAt: state?.myDayAt ?? null,
    dto: {
      id: row.id,
      title: row.title,
      isCompleted: row.isCompleted,
      dueDate: row.dueDate?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      myDayAt: state?.myDayAt?.toISOString() ?? null,
      isImportant: state?.isImportant ?? false,
      boardId: board.id,
      boardTitle: board.title,
      boardType: board.boardType,
      listId: row.listId,
      labelIds: row.labels.map((label) => label.labelId),
      course: row.course,
      assignees: row.assignees.map(({ boardMember }) => ({
        boardMemberId: boardMember.id,
        userId: boardMember.userId,
        userName: boardMember.userName,
        userImage: boardMember.userImage,
      })),
      checklist: {
        total: checklistItems.length,
        completed: checklistItems.filter((item) => item.isCompleted).length,
      },
    },
  };
};

export const toMyTaskDTO = (row: MyTaskRow): MyTask => toBucketRow(row).dto;

const toGroupDTO = (group: TaskGroup<BucketRow>) => ({
  key: group.key,
  label: group.label,
  ...(group.collapsed ? { collapsed: true } : {}),
  tasks: group.tasks.map((task) => task.dto),
});

/** Dữ liệu tab Việc cần làm. Gọi sau khi đã kiểm tra user là thành viên bảng. */
export const getTodoTasks = async ({
  userId,
  boardId,
  now = new Date(),
}: {
  userId: string;
  boardId: string;
  now?: Date;
}): Promise<TaskListResponse> => {
  const includeTeam = await isCurrentSemesterBoard(boardId);
  const { startOfToday } = getTodayWindow(now);
  const rows = await db.card.findMany({
    where: {
      AND: [
        buildTodoBaseWhere({ userId, boardId, includeTeam }),
        {
          OR: [
            { isCompleted: false },
            { isCompleted: true, updatedAt: { gte: startOfToday } },
          ],
        },
      ],
    },
    select: myTaskSelect(userId),
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: MAX_TASKS,
  });

  return {
    groups: groupAgendaTasks(rows.map(toBucketRow), now).map(toGroupDTO),
    suggestions: [],
  };
};
