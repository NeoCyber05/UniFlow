"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetcher } from "@/lib/fetcher";
import type { BoardCourse, BoardCoursesResponse } from "@/lib/courses/board-courses";

const EMPTY_COURSES: BoardCourse[] = [];

export const boardCoursesQueryKey = (boardId: string) => ["courses", boardId] as const;

/**
 * Nguồn dữ liệu môn duy nhất phía client. Card modal mount ngoài board layout
 * nên không dùng React context; cache react-query được layout nạp sẵn.
 */
export const useBoardCourses = (
  boardId: string | null | undefined,
  initialData?: BoardCoursesResponse,
) => {
  const query = useQuery<BoardCoursesResponse>({
    queryKey: boardCoursesQueryKey(boardId ?? ""),
    queryFn: () => fetcher(`/api/boards/${boardId}/courses`),
    enabled: Boolean(boardId),
    initialData,
    staleTime: 60_000,
  });

  const courses = query.data?.courses ?? EMPTY_COURSES;
  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  return {
    courses,
    courseById,
    isSemesterBoard: query.data?.boardType === "SEMESTER",
    isLoading: query.isLoading,
  };
};

export const useBoardCourse = (
  boardId: string | null | undefined,
  courseId: string | null | undefined,
) => {
  const { courseById } = useBoardCourses(boardId);

  return courseId ? courseById.get(courseId) ?? null : null;
};
