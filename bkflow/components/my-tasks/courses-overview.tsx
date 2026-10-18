"use client";

import Link from "@/web/shims/next-link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";

import { CourseManagerDialog } from "@/components/courses/course-manager-dialog";
import { Button } from "@/components/ui/button";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { getCourseColor } from "@/lib/courses/course-colors";
import type { BoardCourse } from "@/lib/courses/board-courses";
import { MY_TASKS_CONTEXT_KEY, type MyTask } from "@/lib/my-tasks/types";

export const CoursesOverview = ({ boardId, courses, tasks, canEdit }: { boardId: string; courses: BoardCourse[]; tasks: MyTask[]; canEdit: boolean }) => {
  const [manageOpen, setManageOpen] = useState(false);
  const queryClient = useQueryClient();
  const clearFilters = useBoardFilters(state => state.clearFilters);

  return <>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Bài tập, tài liệu và lịch học của từng môn.</p>{canEdit && <Button variant="outline" onClick={() => setManageOpen(true)} className="gap-2"><Plus aria-hidden="true" className="size-4" />Quản lý học phần</Button>}</div>
    {courses.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses.map(course => {
      const count = tasks.filter(task => task.course?.id === course.id && !task.isCompleted).length;
      const color = getCourseColor(course.color);
      return <Link key={course.id} href={`/board/${boardId}/list?course=${encodeURIComponent(course.id)}`} onClick={() => clearFilters(boardId)} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500">
        <div className={`mb-5 flex h-20 items-center justify-center rounded-lg ${color.chip}`}><BookOpen aria-hidden="true" className="size-7" strokeWidth={1.3} /></div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{course.code || "Học phần"}</p><h2 className="mt-2 text-base font-medium group-hover:text-violet-700">{course.name}</h2><p className="mt-3 text-xs text-muted-foreground">{count} việc chưa xong{course.credits !== null ? ` · ${course.credits} tín chỉ` : ""}</p>
      </Link>;
    })}</div> : <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center"><BookOpen aria-hidden="true" className="mx-auto mb-4 size-8 text-muted-foreground" /><h2 className="font-medium">Mỗi môn, một góc học tập.</h2><p className="mt-2 text-sm text-muted-foreground">Thêm học phần để sắp xếp công việc theo môn.</p>{canEdit && <Button className="mt-5" onClick={() => setManageOpen(true)}>Thêm học phần đầu tiên</Button>}</div>}
    <CourseManagerDialog boardId={boardId} open={manageOpen} onOpenChange={open => { setManageOpen(open); if (!open) void queryClient.invalidateQueries({ queryKey: MY_TASKS_CONTEXT_KEY }); }} />
  </>;
};
