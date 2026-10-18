"use client";

import Link from "@/web/shims/next-link";
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
      if (!response.ok) throw new Error("Chưa tạo được ghi chú.");
      const page = await response.json() as { id: string };
      void queryClient.invalidateQueries({ queryKey: NOTE_PAGES_KEY });
      router.push(`/pages/${encodeURIComponent(page.id)}`);
    } catch { toast.error("Chưa tạo được ghi chú. Hãy thử lại."); }
    finally { setCreating(false); }
  };
  return { create, creating };
};

export const NotePagesList = () => {
  const { userId } = useAuth();
  const { data, isPending, isError, refetch } = useNotePages();
  const { create, creating } = useCreateNotePage();
  const titleOf = (id: string | null) => data?.find(page => page.id === id)?.title;
  return <div className="mx-auto max-w-3xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Trang của tôi</h1>
      <Button disabled={creating || !userId} onClick={() => void create()}><Plus aria-hidden="true" />{creating ? "Đang tạo…" : "Trang mới"}</Button>
    </header>
    {!userId ? <p role="status">Đăng nhập để mở ghi chú.</p> : isPending ? <p role="status" className="text-sm text-muted-foreground">Đang tải trang…</p> : isError ? <div role="alert">Chưa tải được ghi chú. <Button variant="link" onClick={() => void refetch()}>Thử lại</Button></div> : data?.length ? <>
      <p className="mb-1 px-3 text-xs font-medium text-muted-foreground">Sửa gần đây</p>
      <ul className="space-y-0.5">{data.map(page => <li key={page.id}>
        <Link href={`/pages/${encodeURIComponent(page.id)}`} className="flex h-11 items-center gap-3 rounded-md px-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
          <span aria-hidden="true" className="flex w-5 shrink-0 justify-center text-base">{page.icon ?? <FileText className="size-4 text-muted-foreground" />}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{page.title || "Trang chưa đặt tên"}</span>
          {titleOf(page.parentId) && <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:inline">trong {titleOf(page.parentId)}</span>}
          <span className="shrink-0 text-xs text-muted-foreground">{new Date(page.updatedAt).toLocaleDateString("vi-VN", { day: "numeric", month: "short", timeZone: "Asia/Ho_Chi_Minh" })}</span>
        </Link>
      </li>)}</ul>
      {data.length === 100 && <p className="mt-4 text-sm text-muted-foreground">Hiển thị 100 trang mới sửa gần nhất. Dùng Tìm nhanh để mở các trang cũ hơn.</p>}
    </> : <button type="button" disabled={creating} onClick={() => void create()} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-muted-foreground hover:bg-muted/50">
      <FileText aria-hidden="true" className="size-6" />Chưa có trang nào. Bấm để tạo trang đầu tiên.
    </button>}
  </div>;
};
