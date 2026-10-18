import type { BoardFilterState } from "@/hooks/use-board-filters";

import { courseMatchesFilters, importantMatchesFilters } from "../boards/board-filters";
import type { MyTask } from "./types";

export type TodoFilterableTask = Pick<MyTask, "isImportant" | "boardType" | "course">;

/** Tab Việc cần làm chỉ áp lọc môn + ⭐. Việc nhóm không có môn → ẩn khi đang lọc môn. */
export const todoTaskMatchesFilters = (task: TodoFilterableTask, filters: BoardFilterState) => {
  if (!importantMatchesFilters(task.isImportant, filters)) return false;
  if (filters.selectedCourseIds.length === 0) return true;
  if (task.boardType === "TEAM_PROJECT") return false;

  return courseMatchesFilters(task.course?.id ?? null, filters);
};
