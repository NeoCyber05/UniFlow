"use client";

import Link from "@/web/shims/next-link";
import { getIntlLocale, tr } from "@/lib/i18n";
import { useRouter } from "@/web/shims/next-navigation";
import { useState } from "react";
import { useAuth } from "@/web/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageSummary } from "@/lib/notes/page-tree";

export const NOTE_PAGES_KEY = ["note-pages"] as const;

export const useNotePages = () => {
  const { userId } = useAuth();
  return useQuery<PageSummary[]>({
    queryKey: [...NOTE_PAGES_KEY, userId], enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/pages", { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Cannot load pages");
      return response.json();
    },
  });
};

export const useCreateNotePage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const create = async (parentId?: string) => {
    if (creating) return;
    setCreating(true);
    try {
      const response = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId }) });
      if (!response.ok) throw new Error(tr("notes.list.createError"));
      const page = await response.json() as { id: string };
      void queryClient.invalidateQueries({ queryKey: NOTE_PAGES_KEY });
      router.push(`/pages/${encodeURIComponent(page.id)}`);
    } catch { toast.error(tr("notes.list.createErrorRetry")); }
    finally { setCreating(false); }
  };
  return { create, creating };
};

export const NotePagesList = () => {
  const { userId } = useAuth();
  const { data, isPending, isError, refetch } = useNotePages();
  const { create, creating } = useCreateNotePage();
  const titleOf = (id: string | null) => data?.find(page => page.id === id)?.title;
  return <div className="mx-auto max-w-3xl pb-16 pt-6 sm:pt-12">
    <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><FileText aria-hidden="true" className="size-7" /></div>
    <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{tr("notes.page.myPages")}</h1>
      <Button variant="outline" size="sm" disabled={creating || !userId} onClick={() => void create()}><Plus aria-hidden="true" />{creating ? tr("notes.list.creating") : tr("notes.page.newPage")}</Button>
    </header>
    <p className="mb-8 text-sm text-muted-foreground">{tr("notes.list.empty")}</p>
    {!userId ? <p role="status">{tr("notes.list.loginPrompt")}</p> : isPending ? <p role="status" className="text-sm text-muted-foreground">{tr("notes.list.loading")}</p> : isError ? <div role="alert">{tr("notes.list.loadError")}<Button variant="link" onClick={() => void refetch()}>{tr("common.retry")}</Button></div> : data?.length ? <>
      <div className="mb-2 flex items-center justify-between border-b border-border px-3 pb-2 text-xs font-medium text-muted-foreground"><span>{tr("notesExtra.pageCol")}</span><span>{tr("notes.list.recent")}</span></div>
      <ul className="space-y-0.5">{data.map(page => <li key={page.id}>
        <Link href={`/pages/${encodeURIComponent(page.id)}`} className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
          <span aria-hidden="true" className="flex w-5 shrink-0 justify-center text-base">{page.icon ?? <FileText className="size-4 text-muted-foreground" />}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{page.title || tr("notes.page.untitled")}</span>
          {titleOf(page.parentId) && <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:inline">{tr("notesExtra.inParent", { title: titleOf(page.parentId)! })}</span>}
          <span className="shrink-0 text-xs text-muted-foreground">{new Date(page.updatedAt).toLocaleDateString(getIntlLocale(), { day: "numeric", month: "short", timeZone: "Asia/Ho_Chi_Minh" })}</span>
        </Link>
      </li>)}</ul>
      {data.length === 100 && <p className="mt-4 text-sm text-muted-foreground">{tr("notes.list.limitNote")}</p>}
    </> : <button type="button" disabled={creating} onClick={() => void create()} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-muted-foreground hover:bg-muted/50">
      <FileText aria-hidden="true" className="size-6" />{tr("notes.list.noPages")}
    </button>}
  </div>;
};
