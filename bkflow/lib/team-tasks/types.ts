import type { MyTask } from "@/lib/my-tasks/types";

export type TeamBoardSummary = {
  id: string;
  title: string;
  openCount: number;
  /** Thành viên có thể giao việc (không gồm VIEWER) — cho cú pháp +tên */
  members: { userId: string; userName: string }[];
};

export type TeamOverviewResponse = {
  boards: TeamBoardSummary[];
  members: { userId: string; name: string; imageUrl: string }[];
  tasks: MyTask[];
};

export const teamOverviewQueryKey = (orgId: string) => ["my-tasks", "team", orgId] as const;
