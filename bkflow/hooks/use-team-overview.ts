"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetcher } from "@/lib/fetcher";
import type { MyTask } from "@/lib/my-tasks/types";
import type { TeamTaskLike } from "@/lib/team-tasks/workload";
import { teamOverviewQueryKey, type TeamOverviewResponse } from "@/lib/team-tasks/types";

/** MyTask + các trường Date để đưa vào hàm thuần của workload.ts */
export type TeamTask = MyTask & TeamTaskLike;

const toTeamTask = (task: MyTask): TeamTask =>
  ({
    ...task,
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    updatedAt: new Date(task.updatedAt),
    assigneeUserIds: task.assignees.map((assignee) => assignee.userId),
  }) as unknown as TeamTask;

/** Chuyển lại về MyTask (ISO string) để render bằng TaskRow */
export const toRowTask = (task: TeamTask): MyTask =>
  ({
    ...task,
    dueDate: task.dueDate ? (task.dueDate as unknown as Date).toISOString() : null,
    updatedAt: (task.updatedAt as unknown as Date).toISOString(),
  }) as MyTask;

export const useTeamOverview = (orgId: string | null | undefined, enabled = true) => {
  const query = useQuery<TeamOverviewResponse>({
    queryKey: teamOverviewQueryKey(orgId ?? ""),
    queryFn: () => fetcher(`/api/teams/${orgId}/overview`),
    enabled: Boolean(orgId) && enabled,
  });

  const tasks = useMemo(() => (query.data?.tasks ?? []).map(toTeamTask), [query.data?.tasks]);

  return { ...query, tasks };
};
