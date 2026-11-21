"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { invalidateTaskWrite } from "@/lib/invalidate-after-write";

export const useBoardCalendarInvalidation = (boardId: string) => {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void invalidateTaskWrite(queryClient, boardId, { counts: true });
  }, [boardId, queryClient]);
};
