"use client";

import type { BoardCoursesResponse } from "@/lib/courses/board-courses";
import { useBoardCourses } from "@/hooks/use-board-courses";

/** Nạp sẵn cache môn từ server để card/timeline/lịch có màu ngay lần render đầu. */
export const BoardCoursesHydrator = ({
  boardId,
  initialData,
}: {
  boardId: string;
  initialData: BoardCoursesResponse;
}) => {
  useBoardCourses(boardId, initialData);

  return null;
};
