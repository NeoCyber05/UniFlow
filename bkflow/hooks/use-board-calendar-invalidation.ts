"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";

export const useBoardCalendarInvalidation = (boardId?: string | null) => {
  const queryClient = useQueryClient();

  return useCallback(() => {
    // Mọi thay đổi task từ detail/lịch phải làm mới danh sách Công việc dùng chung.
    queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });

    if (!boardId) {
      return;
    }

    queryClient.invalidateQueries({
      queryKey: ["board-calendar", boardId],
    });
  }, [boardId, queryClient]);
};
