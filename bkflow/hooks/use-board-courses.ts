"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetcher } from "@/lib/fetcher";
import type { BoardCourse, BoardCoursesResponse } from "@/lib/courses/board-courses";
import { withCatalogCourses } from "@/lib/courses/hust-catalog";

const EMPTY_COURSES: BoardCourse[] = [];

export const boardCoursesQueryKey = (boardId: string) => ["courses", boardId] as const;

const boardCoursesQueryOptions = (boardId: string | null | undefined) => ({
  queryKey: boardCoursesQueryKey(boardId ?? ""),
  queryFn: (): Promise<BoardCoursesResponse> => fetcher(`/api/boards/${boardId}/courses`),
  enabled: Boolean(boardId),
  staleTime: 60_000,
});

/**
 * Nguồn dữ liệu môn duy nhất phía client. Card modal mount ngoài board layout
 * nên không dùng React context; cache react-query được layout nạp sẵn.
 */
export const useBoardCourses = (
  boardId: string | null | undefined,
  initialData?: BoardCoursesResponse,
) => {
  const query = useQuery<BoardCoursesResponse>({ ...boardCoursesQueryOptions(boardId), initialData });

  const courses = query.data?.courses ?? EMPTY_COURSES;
  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const isWorkspaceBoard = query.data?.boardType === "WORKSPACE";
  // Lựa chọn khi gắn môn: bảng workspace có thêm danh mục HUST (id ảo, server tạo Course khi lưu)
  const courseOptions = useMemo(
    () => (isWorkspaceBoard ? withCatalogCourses(courses) : courses),
    [isWorkspaceBoard, courses],
  );

  return {
    courses,
    courseOptions,
    courseById,
    isWorkspaceBoard,
    isLoading: query.isLoading,
  };
};

// Gọi cho từng thẻ trên lịch/sơ đồ: chỉ tìm một môn, không dựng Map hay danh mục HUST cho mỗi thẻ
export const useBoardCourse = (
  boardId: string | null | undefined,
  courseId: string | null | undefined,
) => {
  const { data: course } = useQuery({
    ...boardCoursesQueryOptions(boardId),
    select: (data) => (courseId ? data.courses.find((item) => item.id === courseId) ?? null : null),
  });

  return course ?? null;
};
