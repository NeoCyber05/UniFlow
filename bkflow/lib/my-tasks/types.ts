import type { BoardCourse } from "@/lib/courses/board-courses";

/** Thẻ đã serialize để gửi xuống client (ngày là ISO string). */
export type MyTask = {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: string | null;
  updatedAt: string;
  myDayAt: string | null;
  isImportant: boolean;
  boardId: string;
  boardTitle: string;
  boardType: "SEMESTER" | "TEAM_PROJECT";
  listId: string;
  labelIds: string[];
  course: { id: string; name: string; code: string | null; color: string } | null;
  assignees: { boardMemberId: string; userId: string; userName: string; userImage: string }[];
  checklist: { total: number; completed: number };
};

export type MyTaskGroup = {
  key: string;
  label: string;
  collapsed?: boolean;
  tasks: MyTask[];
};

/** Danh sách nhóm việc (tab Việc cần làm hoặc List view của bảng) — dùng cho cập nhật lạc quan */
export type TaskListResponse = {
  groups: MyTaskGroup[];
  /** Luôn rỗng; giữ cho tương thích cache cũ */
  suggestions: MyTask[];
};

export type MyTaskCounts = {
  /** Quá hạn + Hôm nay trên bảng kỳ hiện tại (+ việc nhóm giao cho mình) */
  today: number;
  /** Số việc chưa xong theo môn của bảng kỳ hiện tại; key "none" = Cá nhân */
  byCourse: Record<string, number>;
};

export type SerializedSemester = {
  id: string;
  userId: string;
  orgId?: string;
  title: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MyTasksContext = {
  personalOrgId: string | null;
  semesters: SerializedSemester[];
  currentSemesterId: string | null;
  /** Bảng kỳ hiện tại (tạo lười nếu chưa có); null khi chưa có học kỳ */
  board: {
    id: string;
    lists: { id: string; title: string }[];
    members: { id: string; userId: string; userName: string; userEmail: string | null; role: "ADMIN" | "MEMBER" | "VIEWER" }[];
    labels: { id: string; title: string; color: string }[];
  } | null;
  courses: BoardCourse[];
};

export type CardContext = {
  cardId: string;
  title: string;
  boardId: string;
  boardTitle: string;
  userId: string;
  orgId?: string;
  isImportant: boolean;
  myDayAt: string | null;
};

export const MY_TASKS_ROOT_KEY = ["my-tasks"] as const;
export const todoTasksQueryKey = (boardId: string) => ["my-tasks", "todo", boardId] as const;
export const MY_TASK_COUNTS_KEY = ["my-tasks", "counts"] as const;
export const MY_TASKS_CONTEXT_KEY = ["my-tasks", "context"] as const;
export const cardContextQueryKey = (cardId: string) => ["card-context", cardId] as const;
export const boardTasksQueryKey = (boardId: string) => ["my-tasks", "board", boardId] as const;
