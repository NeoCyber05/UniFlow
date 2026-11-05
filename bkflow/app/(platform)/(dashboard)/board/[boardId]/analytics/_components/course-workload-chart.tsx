"use client";

import { getCourseColor } from "@/lib/courses/course-colors";
import { tr } from "@/lib/i18n";

import type { CoursePoint } from "../_types";
import { BarLegend, BarList } from "./bar-list";
import { EmptyState } from "./empty-state";

export const CourseWorkloadChart = ({ data }: { data: CoursePoint[] }) => {
  const segments = [
    { key: "completed", label: tr("analytics.courseWorkload.segCompleted"), className: "bg-emerald-500" },
    { key: "open", label: tr("analytics.courseWorkload.segOpen"), className: "bg-blue-500" },
    { key: "overdue", label: tr("analytics.courseWorkload.segOverdue"), className: "bg-rose-500" },
  ] as const;

  const total = (item: CoursePoint) => item.completed + item.open + item.overdue;
  const courses = data.filter((item) => total(item) > 0).sort((left, right) => total(right) - total(left));

  if (courses.length === 0) {
    return <EmptyState label={tr("analytics.courseWorkload.empty")} />;
  }

  const emptyCount = data.length - courses.length;

  return (
    <div>
      <BarLegend segments={[...segments]} />
      <BarList
        items={courses.map((item) => ({
          key: item.id,
          name: item.id === "personal" && item.name === "Cá nhân" ? tr("analytics.personal") : item.name,
          dotClassName: getCourseColor(item.color).dot,
          segments: segments.map((segment) => ({ ...segment, value: item[segment.key] })),
        }))}
      />
      {emptyCount > 0 && (
        <p className="mt-2 px-2 text-xs text-neutral-400">
          {tr("analytics.courseWorkload.emptyCoursesCount", { count: emptyCount })}
        </p>
      )}
    </div>
  );
};
