"use client";

import Link from "@/web/shims/next-link";
import { getIntlLocale, tr } from "@/lib/i18n";
import { AlertTriangle, ArrowRight, BookOpen, CalendarClock, CalendarDays, CheckCheck, Clock, ListTodo, type LucideIcon, Plus, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCourseColor, getCourseShortLabel } from "@/lib/courses/course-colors";
import type { MessageKey } from "@/lib/i18n/messages/vi";
import { cn } from "@/lib/utils";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { buildTodayOverview, groupUpcomingByDay, type UpcomingDay } from "@/lib/my-tasks/today-overview";
import type { MyTask } from "@/lib/my-tasks/types";
import { getTaskDeadlineAt } from "@/lib/cards/task-deadline";
import { formatVNShortDate, isSameVNDay } from "@/lib/my-tasks/vn-day";
import { intlDateFormat } from "@/lib/i18n";
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
            <span className={`mt-1 block text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>{overdue ? tr("today.overduePrefix") : ""}{new Date(item.dueAt).toLocaleString(getIntlLocale(), { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" })} · {item.page.icon ? `${item.page.icon} ` : ""}{item.page.title}</span>
          </span>
        </Link>;
      })}
    </div>
  </section>;
};

const STAT_TONES = {
  neutral: { tile: "bg-muted text-foreground/70", frame: "", value: "" },
  warning: { tile: "bg-amber-500/10 text-amber-700 dark:text-amber-300", frame: "", value: "" },
  danger: { tile: "bg-destructive/10 text-destructive", frame: "border-destructive/30", value: "text-destructive" },
} as const;

/** Một ô số liệu trong khung Frame: icon có màu theo trạng thái, số, và một dòng phụ. */
const StatPanel = ({ icon: Icon, label, value, hint, tone, action }: {
  icon: LucideIcon; label: string; value: number; hint?: string; tone: keyof typeof STAT_TONES; action?: React.ReactNode;
}) => (
  <div className={cn("flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-3.5 sm:p-4", STAT_TONES[tone].frame)}>
    <span aria-hidden="true" className={cn("mb-1.5 flex size-7 items-center justify-center rounded-lg", STAT_TONES[tone].tile)}><Icon className="size-3.5" /></span>
    <dt className="truncate text-xs text-muted-foreground first-letter:uppercase">{label}</dt>
    <dd className={cn("text-2xl font-semibold tabular-nums tracking-tight", STAT_TONES[tone].value)}>{value}</dd>
    {hint || action ? <dd className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground"><span className="truncate">{hint}</span>{action}</dd> : null}
  </div>
);

const formatTime = (date: Date) => intlDateFormat({ timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
const WEEKDAY_KEYS: MessageKey[] = ["today.weekday.0", "today.weekday.1", "today.weekday.2", "today.weekday.3", "today.weekday.4", "today.weekday.5", "today.weekday.6"];

const dayLabel = (group: UpcomingDay<MyTask>) => {
  const date = `${group.day.day}/${group.day.month + 1}`;
  const weekday = tr(WEEKDAY_KEYS[group.weekday]);
  if (group.offset === 0) return tr("today.timeline.today", { weekday, date });
  if (group.offset === 1) return tr("today.timeline.tomorrow", { weekday, date });
  return tr("today.timeline.day", { weekday, date });
};

/** "Sắp đến hạn" dạng dòng thời gian chia theo ngày; giờ ở cột trái, nhãn môn bên phải. */
const UpcomingTimeline = ({ tasks, now, onOpen, boardId }: { tasks: MyTask[]; now: Date; onOpen: (id: string) => void; boardId: string }) => {
  const { days, rest } = groupUpcomingByDay(tasks, now, 5);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
      <ol className="relative space-y-4 border-l border-border pl-5">
        {days.map((group) => (
          <li key={group.key} className="relative space-y-1.5">
            <span aria-hidden="true" className={cn("absolute -left-[26px] top-1 size-2.5 rounded-full ring-4 ring-card", group.offset === 0 ? "bg-amber-500" : "border-2 border-muted-foreground/50 bg-card")} />
            <p className={cn("text-xs font-semibold", group.offset === 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>{dayLabel(group)}</p>
            <ul className="space-y-0.5">
              {group.tasks.map((task) => {
                const due = getTaskDeadlineAt(task)!;
                const color = task.course ? getCourseColor(task.course.color) : null;
                return (
                  <li key={task.id}>
                    <button type="button" onClick={() => onOpen(task.id)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring">
                      <span className={cn("w-10 shrink-0 font-mono text-xs tabular-nums", group.offset === 0 ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{task.dueDate ? formatTime(due) : "—"}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
                      <span className="task-chip shrink-0">
                        <span aria-hidden="true" className={cn("size-1.5 rounded-full", color ? color.dot : "bg-muted-foreground/50")} />
                        {task.course ? getCourseShortLabel(task.course) : tr("common.personal")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
      {rest > 0 ? (
        <Link href={`/board/${boardId}/calendar`} onClick={() => useBoardFilters.getState().clearFilters(boardId)} className="mt-3 inline-block text-xs font-medium text-violet-700 hover:underline dark:text-violet-300">
          {tr("today.timeline.more", { count: rest })}
        </Link>
      ) : null}
    </div>
  );
};

export const TodayView = ({ tasks, boardId, now, canEdit, onOpen, courses }: TodayViewProps) => {
  const overview = buildTodayOverview(tasks, now);
  const focus = overview.focus;
  const firstToday = overview.upcoming[0] && isSameVNDay(getTaskDeadlineAt(overview.upcoming[0])!, now) ? overview.upcoming[0] : null;

  return (
    <>
      <dl className="mb-7 grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/60 p-1.5 sm:gap-2 sm:p-2">
        <StatPanel icon={ListTodo} tone="neutral" label={tr("today.pendingCount")} value={overview.pending.length}
          hint={overview.attention.length ? tr("today.stat.attention", { count: overview.attention.length }) : undefined} />
        <StatPanel icon={Clock} tone={overview.dueToday ? "warning" : "neutral"} label={tr("today.dueTodayCount")} value={overview.dueToday}
          hint={firstToday ? tr("today.stat.earliest", { time: formatTime(getTaskDeadlineAt(firstToday)!) }) : tr("today.stat.noneToday")} />
        <StatPanel icon={AlertTriangle} tone={overview.overdue ? "danger" : "neutral"} label={tr("today.overdueCount")} value={overview.overdue}
          action={overview.overdue ? (
            <Link href={`/board/${boardId}/list`} onClick={() => useBoardFilters.getState().clearFilters(boardId)} className="font-medium text-destructive hover:underline">{tr("today.stat.view")}</Link>
          ) : undefined} />
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
          {overview.attention.length === 0 && (
            <EmptyState
              icon={CheckCheck}
              title={tr("today.attentionEmptyTitle")}
              description={tr("today.attentionEmpty")}
              actions={<>
                {canEdit ? (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => document.querySelector<HTMLElement>("#today-quick-add :is(input, textarea)")?.focus()}>
                    <Plus className="size-3.5" />{tr("today.emptyAdd")}
                  </Button>
                ) : null}
                <Button asChild variant="ghost" size="sm" className="gap-1.5 text-violet-700 hover:bg-violet-500/10 hover:text-violet-800 dark:text-violet-300">
                  <Link href={`/assistant?q=${encodeURIComponent(tr("today.emptyAskPrompt"))}`}><Sparkles className="size-3.5" />{tr("today.emptyAsk")}</Link>
                </Button>
              </>}
            />
          )}
          <div id="today-quick-add" className="mt-4"><QuickAddBar boardId={boardId} courses={courses} defaults={{ myDayWhenNoDue: true }} disabled={!canEdit} disabledHint={tr("today.readOnlyWorkspace")} placeholder={tr("today.quickAddPlaceholder")} /></div>
        </section>
        <section aria-labelledby="upcoming-heading">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 id="upcoming-heading" className="text-sm font-semibold">{tr("today.upcoming")}</h2><Link href={`/board/${boardId}/calendar`} onClick={() => useBoardFilters.getState().clearFilters(boardId)} className="workspace-text-link">{tr("today.openCalendar")}<ArrowRight aria-hidden="true" className="size-3.5" /></Link></div>
          {overview.upcoming.length > 0
            ? <UpcomingTimeline tasks={overview.upcoming} now={now} onOpen={onOpen} boardId={boardId} />
            : <EmptyState icon={CalendarDays} title={tr("today.upcomingEmptyTitle")} description={tr("today.upcomingEmpty")} />}
          <NoteDeadlines now={now} />
        </section>
      </div>
    </>
  );
};
