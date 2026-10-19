"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/web/shims/next-navigation";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { BoardAssistant } from "@/components/ai-assistant/board-assistant";
import { AppearancePopover } from "@/components/appearance-popover";
import { Button } from "@/components/ui/button";
import { useTodoTasks } from "@/hooks/use-my-tasks";
import { useBoardCourses } from "@/hooks/use-board-courses";
import { fetcher } from "@/lib/fetcher";
import { MY_TASKS_CONTEXT_KEY, type MyTasksContext, type TaskListResponse } from "@/lib/my-tasks/types";
import { TaskDetailPanel } from "./task-detail-panel";
import { TodayView } from "./today-view";

export const PersonalWorkspaceView = ({ initialContext, initialData, initialNow, canEdit, error }: {
  initialContext: MyTasksContext; initialData: TaskListResponse; initialNow: string; canEdit: boolean; error?: string;
}) => {
  const router = useRouter();
  const { data: context = initialContext } = useQuery<MyTasksContext>({ queryKey: MY_TASKS_CONTEXT_KEY, queryFn: () => fetcher("/api/my-tasks/context"), initialData: initialContext, staleTime: 5 * 60_000 });
  const boardId = initialContext.board!.id;
  const { courseOptions: courses } = useBoardCourses(boardId, { boardType: "SEMESTER", courses: initialContext.courses });
  const { data = initialData, isError, refetch, isFetching } = useTodoTasks(boardId, initialData);
  const [taskId, openTask] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => { const interval = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(interval); }, []);
  const semesterChanged = context.board?.id !== boardId;
  useEffect(() => { if (semesterChanged) router.refresh(); }, [semesterChanged, router]);
  const tasks = data.groups.flatMap(group => group.tasks);

  // Re-enter the server route to authorize the new semester before showing its editable data.
  if (semesterChanged) return <p role="status" className="py-12 text-center text-sm text-muted-foreground">Đang chuyển học kỳ…</p>;

  return <div className="personal-workspace mx-auto w-full max-w-6xl">
    <header className="mb-7 flex items-start justify-between gap-4">
      <div><p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{now.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" })}</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Hôm nay</h1></div>
      <div className="flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon" disabled={isFetching} onClick={() => void refetch()} aria-label="Làm mới công việc"><RefreshCw aria-hidden="true" className={`size-4 ${isFetching ? "animate-spin" : ""}`} /></Button><AppearancePopover /></div>
    </header>
    {error && <p role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {isError && <div role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Chưa làm mới được công việc. Đang hiển thị dữ liệu đã tải. <button className="underline" onClick={() => void refetch()}>Thử lại</button></div>}
    <TodayView tasks={tasks} boardId={boardId} now={now} canEdit={canEdit} courses={courses} onOpen={openTask} />
    {taskId && <TaskDetailPanel taskId={taskId} onClose={() => openTask(null)} desktopClassName="fixed right-4 top-16 z-40 h-[calc(100dvh-5rem)] max-w-[calc(100vw-2rem)] shadow-xl" />}
    <BoardAssistant boardId={boardId} />
  </div>;
};
