"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useAuth } from "@/web/lib/auth";
import { usePathname, useSearchParams } from "@/web/shims/next-navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { parseRecentItems, rememberSearchItem, type SearchReference, type WorkspaceSearchItem } from "@/lib/search/workspace-search";
import { useCardModal } from "@/hooks/use-card-modal";

const labels = { card: "Công việc", course: "Học phần", board: "Bảng", note: "Ghi chú", page: "Trang" };

export const WorkspaceSearch = () => {
  const { userId } = useAuth();
  const identity = `${userId}`;
  return <SearchPalette key={identity} identity={identity} enabled={Boolean(userId)} />;
};

const SearchPalette = ({ identity, enabled }: { identity: string; enabled: boolean }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [recent, setRecent] = useState<SearchReference[]>([]);
  const [active, setActive] = useState(0);
  const listId = useId();
  const storageKey = `uniflow:recent:${identity}`;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cardId = searchParams.get("cardId");
  const modalCardId = useCardModal(state => state.isOpen ? state.id : undefined);
  const courseId = searchParams.get("course");
  useEffect(() => {
    if (!enabled) return;
    const boardId = pathname.match(/^\/board\/([^/]+)/)?.[1];
    const noteId = pathname.match(/^\/pages\/([^/]+)/)?.[1];
    const pageId = pathname === "/pages" ? "notes" : ({ "/my/today": "today", "/my/tasks": "tasks", "/my/calendar": "calendar", "/my/courses": "courses" } as Record<string, string>)[pathname];
    const reference: SearchReference | null = modalCardId ? { type: "card", id: modalCardId }
      : noteId ? { type: "note", id: noteId }
      : boardId && cardId ? { type: "card", id: cardId }
      : boardId && courseId && courseId !== "personal" ? { type: "course", id: courseId }
      : boardId ? { type: "board", id: boardId }
      : pageId ? { type: "page", id: pageId } : null;
    if (!reference) return;
    try {
      const next = rememberSearchItem(parseRecentItems(localStorage.getItem(storageKey)), reference);
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch { /* Recents are optional on browsers with storage disabled. */ }
  }, [pathname, cardId, courseId, modalCardId, storageKey, enabled]);
  const changeOpen = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery(""); setDebounced(""); setActive(0);
      try { setRecent(parseRecentItems(localStorage.getItem(storageKey))); } catch { setRecent([]); }
    }
  }, [storageKey]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !event.isComposing) {
        event.preventDefault(); changeOpen(!open);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [changeOpen, open]);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 200); return () => clearTimeout(timer); }, [query]);
  const { data, isFetching, isError, refetch } = useQuery<{ items: WorkspaceSearchItem[]; navigation: WorkspaceSearchItem[] }>({
    queryKey: ["workspace-search", identity, debounced, recent],
    enabled: open && enabled,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ q: debounced, recent: JSON.stringify(recent) });
      const response = await fetch(`/api/search?${params}`, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    staleTime: 0,
  });
  const loading = isFetching || query.trim() !== debounced;
  const items = !loading && !isError ? [...(data?.items ?? []), ...(data?.navigation ?? [])] : [];
  const chosen = items[Math.min(active, items.length - 1)];
  const chosenId = chosen ? `${listId}-${chosen.type}-${chosen.id}` : undefined;
  useEffect(() => { if (chosenId) document.getElementById(chosenId)?.scrollIntoView({ block: "nearest" }); }, [chosenId]);
  const remember = (item: WorkspaceSearchItem) => {
    const next = rememberSearchItem(recent, item);
    setRecent(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Search still works when storage is unavailable. */ }
    setOpen(false);
  };

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" aria-label="Tìm nhanh toàn workspace" className="w-full max-w-md justify-start gap-2 text-muted-foreground">
      <Search aria-hidden="true" className="size-4 shrink-0" /><span className="hidden sm:inline">Tìm công việc, học phần, trang…</span><span className="sm:hidden">Tìm nhanh</span><kbd className="ml-auto hidden text-xs md:inline">Ctrl/⌘ K</kbd>
    </Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] gap-3 sm:max-w-xl">
      <DialogTitle>Tìm nhanh toàn workspace</DialogTitle>
      <DialogDescription>Tìm trong workspace đang chọn. Dùng ↑ ↓ và Enter để mở, Esc để đóng.</DialogDescription>
      <Input autoFocus value={query} aria-label="Từ khóa tìm kiếm" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={chosen ? `${listId}-${chosen.type}-${chosen.id}` : undefined}
        placeholder="Tên việc, mã học phần, nội dung ghi chú…" onChange={event => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setActive(index => items.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : 0);
          } else if (event.key === "Enter" && chosen) {
            event.preventDefault();
            document.getElementById(`${listId}-${chosen.type}-${chosen.id}`)?.click();
          }
        }} />
      {!enabled ? <p role="status">Chọn workspace để tìm kiếm.</p> : loading ? <p role="status">Đang tìm…</p> : isError ? <div role="alert">Chưa tải được kết quả. <Button variant="link" onClick={() => void refetch()}>Thử lại</Button></div> : <>
        {!query.trim() && <p className="text-xs text-muted-foreground">{data?.items.length ? "Mục gần đây và lối điều hướng" : "Đi đến"}</p>}
        <div id={listId} role="listbox" aria-label="Kết quả tìm kiếm" className="max-h-[50dvh] overflow-y-auto">
          {items.map(item => <a key={`${item.type}:${item.id}`} id={`${listId}-${item.type}-${item.id}`} role="option" aria-selected={chosen === item} href={item.href} onClick={() => remember(item)}
            className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-ring ${chosen === item ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}>
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span></span><span className="shrink-0 text-xs text-muted-foreground">{labels[item.type]}</span>
          </a>)}
          {!items.length && <p role="status" className="py-6 text-center text-muted-foreground">Chưa tìm thấy. Thử tên ngắn hơn hoặc mã học phần.</p>}
        </div>
      </>}
    </DialogContent>
  </Dialog>;
};
