"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { tr } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages/vi";
import { useAuth } from "@/web/lib/auth";
import { usePathname, useSearchParams } from "@/web/shims/next-navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarCheck, Compass, FileText, LayoutGrid, ListTodo, type LucideIcon, Search, SearchX, Settings } from "lucide-react";
import { AiLogo } from "@/components/ai-assistant/ai-logo";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { parseRecentItems, rememberSearchItem, type SearchReference, type WorkspaceSearchItem } from "@/lib/search/workspace-search";
import { useCardModal } from "@/hooks/use-card-modal";
import { formatWorkspaceTitle } from "@/lib/workspaces";
import { useSettingsModal } from "@/hooks/use-settings-modal";
import { cn } from "@/lib/utils";
import Link from "@/web/shims/next-link";
import { useRouter } from "@/web/shims/next-navigation";

const labels: Record<string, MessageKey> = { card: "search.kindTask", course: "search.kindCourse", board: "search.kindBoard", note: "search.kindNote", page: "search.kindPage" };
const KIND_ICONS: Record<string, LucideIcon> = { card: ListTodo, course: BookOpen, board: LayoutGrid, note: FileText, page: Compass };
const KIND_ORDER = ["card", "course", "note", "board", "page"] as const;

type Command = { id: "today" | "settings"; label: MessageKey; icon: LucideIcon; href?: string; shortcut?: string };
const COMMANDS: Command[] = [
  { id: "today", label: "search.cmd.today", icon: CalendarCheck, href: "/my/today" },
  { id: "settings", label: "search.cmd.settings", icon: Settings },
];

