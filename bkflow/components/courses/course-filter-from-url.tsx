"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "@/web/shims/next-navigation";

import { useBoardFilters } from "@/hooks/use-board-filters";

/** `/board/<id>?course=<courseId|none>` (từ sidebar) → bật lọc môn rồi xoá param. */
export const CourseFilterFromUrl = ({ boardId }: { boardId: string }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setSelectedCourses = useBoardFilters((state) => state.setSelectedCourses);
  const course = searchParams.get("course");

  useEffect(() => {
    if (!course) return;

    setSelectedCourses(boardId, [course]);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("course");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [boardId, course, pathname, router, searchParams, setSelectedCourses]);

  return null;
};
