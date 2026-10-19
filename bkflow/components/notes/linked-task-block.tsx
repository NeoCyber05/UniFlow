"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Link2, LoaderCircle, Search, Unlink } from "lucide-react";

import { useCardModal } from "@/hooks/use-card-modal";
import { useAuth } from "@/web/lib/auth";
import type { NoteBlock } from "@/lib/notes/blocks";
import type { LinkedTaskResult, LinkedTaskView } from "@/lib/notes/contract";
import type { WorkspaceSearchItem } from "@/lib/search/workspace-search";
import { cn } from "@/lib/utils";

export const LINKED_TASKS_KEY = ["note-linked-tasks"] as const;
export type PickedTask = { id: string; title: string; subtitle: string };

// Keyed by viewer + page; always re-checked on mount, focus and card-detail close (staleTime 0).
export const useLinkedTasks = (pageId: string) => {
  const { userId } = useAuth();
  return useQuery<LinkedTaskResult[]>({
    queryKey: [...LINKED_TASKS_KEY, userId, pageId], enabled: Boolean(userId), staleTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/pages/${encodeURIComponent(pageId)}/tasks`, { signal, cache: "no-store" });
      if (!response.ok) throw Object.assign(new Error("Cannot load linked tasks"), { status: response.status });
      return (await response.json() as { tasks: LinkedTaskResult[] }).tasks;
    },
  });
};

export const linkedTasksQueryState = (query: ReturnType<typeof useLinkedTasks>) => {
  const status = (query.error as (Error & { status?: number }) | null)?.status;
  return {
    results: query.data, fetching: query.isFetching || query.isPending,
    error: !query.error ? null : status === 401 || status === 403 || status === 404 ? "denied" as const : "network" as const,
  };
};

const formatDue = (task: Extract<LinkedTaskView, { state: "available" }>["task"]) => {
  if (task.dueDate) return new Date(task.dueDate).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
  if (task.deadlineOn) return new Date(`${task.deadlineOn}T00:00:00Z`).toLocaleDateString("vi-VN", { dateStyle: "medium", timeZone: "UTC" });
  return null;
};

const TaskPicker = ({ blockId, onChoose }: { blockId: string; onChoose: (task: PickedTask) => void }) => {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ items: PickedTask[]; loading: boolean; failed: boolean }>({ items: [], loading: false, failed: false });
  const term = query.trim();

  useEffect(() => {
    if (!term) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState(current => ({ ...current, loading: true, failed: false }));
      fetch(`/api/search?${new URLSearchParams({ q: term })}`, { signal: controller.signal, cache: "no-store" })
        .then(async response => {
          if (!response.ok) throw new Error("search failed");
          const { items } = await response.json() as { items: WorkspaceSearchItem[] };
          setState({ items: items.filter(item => item.type === "card").map(({ id, title, subtitle }) => ({ id, title, subtitle })), loading: false, failed: false });
        })
        .catch(() => { if (!controller.signal.aborted) setState({ items: [], loading: false, failed: true }); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  return <div className="min-w-0 flex-1">
    <label className="flex h-8 items-center gap-2 rounded-md border bg-background px-2 text-sm">
      <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      {/* data-block-input: the editor focuses it only right after the block is inserted. */}
      <input data-block-input={blockId} value={query} maxLength={100} onChange={event => setQuery(event.target.value)} placeholder="Tìm công việc để liên kết…" aria-label="Tìm công việc để liên kết" className="min-w-0 flex-1 bg-transparent outline-none" />
      {state.loading && <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-muted-foreground" />}
    </label>
    {term && !state.loading && <ul role="listbox" aria-label="Kết quả công việc" className="mt-1 max-h-60 overflow-y-auto">
      {state.failed ? <li className="px-2 py-1.5 text-sm text-muted-foreground">Chưa tìm được. Hãy thử lại.</li>
        : !state.items.length ? <li className="px-2 py-1.5 text-sm text-muted-foreground">Không có công việc phù hợp.</li>
        : state.items.map(item => <li key={item.id} role="option" aria-selected={false}>
          <button type="button" onClick={() => onChoose(item)} className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
            <span className="w-full truncate font-medium">{item.title}</span>
            <span className="w-full truncate text-xs text-muted-foreground">{item.subtitle}</span>
          </button>
        </li>)}
    </ul>}
  </div>;
};

// Shared by the editor and reading view. A ref stores only Card.id; title/deadline/status come from the resolver.
export const LinkedTaskBlock = ({ block, resolved, onRemove, onChoose }: {
  block: Extract<NoteBlock, { type: "task" }>;
  resolved: LinkedTaskView;
  onRemove?: () => void;
  onChoose?: (task: PickedTask) => void;
}) => {
  const queryClient = useQueryClient();
  const openCard = useCardModal(state => state.onOpen);
  // Changes made in the card detail must show here on return.
  const openDetail = () => openCard(block.taskId, { onClose: () => void queryClient.invalidateQueries({ queryKey: LINKED_TASKS_KEY }) });
  const refetch = () => void queryClient.invalidateQueries({ queryKey: LINKED_TASKS_KEY });

  let body: ReactNode;
  if (resolved.state === "empty") {
    body = onChoose ? <TaskPicker blockId={block.id} onChoose={onChoose} /> : <span className="text-muted-foreground">Chưa chọn công việc.</span>;
  } else if (resolved.state === "available" || resolved.state === "picked") {
    const due = resolved.state === "available" ? formatDue(resolved.task) : null;
    const done = resolved.state === "available" && resolved.task.isCompleted;
    body = <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
      <button type="button" onClick={openDetail} className={cn("min-w-0 truncate text-left font-medium hover:underline", done && "text-muted-foreground line-through")}>
        {resolved.state === "available" ? resolved.task.title : resolved.title}
      </button>
      {resolved.state === "available" ? <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {done ? <CheckCircle2 aria-hidden="true" className="size-3.5 text-emerald-600" /> : <Circle aria-hidden="true" className="size-3.5" />}
        {done ? "Đã hoàn thành" : "Chưa hoàn thành"}{due && ` · Hạn ${due}`}
      </span> : <span className="truncate text-xs text-muted-foreground">{resolved.subtitle} · Chưa lưu</span>}
    </div>;
  } else if (resolved.state === "unavailable") {
    body = <span className="text-muted-foreground">Công việc không còn khả dụng.</span>;
  } else if (resolved.state === "error") {
    body = <span className="text-muted-foreground">Chưa tải được công việc. <button type="button" onClick={refetch} className="font-medium text-violet-600 hover:underline">Thử lại</button></span>;
  } else {
    body = <span className="flex items-center gap-1.5 text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />{resolved.state === "checking" ? "Đang kiểm tra công việc…" : "Đang chờ lưu để tải công việc…"}</span>;
  }

  return <div className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
    <Link2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-600" /><span className="sr-only">Công việc liên kết:</span>
    {body}
    {onRemove && resolved.state !== "empty" && <button type="button" onClick={onRemove} className="ml-auto flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
      <Unlink aria-hidden="true" className="size-3.5" />Gỡ liên kết
    </button>}
  </div>;
};
