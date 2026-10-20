"use client";

import { useMemo, useState } from "react";
import { tr } from "@/lib/i18n";
import { Check, Plus, Search } from "lucide-react";

import { customCourseId, isCourseRef, parseCourseRef } from "@/lib/courses/hust-catalog";
import { toSearchKey } from "@/lib/my-tasks/parse-quick-add";
import { cn } from "@/lib/utils";

type PickerCourse = { id: string; name: string; code: string | null };

/** Nhãn ngắn cho id môn, kể cả id ảo `custom:` chưa có trong danh sách. */
export const getCourseOptionLabel = (courses: PickerCourse[] | undefined, id: string | null | undefined) => {
  if (!id) return null;
  const course = courses?.find((item) => item.id === id);
  return course ? course.code ?? course.name : parseCourseRef(id)?.name ?? null;
};

/**
 * Chọn môn trong danh sách dài (môn của kỳ + ~80 môn danh mục): ô tìm không dấu,
 * nhóm "Trong học kỳ" trước "Danh mục HUST", dòng cuối tạo loại tự đặt.
 */
export const CoursePicker = ({
  courses,
  value,
  onChange,
  noneLabel = tr("course.none"),
}: {
  courses: PickerCourse[];
  value: string | null;
  onChange: (courseId: string | null) => void;
  noneLabel?: string;
}) => {
  const [query, setQuery] = useState("");
  const key = toSearchKey(query);
  const trimmed = query.replace(/\s+/g, " ").trim();

  const { inSemester, catalog } = useMemo(() => {
    const matched = key
      ? courses.filter((course) => toSearchKey(`${course.code ?? ""} ${course.name}`).includes(key))
      : courses;
    return {
      inSemester: matched.filter((course) => !isCourseRef(course.id)),
      catalog: matched.filter((course) => isCourseRef(course.id)),
    };
  }, [courses, key]);

  const canCreate = trimmed.length > 0 && !courses.some((course) => toSearchKey(course.name) === key || (course.code && toSearchKey(course.code) === key));
  const first = inSemester[0] ?? catalog[0];

  const row = (course: PickerCourse) => (
    <li key={course.id}>
      <button
        type="button"
        onClick={() => onChange(course.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-neutral-100",
          value === course.id && "bg-violet-50 text-violet-800",
        )}
      >
        {course.code && <span className="w-16 shrink-0 font-mono text-[11px] text-neutral-500">{course.code}</span>}
        <span className="min-w-0 flex-1 truncate" title={course.name}>{course.name}</span>
        {value === course.id && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      </button>
    </li>
  );

  const group = (label: string, items: PickerCourse[]) => items.length > 0 && (
    <div>
      <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
      <ul>{items.map(row)}</ul>
    </div>
  );

  return (
    <div className="w-72 max-w-[calc(100vw-2rem)]">
      <label className="flex items-center gap-2 border-b border-neutral-100 px-2 pb-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (first) onChange(first.id);
            else if (canCreate) onChange(customCourseId(trimmed));
          }}
          placeholder={tr("course.pickSearch")}
          aria-label={tr("course.pickLabel")}
          className="w-full bg-transparent text-xs outline-none placeholder:text-neutral-400"
        />
      </label>
      <div className="max-h-72 overflow-y-auto py-1">
        {!key && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-neutral-100", !value && "bg-violet-50 text-violet-800")}
          >
            {noneLabel}
          </button>
        )}
        {group(tr("course.inSemesterGroup"), inSemester)}
        {group(tr("course.hustGroup"), catalog)}
        {canCreate && (
          <button
            type="button"
            onClick={() => onChange(customCourseId(trimmed))}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-violet-700 hover:bg-violet-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {tr("course.createType", { name: trimmed })}
          </button>
        )}
        {!first && !canCreate && <p className="px-2 py-3 text-center text-xs text-neutral-400">{tr("course.noMatch")}</p>}
      </div>
    </div>
  );
};
