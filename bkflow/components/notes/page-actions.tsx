"use client";

import { useMemo, useRef, useState } from "react";
import Link from "@/web/shims/next-link";
import { usePathname, useRouter } from "@/web/shims/next-navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, FileText, FolderInput, ListTodo, MoreHorizontal, RotateCcw, Smile, Star, StarOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NOTE_PAGES_KEY, useNotePages } from "@/components/notes/note-pages-list";
import { getSubtreeIds, type PageSummary } from "@/lib/notes/page-tree";
import { cn } from "@/lib/utils";

const EMOJIS = "📄 📝 📚 📖 🎓 🧠 💡 🔬 🧪 🧮 📐 📊 📈 🗂️ 📌 📎 ✅ ⏰ 📅 🗓️ 🎯 🚀 ⭐ 🔥 💼 🏫 💻 🧑‍💻 🎨 🎵 🌱 ☕ 🏃 💰 ✈️ ❤️".split(" ");

export const PageIcon = ({ icon, className }: { icon?: string | null; className?: string }) =>
  icon ? <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}>{icon}</span>
    : <FileText aria-hidden="true" className={cn("shrink-0 opacity-60", className)} />;

// --- recent pages (per-browser convenience, like AppFlowy "Recent") ---
const RECENT_KEY = "uniflow-recent-pages";
export const readRecentPages = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(0, 5) : [];
  } catch { return []; }
};
export const rememberRecentPage = (id: string) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecentPages().filter(item => item !== id)].slice(0, 5))); } catch { /* storage unavailable */ }
};

export const usePageActions = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTE_PAGES_KEY });

  const updateMeta = async (pageId: string, body: { icon?: string | null; isFavorite?: boolean; parentId?: string | null; restore?: true }) => {
    const response = await fetch(`/api/pages/${encodeURIComponent(pageId)}/meta`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(result.error ?? "Chưa cập nhật được trang."); return false; }
    await refresh();
    return true;
  };

  const trash = async (page: PageSummary) => {
    const response = await fetch(`/api/pages/${encodeURIComponent(page.id)}`, { method: "DELETE" });
    if (!response.ok) { toast.error("Chưa xoá được trang."); return; }
    await refresh();
    toast.success(`Đã chuyển "${page.title}" vào thùng rác.`, { action: { label: "Hoàn tác", onClick: () => void updateMeta(page.id, { restore: true }) } });
    if (pathname === `/pages/${encodeURIComponent(page.id)}`) router.push("/pages");
  };

  const deleteForever = async (page: PageSummary) => {
    if (!window.confirm(`Xoá vĩnh viễn "${page.title}" và các trang con? Không thể hoàn tác.`)) return;
    const response = await fetch(`/api/pages/${encodeURIComponent(page.id)}?permanent=1`, { method: "DELETE" });
    if (!response.ok) { toast.error("Chưa xoá được trang."); return; }
    await refresh();
  };

  // Copies the saved page only (task refs keep their Card.id); never creates or deletes a Card.
  const duplicate = async (page: PageSummary) => {
    const response = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ duplicateOf: page.id }) });
    if (!response.ok) { toast.error("Chưa nhân bản được trang."); return; }
    const copy = await response.json() as { id: string };
    await refresh();
    router.push(`/pages/${encodeURIComponent(copy.id)}`);
  };

  return { updateMeta, trash, deleteForever, duplicate };
};

export const IconPicker = ({ value, onSelect }: { value?: string | null; onSelect: (icon: string | null) => void }) => {
  const [custom, setCustom] = useState("");
  return <div className="space-y-3">
    <div className="grid grid-cols-9 gap-1">
      {EMOJIS.map(emoji => <button key={emoji} type="button" onClick={() => onSelect(emoji)} aria-label={`Chọn ${emoji}`} className={cn("flex size-8 items-center justify-center rounded-md text-lg hover:bg-muted", value === emoji && "bg-violet-100 dark:bg-violet-500/20")}>{emoji}</button>)}
    </div>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (custom.trim()) onSelect(custom.trim()); }}>
      <Input value={custom} maxLength={16} onChange={event => setCustom(event.target.value)} placeholder="Dán emoji khác…" aria-label="Emoji tuỳ chọn" className="h-8" />
      <Button type="submit" size="sm" variant="outline">Dùng</Button>
      {value && <Button type="button" size="sm" variant="ghost" onClick={() => onSelect(null)}>Bỏ icon</Button>}
    </form>
  </div>;
};

