"use client";

import { getCourseColor } from "@/lib/courses/course-colors";

import type { CoursePoint } from "../_types";
import { BarLegend, BarList } from "./bar-list";
import { EmptyState } from "./empty-state";

const SEGMENTS = [
  { key: "completed", label: "Hoàn thành", className: "bg-emerald-500" },
  { key: "open", label: "Đang mở", className: "bg-blue-500" },
  { key: "overdue", label: "Quá hạn", className: "bg-rose-500" },
] as const;

export const CourseWorkloadChart = ({ data }: { data: CoursePoint[] }) => {
  const total = (item: CoursePoint) => item.completed + item.open + item.overdue;
  const courses = data.filter((item) => total(item) > 0).sort((left, right) => total(right) - total(left));

  if (courses.length === 0) {
    return <EmptyState label="Chưa có thẻ nào gắn danh mục." />;
  }

  const emptyCount = data.length - courses.length;

  return (
    <div>
      <BarLegend segments={[...SEGMENTS]} />
      <BarList
        items={courses.map((item) => ({
          key: item.id,
          name: item.name,
          dotClassName: getCourseColor(item.color).dot,
          segments: SEGMENTS.map((segment) => ({ ...segment, value: item[segment.key] })),
        }))}
      />
      {emptyCount > 0 && (
        <p className="mt-2 px-2 text-xs text-neutral-400">+{emptyCount} danh mục chưa có thẻ</p>
      )}
    </div>
  );
};
