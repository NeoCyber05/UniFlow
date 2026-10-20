"use client";

import { useQuery } from "@tanstack/react-query";

import { fetcher } from "@/lib/fetcher";
import {
  cardContextQueryKey,
  MY_TASK_COUNTS_KEY,
  MY_TASKS_CONTEXT_KEY,
  todoTasksQueryKey,
  type CardContext,
  type MyTaskCounts,
  type MyTasksContext,
  type TaskListResponse,
} from "@/lib/my-tasks/types";

export const useTodoTasks = (boardId: string, initialData?: TaskListResponse, enabled = true) =>
  useQuery<TaskListResponse>({
    queryKey: todoTasksQueryKey(boardId),
    queryFn: () => fetcher(`/api/my-tasks?boardId=${boardId}`),
    initialData,
    enabled,
  });

export const useMyTaskCounts = () =>
  useQuery<MyTaskCounts>({
    queryKey: MY_TASK_COUNTS_KEY,
    queryFn: () => fetcher("/api/my-tasks/counts"),
  });

export const useMyTasksContext = () =>
  useQuery<MyTasksContext>({
    queryKey: MY_TASKS_CONTEXT_KEY,
    queryFn: () => fetcher("/api/my-tasks/context"),
    staleTime: 5 * 60_000,
  });

export const useCardContext = (cardId: string | null) =>
  useQuery<CardContext>({
    queryKey: cardContextQueryKey(cardId ?? ""),
    queryFn: () => fetcher(`/api/cards/${cardId}/context`),
    enabled: Boolean(cardId),
  });
