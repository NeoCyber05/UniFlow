"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { setCardCompleted } from "@/actions/cards/set-card-completed";
import { toggleCardImportant } from "@/actions/cards/toggle-card-important";
import { toggleCardMyDay } from "@/actions/cards/toggle-card-my-day";
import {
  cardContextQueryKey,
  MY_TASKS_ROOT_KEY,
  type CardContext,
  type MyTask,
  type TaskListResponse,
} from "@/lib/my-tasks/types";

type TaskPatch = Partial<Pick<MyTask, "isCompleted" | "isImportant" | "myDayAt">>;

const isTaskListResponse = (data: unknown): data is TaskListResponse =>
  typeof data === "object" && data !== null && Array.isArray((data as TaskListResponse).groups);

const patchResponse = (data: unknown, cardId: string, patch: TaskPatch) => {
  const apply = (task: MyTask) => (task.id === cardId ? { ...task, ...patch } : task);

  if (isTaskListResponse(data)) {
    return {
      ...data,
      groups: data.groups.map((group) => ({ ...group, tasks: group.tasks.map(apply) })),
      suggestions: data.suggestions.map(apply),
    };
  }

  // Team overview: { boards, members, tasks }
  if (typeof data === "object" && data !== null && Array.isArray((data as { tasks?: unknown }).tasks)) {
    const withTasks = data as { tasks: MyTask[] };

    return { ...withTasks, tasks: withTasks.tasks.map(apply) };
  }

  return data;
};

/**
 * Tick / sao / ghim với cập nhật lạc quan trên mọi smart list đang cache.
 * Lỗi → hoàn tác + toast. Xong → refetch để nhóm lại.
 */
export const useMyTaskMutations = () => {
  const queryClient = useQueryClient();

  const run = useCallback(
    async (
      cardId: string,
      patch: TaskPatch,
      action: () => Promise<{ error?: string | null }>,
    ) => {
      await queryClient.cancelQueries({ queryKey: MY_TASKS_ROOT_KEY });

      const listSnapshot = queryClient.getQueriesData({ queryKey: MY_TASKS_ROOT_KEY });
      const contextKey = cardContextQueryKey(cardId);
      const contextSnapshot = queryClient.getQueryData<CardContext>(contextKey);

      queryClient.setQueriesData(
        { queryKey: MY_TASKS_ROOT_KEY },
        (data: unknown) => patchResponse(data, cardId, patch),
      );

      if (contextSnapshot) {
        const contextPatch = {
          ...(patch.isImportant !== undefined ? { isImportant: patch.isImportant } : {}),
          ...(patch.myDayAt !== undefined ? { myDayAt: patch.myDayAt } : {}),
        };
        queryClient.setQueryData<CardContext>(contextKey, { ...contextSnapshot, ...contextPatch });
      }

      const result = await action();

      if (result.error) {
        listSnapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
        if (contextSnapshot) queryClient.setQueryData(contextKey, contextSnapshot);
        toast.error(result.error);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY }),
        queryClient.invalidateQueries({ queryKey: ["card", cardId] }),
      ]);
    },
    [queryClient],
  );

  const setCompleted = useCallback(
    (cardId: string, value: boolean) =>
      run(cardId, { isCompleted: value }, () => setCardCompleted({ cardId, value })),
    [run],
  );

  const setImportant = useCallback(
    (cardId: string, value: boolean) =>
      run(cardId, { isImportant: value }, () => toggleCardImportant({ cardId, value })),
    [run],
  );

  const setMyDay = useCallback(
    (cardId: string, value: boolean) =>
      run(
        cardId,
        { myDayAt: value ? new Date().toISOString() : null },
        () => toggleCardMyDay({ cardId, value }),
      ),
    [run],
  );

  return { setCompleted, setImportant, setMyDay };
};
