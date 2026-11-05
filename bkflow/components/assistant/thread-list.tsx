"use client";

import { useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { groupThreads, THREAD_GROUP_ORDER, type ThreadGroupKey, type ThreadSummary } from "@/lib/ai/assistant/threads-shared";
import { getIntlLocale, tr } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages/vi";
import { cn } from "@/lib/utils";
import Link from "@/web/shims/next-link";

import { deleteThread, patchThread, THREADS_KEY, type ThreadsPayload } from "./api";

const GROUP_LABELS: Record<ThreadGroupKey, MessageKey> = {
  pinned: "assistant.threads.pinned",
  today: "assistant.threads.today",
  week: "assistant.threads.week",
  older: "assistant.threads.older",
};

const formatWhen = (iso: string, now: Date) => {
  const date = new Date(iso);
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(getIntlLocale(), sameDay ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { day: "2-digit", month: "2-digit" }).format(date);
};

const ThreadItem = ({ thread, active, now, onNavigate, onDeleted }: { thread: ThreadSummary; active: boolean; now: Date; onNavigate?: () => void; onDeleted: (id: string) => void }) => {
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(thread.title);
  const label = thread.title || tr("assistant.threads.untitled");

  const update = (patch: { title?: string; pinned?: boolean }) => {
    queryClient.setQueryData<ThreadsPayload>(THREADS_KEY, (data) => data && {
      ...data,
      threads: data.threads.map((item) => item.id !== thread.id ? item : {
        ...item,
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.pinned !== undefined && { pinnedAt: patch.pinned ? new Date().toISOString() : null }),
      }),
    });
    void patchThread(thread.id, patch).catch(() => {
      toast.error(tr("assistant.threads.saveError"));
      void queryClient.invalidateQueries({ queryKey: THREADS_KEY });
    });
  };

  const remove = () => {
    if (!window.confirm(tr("assistant.threads.deleteConfirm", { title: label }))) return;
    void deleteThread(thread.id)
      .then(() => {
        queryClient.setQueryData<ThreadsPayload>(THREADS_KEY, (data) => data && { ...data, threads: data.threads.filter((item) => item.id !== thread.id) });
        onDeleted(thread.id);
      })
      .catch(() => toast.error(tr("assistant.threads.deleteError")));
  };

  if (renaming) {
    return (
      <form
        className="px-1"
        onSubmit={(event) => {
          event.preventDefault();
          setRenaming(false);
          if (title.trim() && title.trim() !== thread.title) update({ title: title.trim() });
        }}
      >
        <input
          autoFocus
          value={title}
          maxLength={120}
          aria-label={tr("assistant.threads.renameLabel")}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={(event) => event.currentTarget.form?.requestSubmit()}
          onKeyDown={(event) => { if (event.key === "Escape") { setTitle(thread.title); setRenaming(false); } }}
          className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
        />
      </form>
    );
  }

  return (
    <div className={cn("group/thread relative flex items-center rounded-lg", active ? "bg-violet-500/12" : "hover:bg-muted")}>
      <Link
        href={`/assistant/${thread.id}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className="min-w-0 flex-1 rounded-lg px-2.5 py-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className={cn("block truncate text-sm", active ? "font-semibold text-violet-700 dark:text-violet-300" : "text-foreground")}>{label}</span>
        <span className="block text-[11px] tabular-nums text-muted-foreground">{formatWhen(thread.updatedAt, now)}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={tr("assistant.threads.menu", { title: label })}
            className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover/thread:opacity-100 aria-expanded:opacity-100 max-md:opacity-100">
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => update({ pinned: !thread.pinnedAt })}>
            {thread.pinnedAt ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            {thread.pinnedAt ? tr("assistant.threads.unpin") : tr("assistant.threads.pin")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setTitle(thread.title); setRenaming(true); }}>
            <Pencil className="size-4" />{tr("assistant.threads.rename")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={remove}>
            <Trash2 className="size-4" />{tr("assistant.threads.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

/** Cột trái của trang Trợ lý: cuộc trò chuyện mới, tìm, và danh sách chia theo Đã ghim / Hôm nay / 7 ngày qua / Cũ hơn. */
export const ThreadList = ({ threads, activeId, loading, onNavigate, onDeleted }: { threads: ThreadSummary[]; activeId?: string; loading: boolean; onNavigate?: () => void; onDeleted: (id: string) => void }) => {
  const [query, setQuery] = useState("");
  const now = useMemo(() => new Date(), []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? threads.filter((thread) => (thread.title || tr("assistant.threads.untitled")).toLocaleLowerCase().includes(needle)) : threads;
  }, [query, threads]);
  const groups = groupThreads(filtered, now);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
        <h2 className="text-sm font-semibold">{tr("assistant.threads.title")}</h2>
        <Button asChild size="sm" className="gap-1">
          <Link href="/assistant" onClick={onNavigate}><Plus className="size-3.5" />{tr("assistant.threads.new")}</Link>
        </Button>
      </div>
      <div className="px-3 pb-2">
        <label className="flex h-8 items-center gap-2 rounded-lg bg-muted px-2.5 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-violet-400/30">
          <Search aria-hidden="true" className="size-3.5 shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr("assistant.threads.search")}
            aria-label={tr("assistant.threads.search")}
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <nav aria-label={tr("assistant.threads.title")} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {loading ? (
          <div className="space-y-2 px-1" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            size="sm"
            icon={MessageSquareText}
            title={query ? tr("assistant.threads.noMatch") : tr("assistant.threads.emptyTitle")}
            description={query ? undefined : tr("assistant.threads.emptyBody")}
          />
        ) : THREAD_GROUP_ORDER.map((key) => groups[key].length > 0 ? (
          <section key={key} aria-label={tr(GROUP_LABELS[key])}>
            <h3 className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tr(GROUP_LABELS[key])}</h3>
            <div className="space-y-0.5">
              {groups[key].map((thread) => <ThreadItem key={thread.id} thread={thread} active={thread.id === activeId} now={now} onNavigate={onNavigate} onDeleted={onDeleted} />)}
            </div>
          </section>
        ) : null)}
      </nav>
    </div>
  );
};
