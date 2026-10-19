import { serializeTaskDates } from "@/lib/cards/task-schedule-storage";
import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

import { groupAgendaTasks, type BucketTask, type TaskGroup } from "./buckets";
import type { MyTask, TaskListResponse } from "./types";
import { getEndOfVNDay, getStartOfVNDay, getVNDay } from "./vn-day";

const MAX_TASKS = 300;

/** Thẻ của một bảng kỳ. */
export const buildTodoBaseWhere = ({
  boardId,
}: {
  userId?: string;
  boardId: string;
  includeTeam?: boolean;
}): Prisma.CardWhereInput => ({
  archivedAt: null,
  list: {
    archivedAt: null,
    boardId,
  },
});

export const getTodayWindow = (now: Date) => {
  const today = getVNDay(now);

  return {
    startOfToday: getStartOfVNDay(today),
    endOfToday: getEndOfVNDay(today),
  };
};

export const myTaskSelect = (userId: string) => ({
  id: true,
  title: true,
  isCompleted: true,
  kind: true,
  dueDate: true,
  deadlineOn: true,
  scheduledOn: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  updatedAt: true,
  listId: true,
  course: { select: { id: true, name: true, code: true, color: true } },
  labels: {
    select: { labelId: true, label: { select: { id: true, title: true, color: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  list: {
    select: {
      board: { select: { id: true, title: true, boardType: true } },
    },
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
    deadlineOn: serializeTaskDates(row).deadlineOn,
    isCompleted: row.isCompleted,
    isEvent: row.kind === "EVENT",
    updatedAt: row.updatedAt,
    myDayAt: state?.myDayAt ?? null,
    dto: {
      id: row.id,
      title: row.title,
      isCompleted: row.isCompleted,
      kind: row.kind,
      ...serializeTaskDates(row),
      updatedAt: row.updatedAt.toISOString(),
      myDayAt: state?.myDayAt?.toISOString() ?? null,
      isImportant: state?.isImportant ?? false,
      boardId: board.id,
      boardTitle: board.title,
      boardType: board.boardType,
      listId: row.listId,
      labelIds: row.labels.map((label) => label.labelId),
      labels: row.labels.map(({ label }) => label),
      course: row.course,
      assignees: [],
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

/** Dữ liệu tab Việc cần làm. Gọi sau khi đã kiểm tra user là chủ bảng. */
export const getTodoTasks = async ({
  userId,
  boardId,
  now = new Date(),
}: {
  userId: string;
  boardId: string;
  now?: Date;
}): Promise<TaskListResponse> => {
  const { startOfToday, endOfToday } = getTodayWindow(now);
  const rows = await db.card.findMany({
    where: {
      AND: [
        buildTodoBaseWhere({ boardId }),
        {
          OR: [
            { isCompleted: false },
            { isCompleted: true, updatedAt: { gte: startOfToday } },
          ],
        },
        // Sự kiện (buổi học) chỉ hiện ngày diễn ra, không chiếm chỗ việc cần làm
        { OR: [{ kind: "TASK" }, { scheduledStartAt: { gte: startOfToday, lte: endOfToday } }] },
      ],
    },
    select: myTaskSelect(userId),
    orderBy: [{ dueDate: "asc" }, { deadlineOn: "asc" }, { createdAt: "asc" }],
    take: MAX_TASKS,
  });

  return {
    groups: groupAgendaTasks(rows.map(toBucketRow), now).map(toGroupDTO),
    suggestions: [],
  };
};
