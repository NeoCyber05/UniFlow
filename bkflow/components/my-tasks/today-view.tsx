"use client";

import Link from "@/web/shims/next-link";
import { ArrowRight, BookOpen, CalendarDays, CheckCheck, Leaf } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { buildTodayOverview } from "@/lib/my-tasks/today-overview";
import type { MyTask } from "@/lib/my-tasks/types";
import { formatVNShortDate } from "@/lib/my-tasks/vn-day";
import { QuickAddBar } from "./quick-add-bar";
import { TaskRow } from "./task-row";

type TodayViewProps = {
  tasks: MyTask[];
  boardId: string;
  now: Date;
  canEdit: boolean;
  onOpen: (id: string) => void;
  courses: { id: string; name: string; code: string | null }[];
};

export const TodayView = ({ tasks, boardId, now, canEdit, onOpen, courses }: TodayViewProps) => {
  const overview = buildTodayOverview(tasks, now);
  const focus = overview.focus;

  return (
    <>
      <div className="workspace-cover relative mb-7 overflow-hidden rounded-xl border border-violet-100 bg-violet-50 px-6 py-7 sm:px-8">
        <Leaf aria-hidden="true" className="absolute -right-5 -bottom-8 size-44 rotate-[-25deg] text-violet-200/70" strokeWidth={0.7} />
        <p className="relative text-lg font-medium leading-relaxed text-violet-950">Để việc học có chỗ,<br />và cuộc sống cũng vậy.</p>
        <p className="relative mt-2 text-xs text-violet-800">Một kế hoạch vừa sức hơn, bắt đầu từ hôm nay.</p>
      </div>

      <dl className="mb-7 grid grid-cols-3 gap-4 border-b border-border pb-6">
        {[[overview.pending.length, "việc chưa xong"], [overview.dueToday, "hạn còn lại hôm nay"], [overview.overdue, "việc quá hạn"]].map(([value, label]) => (
          <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tracking-tight">{value}</dd></div>
        ))}
      </dl>

      <section className="mb-8" aria-labelledby="focus-heading">
        <h2 id="focus-heading" className="mb-3 text-sm font-semibold">Bắt đầu từ đây</h2>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-violet-200 bg-violet-50/60 p-5 sm:p-6">
          {focus ? <>
            <BookOpen aria-hidden="true" className="size-8 shrink-0 text-violet-700" strokeWidth={1.3} />
            <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">Việc tiếp theo</p><h3 className="mt-1 break-words text-base font-medium">{focus.title}</h3><p className="mt-2 text-xs text-muted-foreground">{focus.course?.code ?? focus.course?.name ?? "Cá nhân"}{focus.dueDate ? ` · Hạn ${formatVNShortDate(new Date(focus.dueDate))}` : " · Chưa đặt hạn"}</p></div>
            <Button onClick={() => onOpen(focus.id)} className="gap-2">Mở công việc <ArrowRight aria-hidden="true" className="size-4" /></Button>
          </> : <><CheckCheck aria-hidden="true" className="size-7 text-violet-700" /><div><h3 className="font-medium">Một khoảng thở cho bạn.</h3><p className="mt-1 text-xs text-muted-foreground">Chưa có việc cần làm. Ghi lại một việc nhỏ bên dưới khi bạn sẵn sàng.</p></div></>}
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(250px,1fr)]">
        <section aria-labelledby="attention-heading">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 id="attention-heading" className="text-sm font-semibold">Việc cần quan tâm <span className="ml-1 font-normal text-muted-foreground">{overview.attention.length}</span></h2><Link href="/my/tasks" onClick={() => useBoardFilters.getState().clearFilters(boardId)} className="workspace-text-link">Xem tất cả <ArrowRight aria-hidden="true" className="size-3.5" /></Link></div>
          <div className="space-y-2">{overview.attention.slice(0, 8).map(task => <TaskRow key={task.id} task={task} onOpen={onOpen} />)}</div>
          {overview.attention.length === 0 && <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Không có việc quá hạn, quan trọng hoặc được ghim cho hôm nay.</p>}
          <div className="mt-4"><QuickAddBar boardId={boardId} courses={courses} defaults={{ myDayWhenNoDue: true }} disabled={!canEdit} disabledHint="Bạn chỉ có quyền xem học kỳ này." placeholder="Thêm việc… #môn @mai !" /></div>
        </section>
        <section aria-labelledby="upcoming-heading">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 id="upcoming-heading" className="text-sm font-semibold">Sắp đến hạn</h2><Link href="/my/calendar" onClick={() => useBoardFilters.getState().clearFilters(boardId)} className="workspace-text-link">Mở lịch <ArrowRight aria-hidden="true" className="size-3.5" /></Link></div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card px-5">
            {overview.upcoming.slice(0, 5).map(task => <button key={task.id} onClick={() => onOpen(task.id)} className="flex w-full gap-3 py-4 text-left hover:text-violet-700"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-600" /><span className="min-w-0"><span className="block break-words text-sm font-medium">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{formatVNShortDate(new Date(task.dueDate!))} · {task.course?.code ?? task.course?.name ?? "Cá nhân"}</span></span></button>)}
            {overview.upcoming.length === 0 && <p className="py-6 text-sm text-muted-foreground">Chưa có hạn sắp tới. Bạn có thể thêm hạn khi tạo công việc.</p>}
          </div>
          <div className="mt-5 rounded-xl bg-muted/60 p-5 text-xs leading-relaxed text-muted-foreground"><p className="font-medium text-foreground">Không cần lấp đầy mọi khoảng trống.</p><p className="mt-1">Giữ một chút thời gian dự phòng cũng là một kế hoạch tốt.</p></div>
        </section>
      </div>
    </>
  );
};