type Entry =
  | { kind: "ask"; key: string }
  | { kind: "item"; key: string; item: WorkspaceSearchItem; nav?: boolean }
  | { kind: "command"; key: string; command: Command };

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
  const [active, setActive] = useState(-1);
  const listId = useId();
  const router = useRouter();
  const settingsModal = useSettingsModal();
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
    const pageId = pathname === "/pages" ? "notes" : ({ "/my/today": "today", "/my/tasks": "tasks", "/my/calendar": "calendar" } as Record<string, string>)[pathname];
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
      setQuery(""); setDebounced(""); setActive(-1);
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
  const trimmed = query.trim();
  const results = !loading && !isError ? data?.items ?? [] : [];
  const navigation = !loading && !isError ? data?.navigation ?? [] : [];
  // Dòng đầu luôn là "Hỏi Trợ lý" với đúng câu đang gõ; sau đó kết quả theo nhóm, rồi lối đi và lệnh.
  const entries: Entry[] = [
    { kind: "ask", key: "ask" },
    ...results.map((item): Entry => ({ kind: "item", key: `${item.type}-${item.id}`, item })),
    ...navigation.map((item): Entry => ({ kind: "item", key: `nav-${item.type}-${item.id}`, item, nav: true })),
    ...COMMANDS.map((command): Entry => ({ kind: "command", key: `cmd-${command.id}`, command })),
  ];
  // -1 = tự chọn: có kết quả thì Enter mở kết quả đầu (như trước), không có thì Enter hỏi Trợ lý.
  const activeIndex = active < 0 ? (trimmed && results.length > 0 ? 1 : 0) : active;
  const chosen = entries[Math.min(activeIndex, entries.length - 1)];
  const optionId = (entry: Entry) => `${listId}-${entry.key}`;
  const chosenId = chosen ? optionId(chosen) : undefined;
  useEffect(() => { if (chosenId) document.getElementById(chosenId)?.scrollIntoView({ block: "nearest" }); }, [chosenId]);
  const remember = (item: WorkspaceSearchItem) => {
    const next = rememberSearchItem(recent, item);
    setRecent(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Search still works when storage is unavailable. */ }
    setOpen(false);
  };
  const runCommand = (command: Command) => {
    setOpen(false);
    if (command.id === "settings") settingsModal.onOpen();
    else router.push(command.href!);
  };
  const askHref = trimmed ? `/assistant?q=${encodeURIComponent(trimmed)}` : "/assistant";

  const optionClass = (entry: Entry) => cn(
    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm outline-none",
    chosen === entry ? "bg-accent text-accent-foreground" : "hover:bg-muted",
  );
  const groupTitle = (text: string) => <p role="presentation" className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{text}</p>;
  const renderItem = (entry: Extract<Entry, { kind: "item" }>) => {
    const Icon = KIND_ICONS[entry.item.type] ?? FileText;
    return (
      <a key={entry.key} id={optionId(entry)} role="option" aria-selected={chosen === entry} href={entry.item.href} onClick={() => remember(entry.item)} className={optionClass(entry)}>
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-3.5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{entry.item.type === "board" ? formatWorkspaceTitle(entry.item.title) : entry.item.title}</span>
          {entry.item.subtitle ? <span className="block truncate text-xs text-muted-foreground">{entry.item.subtitle}</span> : null}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{tr(labels[entry.item.type])}</span>
      </a>
    );
  };
  const itemEntries = entries.filter((entry): entry is Extract<Entry, { kind: "item" }> => entry.kind === "item");
  const grouped = KIND_ORDER.map((type) => [type, itemEntries.filter((entry) => !entry.nav && entry.item.type === type)] as const).filter(([, list]) => list.length > 0);
  const navEntries = itemEntries.filter((entry) => entry.nav);
  const askEntry = entries[0];

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" aria-label={tr("search.title")} className="w-full max-w-md justify-start gap-2 text-muted-foreground">
      <Search aria-hidden="true" className="size-4 shrink-0" /><span className="hidden sm:inline">{tr("search.placeholder")}</span><span className="sm:hidden">{tr("search.quick")}</span>
    </Button></DialogTrigger>
    <DialogContent showCloseButton={false} className="max-h-[85dvh] w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-xl">
      <DialogTitle className="sr-only">{tr("search.title")}</DialogTitle>
      <DialogDescription className="sr-only">{tr("search.hint")}</DialogDescription>
      <div className="flex items-center gap-2 border-b px-3">
        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <input autoFocus value={query} aria-label={tr("search.inputLabel")} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={chosenId}
          placeholder={tr("search.inputPlaceholder")} onChange={event => { setQuery(event.target.value); setActive(-1); }}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (["ArrowDown", "ArrowUp"].includes(event.key)) {
              event.preventDefault();
              setActive((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length);
            } else if (event.key === "Enter" && chosen) {
              event.preventDefault();
              document.getElementById(optionId(chosen))?.click();
            }
          }} />
        <kbd className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Esc</kbd>
      </div>
      <div id={listId} role="listbox" aria-label={tr("search.results")} className="max-h-[55dvh] overflow-y-auto p-2">
        <Link id={optionId(askEntry)} role="option" aria-selected={chosen === askEntry} href={askHref} onClick={() => setOpen(false)}
          className={cn(optionClass(askEntry), chosen === askEntry ? "bg-violet-500/12 text-foreground" : "")}>
          <AiLogo className="size-7 rounded-md" />
          <span className="min-w-0 flex-1 truncate font-medium text-violet-700 dark:text-violet-300">
            {trimmed ? tr("search.askAssistant", { query: trimmed }) : tr("search.openAssistant")}
          </span>
          <kbd className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">↵</kbd>
        </Link>
        {!enabled ? <p role="status" className="px-2.5 py-3 text-sm">{tr("search.pickWorkspace")}</p>
          : loading ? <p role="status" className="px-2.5 py-3 text-sm text-muted-foreground">{tr("search.searching")}</p>
          : isError ? <div role="alert" className="px-2.5 py-3 text-sm">{tr("search.loadError")}<Button variant="link" onClick={() => void refetch()}>{tr("common.retry")}</Button></div>
          : <>
            {!trimmed && results.length > 0 ? groupTitle(tr("search.recentGroup")) : null}
            {trimmed ? grouped.map(([type, list]) => <div key={type} role="group" aria-label={tr(labels[type])}>{groupTitle(tr(labels[type]))}{list.map(renderItem)}</div>)
              : results.length > 0 ? itemEntries.filter((entry) => !entry.nav).map(renderItem) : null}
            {trimmed && results.length === 0 ? <div role="status"><EmptyState size="sm" icon={SearchX} title={tr("search.noResults")} /></div> : null}
            {navEntries.length > 0 ? <div role="group" aria-label={tr("search.goTo")}>{groupTitle(tr("search.goTo"))}{navEntries.map(renderItem)}</div> : null}
          </>}
        <div role="group" aria-label={tr("search.commands")}>
          {groupTitle(tr("search.commands"))}
          {entries.filter((entry): entry is Extract<Entry, { kind: "command" }> => entry.kind === "command").map((entry) => {
            const Icon = entry.command.icon;
            return (
              <button key={entry.key} id={optionId(entry)} role="option" aria-selected={chosen === entry} type="button" onClick={() => runCommand(entry.command)} className={optionClass(entry)}>
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-3.5" /></span>
                <span className="min-w-0 flex-1 truncate">{tr(entry.command.label)}</span>
                {entry.command.shortcut ? <kbd className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{entry.command.shortcut}</kbd> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span><kbd className="font-semibold text-foreground">↑↓</kbd> {tr("search.keys.move")}</span>
        <span><kbd className="font-semibold text-foreground">↵</kbd> {tr("search.keys.open")}</span>
        <span><kbd className="font-semibold text-foreground">Ctrl J</kbd> {tr("search.keys.assistant")}</span>
        <span><kbd className="font-semibold text-foreground">Esc</kbd> {tr("search.keys.close")}</span>
      </div>
    </DialogContent>
  </Dialog>;
};