const MovePageDialog = ({ page, open, onOpenChange }: { page: PageSummary; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { data: pages = [] } = useNotePages();
  const { updateMeta } = usePageActions();
  const [query, setQuery] = useState("");
  const targets = useMemo(() => {
    const blocked = new Set(getSubtreeIds(pages, page.id));
    const key = query.trim().toLowerCase();
    return pages.filter(item => !blocked.has(item.id) && (!key || item.title.toLowerCase().includes(key)));
  }, [pages, page.id, query]);
  const move = async (parentId: string | null) => { if (await updateMeta(page.id, { parentId })) onOpenChange(false); };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Di chuyển "{page.title}"</DialogTitle><DialogDescription>Chọn trang cha mới.</DialogDescription></DialogHeader>
      <Input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trang…" aria-label="Tìm trang đích" />
      <div className="max-h-72 space-y-0.5 overflow-y-auto">
        <button type="button" disabled={!page.parentId} onClick={() => void move(null)} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted disabled:opacity-50">
          <FolderInput aria-hidden="true" className="size-4 opacity-60" />Cấp gốc (Trang của tôi)
        </button>
        {targets.map(item => <button key={item.id} type="button" disabled={item.id === page.parentId} onClick={() => void move(item.id)} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted disabled:opacity-50">
          <PageIcon icon={item.icon} className="size-4 text-sm" /><span className="truncate">{item.title || "Trang chưa đặt tên"}</span>
        </button>)}
        {targets.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Không có trang phù hợp.</p>}
      </div>
    </DialogContent>
  </Dialog>;
};

type ConvertPreview = { revision: string; validCount: number; undatedCount: number; issueMessage: string; target: { ok: boolean; reason?: string }; canConvert: boolean; restorable: boolean; convertedCount: number };
type ConvertBoard = { id: string; title: string; lists: { id: string; title: string }[] };
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

// Opt-in: legacy deadline blocks of this page become tasks in a personal list; restorable while nothing changed.
const ConvertDeadlinesDialog = ({ page, open, onOpenChange }: { page: PageSummary; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const pathname = usePathname();
  const [boardId, setBoardId] = useState("");
  const [listId, setListId] = useState("");
  const [busy, setBusy] = useState(false);
  // Kept across retries of the same attempt so a lost response cannot create the tasks twice.
  const requestIdRef = useRef(crypto.randomUUID());
  const url = `/api/pages/${encodeURIComponent(page.id)}/convert-deadlines`;
  const { data, error, isFetching, refetch } = useQuery<{ preview: ConvertPreview; boards: ConvertBoard[] }>({
    queryKey: ["page-convert-deadlines", page.id, boardId, listId], enabled: open,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${url}?${new URLSearchParams({ boardId, listId })}`, { signal, cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Chưa tải được bản xem trước.");
      return body;
    },
  });
  const preview = data?.preview;
  const lists = data?.boards.find(board => board.id === boardId)?.lists ?? [];

  const run = async (method: "POST" | "DELETE") => {
    if (!preview || busy) return;
    if (method === "DELETE" && !window.confirm("Khôi phục các hạn cũ trong Trang? Các công việc đã tạo sẽ được lưu trữ.")) return;
    setBusy(true);
    try {
      const body = method === "POST"
        ? { targetBoardId: boardId, targetListId: listId, expectedUpdatedAt: preview.revision, requestId: requestIdRef.current }
        : { expectedUpdatedAt: preview.revision };
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { toast.error(result.error ?? "Chưa xử lý được. Trang vẫn được giữ nguyên."); await refetch(); return; }
      requestIdRef.current = crypto.randomUUID();
      toast.success(method === "POST" ? `Đã chuyển ${result.converted.length} hạn thành công việc.` : "Đã khôi phục các hạn trong Trang.");
      onOpenChange(false);
      // The open editor keeps its own draft state; reload it so it shows the saved content.
      if (pathname === `/pages/${encodeURIComponent(page.id)}`) window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Chuyển hạn thành công việc</DialogTitle>
        <DialogDescription>Mỗi hạn có ngày trong Trang sẽ thành một công việc trong danh sách bạn chọn. Hạn chưa có ngày vẫn giữ trong Trang.</DialogDescription>
      </DialogHeader>
      {error ? <p role="alert" className="text-sm text-destructive">{error.message}</p>
        : !preview ? <p role="status" className="text-sm text-muted-foreground">Đang kiểm tra…</p>
        : <div className="space-y-3 text-sm">
          <p>{preview.validCount} hạn sẽ được chuyển · {preview.undatedCount} hạn chưa có ngày giữ nguyên{preview.convertedCount ? ` · ${preview.convertedCount} hạn đã chuyển trước đó` : ""}.</p>
          {preview.issueMessage && <p role="alert" className="text-destructive">{preview.issueMessage}</p>}
          <label className="grid gap-1">
            <span className="font-medium">Bảng cá nhân</span>
            <select value={boardId} onChange={event => { setBoardId(event.target.value); setListId(""); }} className={selectClass}>
              <option value="">Chọn bảng…</option>
              {data.boards.map(board => <option key={board.id} value={board.id}>{board.title}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="font-medium">Danh sách</span>
            <select value={listId} disabled={!boardId} onChange={event => setListId(event.target.value)} className={selectClass}>
              <option value="">Chọn danh sách…</option>
              {lists.map(list => <option key={list.id} value={list.id}>{list.title}</option>)}
            </select>
          </label>
          {preview.target.reason === "shared" && <p role="alert" className="text-destructive">Chỉ chuyển được vào bảng cá nhân của bạn.</p>}
          <div className="flex justify-end gap-2">
            {preview.restorable && <Button type="button" variant="outline" disabled={busy} onClick={() => void run("DELETE")}>Khôi phục</Button>}
            <Button type="button" disabled={busy || isFetching || !preview.canConvert} onClick={() => void run("POST")}>Chuyển</Button>
          </div>
        </div>}
    </DialogContent>
  </Dialog>;
};

// The "⋯" menu shared by sidebar rows and the editor header.
export const PageActionsMenu = ({ page, className }: { page: PageSummary; className?: string }) => {
  const { updateMeta, trash, duplicate } = usePageActions();
  const [dialog, setDialog] = useState<"icon" | "move" | "convert" | null>(null);

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Tuỳ chọn cho ${page.title}`} className={cn("flex size-6 shrink-0 items-center justify-center rounded hover:bg-foreground/10", className)}>
        <MoreHorizontal className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onSelect={() => void updateMeta(page.id, { isFavorite: !page.isFavorite })}>
          {page.isFavorite ? <StarOff className="size-4" /> : <Star className="size-4" />}{page.isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("icon")}><Smile className="size-4" />Đổi icon</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("move")}><FolderInput className="size-4" />Di chuyển tới…</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void duplicate(page)}><Copy className="size-4" />Nhân bản trang</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("convert")}><ListTodo className="size-4" />Chuyển hạn thành công việc…</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void trash(page)}><Trash2 className="size-4" />Chuyển vào thùng rác</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={dialog === "icon"} onOpenChange={open => setDialog(open ? "icon" : null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Icon trang</DialogTitle><DialogDescription>Hiện ở sidebar và tiêu đề trang.</DialogDescription></DialogHeader>
        <IconPicker value={page.icon} onSelect={icon => { void updateMeta(page.id, { icon }); setDialog(null); }} />
      </DialogContent>
    </Dialog>
    {dialog === "move" && <MovePageDialog page={page} open onOpenChange={open => setDialog(open ? "move" : null)} />}
    {dialog === "convert" && <ConvertDeadlinesDialog page={page} open onOpenChange={open => setDialog(open ? "convert" : null)} />}
  </>;
};

export const TrashDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { updateMeta, deleteForever } = usePageActions();
  const { data: pages, isPending } = useQuery<PageSummary[]>({
    queryKey: [...NOTE_PAGES_KEY, "trash"], enabled: open,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/pages?trash=1", { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Cannot load trash");
      return response.json();
    },
  });

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Thùng rác</DialogTitle><DialogDescription>Khôi phục trang hoặc xoá vĩnh viễn.</DialogDescription></DialogHeader>
      <div className="max-h-80 space-y-0.5 overflow-y-auto">
        {isPending ? <p role="status" className="px-2 py-3 text-sm text-muted-foreground">Đang tải…</p>
          : !pages?.length ? <p className="px-2 py-3 text-sm text-muted-foreground">Thùng rác trống.</p>
          : pages.map(page => <div key={page.id} className="flex h-9 items-center gap-2 rounded-md px-2 hover:bg-muted">
            <PageIcon icon={page.icon} className="size-4 text-sm" />
            <Link href={`/pages/${encodeURIComponent(page.id)}`} onClick={() => onOpenChange(false)} className="min-w-0 flex-1 truncate text-sm">{page.title || "Trang chưa đặt tên"}</Link>
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Khôi phục ${page.title}`} onClick={() => void updateMeta(page.id, { restore: true })}><RotateCcw /></Button>
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Xoá vĩnh viễn ${page.title}`} onClick={() => void deleteForever(page)} className="text-destructive"><Trash2 /></Button>
          </div>)}
      </div>
    </DialogContent>
  </Dialog>;
};
