import { byDueAsc, type TaskGroup } from "@/lib/my-tasks/buckets";
import { addVNDays, getEndOfVNDay, getVNDay, getVNWeekday } from "@/lib/my-tasks/vn-day";

export const UNASSIGNED_KEY = "unassigned";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DONE_DAYS = 7;

export type TeamTaskLike = {
  id: string;
  dueDate: Date | null;
  isCompleted: boolean;
  updatedAt: Date;
  boardId: string;
  boardTitle: string;
  assigneeUserIds: string[];
};

export type TeamMemberLite = {
  userId: string;
  name: string;
  imageUrl: string;
};

export type TeamStatusFilter = "open" | "done" | "overdue";
export type TeamGroupBy = "board" | "member" | "status";

export type TeamTaskFilters = {
  boardId?: string | null;
  memberId?: string | null;
  status?: TeamStatusFilter | null;
};

export type WorkloadRow = TeamMemberLite & {
  open: number;
  overdue: number;
  doneLast7Days: number;
  /** 0..1 so với thành viên nhiều việc mở nhất */
  load: number;
};

export type TeamStats = {
  total: number;
  completed: number;
  overdue: number;
  dueThisWeek: number;
  unscheduled: number;
};

const isOverdue = (task: TeamTaskLike, now: Date) =>
  !task.isCompleted && task.dueDate !== null && task.dueDate < now;

/** 23:59:59.999 giờ VN của Chủ nhật tuần hiện tại (tuần bắt đầu thứ Hai). */
export const getEndOfVNWeek = (now: Date): Date => {
  const today = getVNDay(now);
  const daysToSunday = (7 - getVNWeekday(today)) % 7;

  return getEndOfVNDay(addVNDays(today, daysToSunday));
};

export const groupMineTasks = <T extends TeamTaskLike>(tasks: T[], now: Date): TaskGroup<T>[] => {
  const endOfWeek = getEndOfVNWeek(now);
  const open = tasks.filter((task) => !task.isCompleted);

  return [
    { key: "overdue", label: "Quá hạn", tasks: byDueAsc(open.filter((task) => isOverdue(task, now))) },
    {
      key: "this-week",
      label: "Tuần này",
      tasks: byDueAsc(open.filter((task) => task.dueDate !== null && task.dueDate >= now && task.dueDate <= endOfWeek)),
    },
    {
      key: "later",
      label: "Sau đó",
      tasks: byDueAsc(open.filter((task) => task.dueDate !== null && task.dueDate > endOfWeek)),
    },
    { key: "no-due", label: "Không hạn", tasks: open.filter((task) => task.dueDate === null) },
    {
      key: "done",
      label: "Đã xong",
      tasks: byDueAsc(tasks.filter((task) => task.isCompleted)),
      collapsed: true,
    },
  ];
};

export const filterTeamTasks = <T extends TeamTaskLike>(
  tasks: T[],
  { boardId, memberId, status }: TeamTaskFilters,
  now: Date,
): T[] =>
  tasks.filter((task) => {
    if (boardId && task.boardId !== boardId) return false;

    if (memberId === UNASSIGNED_KEY && task.assigneeUserIds.length > 0) return false;
    if (memberId && memberId !== UNASSIGNED_KEY && !task.assigneeUserIds.includes(memberId)) return false;

    if (status === "open" && task.isCompleted) return false;
    if (status === "done" && !task.isCompleted) return false;
    if (status === "overdue" && !isOverdue(task, now)) return false;

    return true;
  });

export const groupAllTeamTasks = <T extends TeamTaskLike>(
  tasks: T[],
  groupBy: TeamGroupBy,
  members: TeamMemberLite[],
  now: Date,
): TaskGroup<T>[] => {
  const sorted = byDueAsc(tasks);

  if (groupBy === "status") {
    return [
      { key: "overdue", label: "Quá hạn", tasks: sorted.filter((task) => isOverdue(task, now)) },
      { key: "open", label: "Đang mở", tasks: sorted.filter((task) => !task.isCompleted && !isOverdue(task, now)) },
      { key: "done", label: "Đã xong", tasks: sorted.filter((task) => task.isCompleted) },
    ].filter((group) => group.tasks.length > 0);
  }

  if (groupBy === "member") {
    const groups: TaskGroup<T>[] = members.map((member) => ({
      key: member.userId,
      label: member.name,
      tasks: sorted.filter((task) => task.assigneeUserIds.includes(member.userId)),
    }));

    groups.push({
      key: UNASSIGNED_KEY,
      label: "Chưa giao",
      tasks: sorted.filter((task) => task.assigneeUserIds.length === 0),
    });

    return groups.filter((group) => group.tasks.length > 0);
  }

  const byBoard = new Map<string, TaskGroup<T>>();

  for (const task of sorted) {
    if (!byBoard.has(task.boardId)) {
      byBoard.set(task.boardId, { key: task.boardId, label: task.boardTitle, tasks: [] });
    }

    byBoard.get(task.boardId)?.tasks.push(task);
  }

  return Array.from(byBoard.values()).sort((a, b) => a.label.localeCompare(b.label, "vi"));
};

export const computeWorkload = (
  tasks: TeamTaskLike[],
  members: TeamMemberLite[],
  now: Date,
): WorkloadRow[] => {
  const recentSince = new Date(now.getTime() - RECENT_DONE_DAYS * DAY_MS);

  const countFor = (matches: (task: TeamTaskLike) => boolean) => {
    const owned = tasks.filter(matches);

    return {
      open: owned.filter((task) => !task.isCompleted).length,
      overdue: owned.filter((task) => isOverdue(task, now)).length,
      doneLast7Days: owned.filter((task) => task.isCompleted && task.updatedAt >= recentSince).length,
    };
  };

  const rows = [
    ...members.map((member) => ({
      ...member,
      ...countFor((task) => task.assigneeUserIds.includes(member.userId)),
    })),
    {
      userId: UNASSIGNED_KEY,
      name: "Chưa giao",
      imageUrl: "",
      ...countFor((task) => task.assigneeUserIds.length === 0),
    },
  ];
  const maxOpen = Math.max(0, ...rows.slice(0, members.length).map((row) => row.open));

  return rows.map((row) => ({ ...row, load: maxOpen > 0 ? row.open / maxOpen : 0 }));
};

export const computeTeamStats = (tasks: TeamTaskLike[], now: Date): TeamStats => {
  const endOfWeek = getEndOfVNWeek(now);

  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.isCompleted).length,
    overdue: tasks.filter((task) => isOverdue(task, now)).length,
    dueThisWeek: tasks.filter(
      (task) => !task.isCompleted && task.dueDate !== null && task.dueDate >= now && task.dueDate <= endOfWeek,
    ).length,
    unscheduled: tasks.filter((task) => task.dueDate === null).length,
  };
};
