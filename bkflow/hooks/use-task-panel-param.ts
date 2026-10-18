"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "@/web/shims/next-navigation";

export const TASK_PANEL_PARAM = "task";

/** `?task=<cardId>` điều khiển panel chi tiết; giữ các query param khác. */
export const useTaskPanelParam = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams.get(TASK_PANEL_PARAM);

  const setTask = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (id) {
        params.set(TASK_PANEL_PARAM, id);
      } else {
        params.delete(TASK_PANEL_PARAM);
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openTask = useCallback((id: string) => setTask(id), [setTask]);
  const closeTask = useCallback(() => setTask(null), [setTask]);

  return { taskId, openTask, closeTask };
};
