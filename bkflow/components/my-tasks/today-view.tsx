"use client";

import Link from "@/web/shims/next-link";
import { tr } from "@/lib/i18n";
import { ArrowRight, BookOpen, CalendarClock, CalendarDays, CheckCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";

import { Button } from "@/components/ui/button";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { buildTodayOverview } from "@/lib/my-tasks/today-overview";
import type { MyTask } from "@/lib/my-tasks/types";
import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";
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

type NoteDeadlineItem = { blockId: string; title: string; dueAt: string; pageId: string; page: { title: string; icon: string | null } };

const NoteDeadlines = ({ now }: { now: Date }) => {
  const { data } = useQuery<NoteDeadlineItem[]>({ queryKey: ["note-deadlines"], queryFn: () => fetcher("/api/note-deadlines") });
  if (!data?.length) return null;
  return <section aria-labelledby="note-deadlines-heading" className="mt-6">
    <h2 id="note-deadlines-heading" className="mb-3 text-sm font-semibold">{tr("today.noteDeadlines")}</h2>
    <div className="divide-y divide-border rounded-xl border border-border bg-card px-5">
      {data.slice(0, 6).map(item => {
        const overdue = new Date(item.dueAt).getTime() < now.getTime();
        return <Link key={`${item.pageId}:${item.blockId}`} href={`/pages/${encodeURIComponent(item.pageId)}`} className="flex gap-3 py-3 hover:text-violet-700">
          <CalendarClock aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${overdue ? "text-destructive" : "text-violet-600"}`} />
          <span className="min-w-0">
            <span className="block break-words text-sm font-medium">{item.title}</span>
            <span className={`mt-1 block text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>{overdue ? tr("today.overduePrefix") : ""}{new Date(item.dueAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" })} · {item.page.icon ? `${item.page.icon} ` : ""}{item.page.title}</span>
          </span>
        </Link>;
      })}
    </div>
  </section>;
};

export const TodayView = ({ tasks, boardId, now, canEdit, onOpen, courses }: TodayViewProps) => {
  const overview = buildTodayOverview(tasks, now);
  const focus = overview.focus;

  return (
    <>
      <dl className="mb-7 grid grid-cols-3 gap-4 border-b border-border pb-6">
        {[[overview.pending.length, tr("today.pendingCount")], [overview.dueToday, tr("today.dueTodayCount")], [overview.overdue, tr("today.overdueCount")]].map(([value, label]) => (
          <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tracking-tight">{value}</dd></div>
        ))}
      </dl>

      <section className="mb-8" aria-labelledby="focus-heading">
        <h2 id="focus-heading" className="mb-3 text-sm font-semibold">{tr("today.startHere")}</h2>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-violet-200 bg-violet-50/60 p-5 sm:p-6">
          {focus ? <>
            <BookOpen aria-hidden="true" className="size-8 shrink-0 text-violet-700" strokeWidth={1.3} />
            <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">{tr("today.nextTask")}</p><h3 className="mt-1 break-words text-base font-medium">{focus.title}</h3><p className="mt-2 text-xs text-muted-foreground">{focus.course?.code ?? focus.course?.name ?? tr("common.personal")}{getTaskDeadlineAt(focus) ? tr("today.deadlineSuffix", { date: formatVNShortDate(getTaskDeadlineAt(focus)!) }) : tr("today.noDueSuffix")}</p></div>
            <Button onClick={() => onOpen(focus.id)} className="gap-2">{tr("today.openTask")}<ArrowRight aria-hidden="true" className="size-4" /></Button>
          </> : <><CheckCheck aria-hidden="true" className="size-7 text-violet-700" /><div><h3 className="font-medium">{tr("today.noTasks")}</h3></div></>}
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(250px,1fr)]">
        <section aria-labelledby="attention-heading">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 id="attention-heading" className="text-sm font-semibold">{tr("today.attention")}<span className="ml-1 font-normal text-muted-foreground">{overview.attention.length}</span></h2><Link href={`/board/${boardId}/list`} onClick={() => useBoardFilters.getState().clearFilters(boardId)} className="workspace-text-link">{tr("today.viewAll")}<ArrowRight aria-hidden="true" className="size-3.5" /></Link></div>
          <div className="space-y-2">{overview.attention.slice(0, 8).map(task => <TaskRow key={task.id} task={task} onOpen={onOpen} />)}</div>
          {overview.attention.length === 0 && <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">{tr("today.attentionEmpty")}</p>}
          <div className="mt-4"><QuickAddBar boardId={boardId} courses={courses} defaults={{ myDayWhenNoDue: true }} disabled={!canEdit} disabledHint={tr("today.readOnlyWorkspace")} placeholder={tr("today.quickAddPlaceholder")} /></div>
        </section>
        <section aria-labelledby="upcoming-heading">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 id="upcoming-heading" className="text-sm font-semibold">{tr("today.upcoming")}</h2><Link href={`/board/${boardId}/calendar`} onClick={() => useBoardFilters.getState().clearFilters(boardId)} className="workspace-text-link">{tr("today.openCalendar")}<ArrowRight aria-hidden="true" className="size-3.5" /></Link></div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card px-5">
            {overview.upcoming.slice(0, 5).map(task => <button key={task.id} onClick={() => onOpen(task.id)} className="flex w-full gap-3 py-4 text-left hover:text-violet-700"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-600" /><span className="min-w-0"><span className="block break-words text-sm font-medium">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{formatVNShortDate(getTaskDeadlineAt(task)!)} · {task.course?.code ?? task.course?.name ?? tr("common.personal")}</span></span></button>)}
            {overview.upcoming.length === 0 && <p className="py-6 text-sm text-muted-foreground">{tr("today.upcomingEmpty")}</p>}
          </div>
          <NoteDeadlines now={now} />
        </section>
      </div>
    </>
  );
};
