"use client";

import { useState } from "react";
import { usePathname } from "@/web/shims/next-navigation";
import { Plus, Settings2 } from "lucide-react";

import { useBoardCourses } from "@/hooks/use-board-courses";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { getCourseColor, getCourseShortLabel } from "@/lib/courses/course-colors";
import { cn } from "@/lib/utils";

import { CourseManagerDialog } from "./course-manager-dialog";

// Hằng ngoài component: selector zustand trả về mảng mới mỗi lần sẽ gây render vô hạn
const EMPTY_IDS: string[] = [];

const chipClassName = (isActive: boolean) =>
  cn(
    "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
    isActive
      ? "border-white bg-white text-neutral-900 shadow-sm"
      : "border-white/20 bg-white/10 text-white/90 hover:bg-white/20",
  );

type CourseFilterBarProps = {
  boardId: string;
  canEdit: boolean;
};

export const CourseFilterBar = ({ boardId, canEdit }: CourseFilterBarProps) => {
  const pathname = usePathname();
  const [managerOpen, setManagerOpen] = useState(false);
  const { courses } = useBoardCourses(boardId);
  const selectedCourseIds = useBoardFilters(
    (state) => state.filtersByBoardId[boardId]?.selectedCourseIds ?? EMPTY_IDS,
  );
  const toggleCourse = useBoardFilters((state) => state.toggleCourse);
  const setSelectedCourses = useBoardFilters((state) => state.setSelectedCourses);

  // Analytics tính ở server, không lọc theo môn
  if (pathname.endsWith("/analytics")) {
    return null;
  }

  return (
    <div className="relative shrink-0 z-[39] flex h-10 w-full items-center gap-1.5 overflow-x-auto bg-black/25 px-3 backdrop-blur-sm md:px-6">
      <button
        type="button"
        onClick={() => setSelectedCourses(boardId, [])}
        className={chipClassName(selectedCourseIds.length === 0)}
      >
        Tất cả
      </button>

      {courses.map((course) => (
        <button
          key={course.id}
          type="button"
          title={course.name}
          onClick={() => toggleCourse(boardId, course.id)}
          className={chipClassName(selectedCourseIds.includes(course.id))}
        >
          <span className={cn("h-2 w-2 rounded-full", getCourseColor(course.color).dot)} />
          {getCourseShortLabel(course)}
        </button>
      ))}

      <button
        type="button"
        onClick={() => toggleCourse(boardId, PERSONAL_COURSE_FILTER)}
        className={chipClassName(selectedCourseIds.includes(PERSONAL_COURSE_FILTER))}
      >
        <span className="h-2 w-2 rounded-full border border-current" />
        Cá nhân
      </button>

      {canEdit && (
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-white/90 hover:bg-white/20"
        >
          {courses.length === 0 ? <Plus className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
          {courses.length === 0 ? "Thêm môn học" : "Môn học"}
        </button>
      )}

      {canEdit && (
        <CourseManagerDialog
          boardId={boardId}
          open={managerOpen}
          onOpenChange={setManagerOpen}
        />
      )}
    </div>
  );
};
