"use client";
import { BoardAssistant } from "@/components/ai-assistant/board-assistant";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/web/shims/next-link";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, ChevronRight, LoaderCircle, PencilLine, Smile, Sparkles, Star, Type, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoTextarea, BlockEditor } from "@/components/notes/block-editor";
import { PageStyleControls } from "@/components/notes/page-style-controls";
import { isUnsupportedNoteDocument, parseNoteBlocks, type NoteBlock } from "@/lib/notes/blocks";
import { getLinkedTaskIds, resolveLinkedTaskView } from "@/lib/notes/contract";
import { linkedTasksQueryState, LINKED_TASKS_KEY, useLinkedTasks, type PickedTask } from "@/components/notes/linked-task-block";
import { hasCustomPaper, pageStyleCss, type PageStyle } from "@/lib/notes/page-style";
import { cn } from "@/lib/utils";
import { NoteReadingView } from "@/components/notes/note-reading-view";
import { useAppearance } from "@/components/providers/appearance-provider";
import { buildNoteSave, shouldResaveNote } from "@/lib/notes/save-state";
import { NOTE_PAGES_KEY, useNotePages } from "@/components/notes/note-pages-list";
import { getPagePath } from "@/lib/notes/page-tree";
import { IconPicker, PageActionsMenu, rememberRecentPage, usePageActions } from "@/components/notes/page-actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Page = { id: string; title: string; content: string; style: PageStyle | null; updatedAt: string; icon?: string | null; isFavorite?: boolean; parentId?: string | null; deletedAt?: Date | string | null };
type UndoEntry = { id: string; createdAt: string; undoneAt: string | null };
const initialDraft = (page: Page) => ({ title: page.title, blocks: parseNoteBlocks(page.content), style: page.style });
const signature = (draft: { title: string; blocks: NoteBlock[]; style: PageStyle | null }) => JSON.stringify(draft);

export const NotePageEditor = ({ initialPage }: { initialPage: Page }) => {
  const page = initialPage;
  const { pageStyle: defaultStyle } = useAppearance();
  const queryClient = useQueryClient();
  const { data: pages } = useNotePages();
  const ancestors = useMemo(() => getPagePath(pages ?? [], page.id).slice(0, -1), [pages, page.id]);
  const live = pages?.find(item => item.id === page.id);
  const icon = live ? live.icon : page.icon;
  const isFavorite = live ? Boolean(live.isFavorite) : Boolean(page.isFavorite);
  const [trashed, setTrashed] = useState(Boolean(page.deletedAt));
  const [iconOpen, setIconOpen] = useState(false);
  const { updateMeta } = usePageActions();
  useEffect(() => { if (!page.deletedAt) rememberRecentPage(page.id); }, [page.id, page.deletedAt]);
  const [reading, setReading] = useState(false);
  const initial = useMemo(() => initialDraft(page), [page]);
  const [title, setTitle] = useState(initial.title);
  const [blocks, setBlocks] = useState(initial.blocks);
  const [style, setStyle] = useState(initial.style);
  const [updatedAt, setUpdatedAt] = useState(page.updatedAt);
  const summary = { id: page.id, title: title.trim() || "Trang chưa đặt tên", parentId: live?.parentId ?? page.parentId ?? null, updatedAt, icon, isFavorite };
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<UndoEntry[]>([]);
  const versionRef = useRef(page.updatedAt);
  const draftRef = useRef({ title, blocks, style });
  const savedSignatureRef = useRef(signature(initial));
  const saveRunningRef = useRef(false);
  const aiRequestRef = useRef(false);
  const aiAttemptRef = useRef<{ key: string; requestId: string; confirmed?: object } | null>(null);
  const resaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Unsupported stored document: shown read-only and never autosaved until the user explicitly replaces it.
  const [preserved, setPreserved] = useState(() => isUnsupportedNoteDocument(page.content));
  const preservedRef = useRef(preserved);
  const linkedQuery = useLinkedTasks(page.id);
  const linkedState = linkedTasksQueryState(linkedQuery);
  const [picked, setPicked] = useState<Record<string, PickedTask>>({});
  const linkedTask = (taskId: string) => resolveLinkedTaskView(taskId, linkedState, picked[taskId]);
  const savedTaskIdsRef = useRef(getLinkedTaskIds(page.content).join());
  // The tasks endpoint reads saved content, so refetch once the saved set of refs changes.
  const syncLinkedTasks = useCallback((content: string) => {
    const ids = getLinkedTaskIds(content).join();
    if (ids === savedTaskIdsRef.current) return;
    savedTaskIdsRef.current = ids;
    void queryClient.invalidateQueries({ queryKey: LINKED_TASKS_KEY });
  }, [queryClient]);

  useEffect(() => { draftRef.current = { title, blocks, style }; }, [title, blocks, style]);
  useEffect(() => {
    fetch(`/api/pages/${page.id}/history`).then(response => response.ok ? response.json() : null).then(data => {
      if (data?.changes) setHistory(current => Array.from(new Map([...current, ...data.changes].map(change => [change.id, change])).values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }).catch(() => {});
  }, [page.id]);
  useEffect(() => () => { if (resaveRef.current) clearTimeout(resaveRef.current); }, []);

  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (saveRunningRef.current) return false;
    const draft = draftRef.current;
    const currentSignature = signature(draft);
    if (currentSignature === savedSignatureRef.current) return true;
    saveRunningRef.current = true;
    setSaving(true);
    setError("");
    try {
      const body = buildNoteSave(draft, versionRef.current, preservedRef.current);
      if (!body) return true;
      const response = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Không lưu được trang.");
      versionRef.current = result.page.updatedAt;
      if (JSON.parse(savedSignatureRef.current).title !== draft.title) void queryClient.invalidateQueries({ queryKey: NOTE_PAGES_KEY });
      savedSignatureRef.current = currentSignature;
      setUpdatedAt(result.page.updatedAt);
      setSaved(signature(draftRef.current) === currentSignature);
      syncLinkedTasks(body.content);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được trang.");
      setSaved(false);
      return false;
    } finally {
      saveRunningRef.current = false;
      setSaving(false);
      if (shouldResaveNote(currentSignature, savedSignatureRef.current, signature(draftRef.current))) {
        if (resaveRef.current) clearTimeout(resaveRef.current);
        resaveRef.current = setTimeout(() => { void saveChanges(); }, 250);
      }
    }
  }, [page.id, queryClient, syncLinkedTasks]);

  useEffect(() => {
    const timer = setTimeout(() => { void saveChanges(); }, 900);
    return () => clearTimeout(timer);
  }, [title, blocks, style, saveChanges]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (signature(draftRef.current) !== savedSignatureRef.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const beforeLink = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      const link = event.target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.getAttribute("href")?.startsWith("#") || signature(draftRef.current) === savedSignatureRef.current) return;
      event.preventDefault(); event.stopPropagation();
      if (saveRunningRef.current) { setError("Trang đang lưu. Vui lòng mở lại liên kết sau khi lưu xong."); return; }
      void saveChanges().then(success => { if (success) window.location.assign(link.href); });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeLink, true); void saveChanges(); };
  }, [saveChanges]);

  const runAiEdit = async (requestPrompt = prompt) => {
    if (!requestPrompt.trim() || aiRequestRef.current) return;
    aiRequestRef.current = true;
    setAiBusy(true);
    setError("");
    try {
      if (!(await saveChanges())) return;
      // One requestId per prompt+revision, reused on retry so the server replays instead of editing twice.
      const key = JSON.stringify([versionRef.current, requestPrompt]);
      if (aiAttemptRef.current?.key !== key) aiAttemptRef.current = { key, requestId: crypto.randomUUID() };
      const { requestId } = aiAttemptRef.current;
      const send = async (extra: object) => {
        const response = await fetch(`/api/pages/${page.id}/ai`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: requestPrompt, expectedUpdatedAt: versionRef.current, requestId, operation: "edit_page", ...extra }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "AI chưa chỉnh được trang.");
        return result;
      };
      // A retry after a confirmed send repeats that exact payload, so a committed change is replayed.
      let result = await send(aiAttemptRef.current.confirmed ?? {});
      if (result.preview) {
        // Large change or removal of task/deadline blocks: apply only after explicit confirmation.
        if (!window.confirm("AI đề xuất thay đổi lớn (xoá khối công việc/hạn hoặc viết lại hơn nửa trang). Công việc thật không bị xoá. Áp dụng thay đổi này?")) {
          setError("Chưa áp dụng thay đổi của AI. Trang vẫn được giữ nguyên.");
          return;
        }
        aiAttemptRef.current.confirmed = { operation: "replace_content", confirmed: true, document: result.preview.document, expectedUpdatedAt: result.preview.expectedUpdatedAt };
        result = await send(aiAttemptRef.current.confirmed);
      }
      aiAttemptRef.current = null;
      const nextBlocks = parseNoteBlocks(result.page.content);
      const nextDraft = { title: result.page.title, blocks: nextBlocks, style: result.page.style ?? style };
      setTitle(nextDraft.title); setBlocks(nextBlocks); setStyle(nextDraft.style);
      versionRef.current = result.page.updatedAt; setUpdatedAt(result.page.updatedAt);
      draftRef.current = nextDraft; savedSignatureRef.current = signature(nextDraft); setSaved(true);
      setHistory(current => [result.change, ...current.filter(change => change.id !== result.change.id)]); setPrompt("");
      syncLinkedTasks(result.page.content);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI chưa chỉnh được trang."); return false; }
    finally { aiRequestRef.current = false; setAiBusy(false); }
  };

  const undoAiEdit = async (changeId: string) => {
    if (aiRequestRef.current) return;
    aiRequestRef.current = true;
    setAiBusy(true);
    setError("");
    try {
      if (!(await saveChanges())) return;
      const response = await fetch(`/api/pages/${page.id}/undo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changeId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không hoàn tác được thay đổi.");
      setTitle(result.page.title); setBlocks(parseNoteBlocks(result.page.content)); setStyle(result.page.style ?? null);
      versionRef.current = result.page.updatedAt; setUpdatedAt(result.page.updatedAt);
      const draft = { title: result.page.title, blocks: parseNoteBlocks(result.page.content), style: result.page.style ?? null };
      draftRef.current = draft; savedSignatureRef.current = signature(draft); setSaved(true);
      setHistory(current => current.map(change => change.id === changeId ? { ...change, undoneAt: new Date().toISOString() } : change));
      syncLinkedTasks(result.page.content);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không hoàn tác được thay đổi."); }
    finally { aiRequestRef.current = false; setAiBusy(false); }
  };

  const effectiveStyle = style ?? defaultStyle;
  const replacePreserved = () => {
    if (!window.confirm("Thay nội dung gốc bằng một trang trống? Nội dung hiện tại sẽ bị ghi đè khi lưu.")) return;
    preservedRef.current = false;
    setPreserved(false);
    setBlocks([{ id: crypto.randomUUID(), type: "paragraph", text: "" }]);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveChanges(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveChanges]);

  const toolbarButton = "flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground data-[state=open]:bg-muted";

  // Cancels SidebarShell's main padding so the page bar spans the content area.
  return <div className="-mx-4 -mt-7 sm:-mx-7 lg:-mx-10 lg:-mt-9">
    <div className="sticky top-14 z-20 flex h-11 items-center gap-2 bg-background/90 px-4 backdrop-blur sm:px-6">
      <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-0.5 text-sm text-muted-foreground">
        <Link href="/pages" className="shrink-0 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground">Trang của tôi</Link>
        {ancestors.map(ancestor => <span key={ancestor.id} className="flex min-w-0 items-center gap-0.5">
          <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
          <Link href={`/pages/${encodeURIComponent(ancestor.id)}`} className="flex max-w-40 items-center gap-1 truncate rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground">{ancestor.icon && <span aria-hidden="true">{ancestor.icon}</span>}<span className="truncate">{ancestor.title || "Trang chưa đặt tên"}</span></Link>
        </span>)}
        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
        <span aria-current="page" className="flex min-w-0 items-center gap-1 px-1.5 text-foreground">{icon && <span aria-hidden="true">{icon}</span>}<span className="truncate">{title.trim() || "Trang chưa đặt tên"}</span></span>
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <span className="mr-2 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex" aria-live="polite">
          {saving ? <><LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />Đang lưu…</> : saved ? <><Check aria-hidden="true" className="size-3.5" />Đã lưu</> : "Chưa lưu"}
          <span className="sr-only">Cập nhật lúc {new Date(updatedAt).toLocaleTimeString("vi-VN")}</span>
        </span>
        {!trashed && <>
          {!preserved && <>
          <Popover>
            <PopoverTrigger className={toolbarButton} aria-label="Nhờ AI chỉnh trang"><Sparkles aria-hidden="true" className="size-4 text-violet-600" /><span className="hidden md:inline">AI</span></PopoverTrigger>
            <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
              <p className="mb-2 text-sm font-medium">Nhờ AI chỉnh trang</p>
              <div className="flex gap-2">
                <Input aria-label="Yêu cầu AI chỉnh nội dung" value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void runAiEdit(); }} placeholder="Ví dụ: chia thành các mục ôn tập" />
                <Button onClick={() => void runAiEdit()} disabled={saving || aiBusy || !prompt.trim()}>{aiBusy ? <LoaderCircle className="animate-spin" /> : "Áp dụng"}</Button>
              </div>
              {!!history.length && <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">{history.map(change => <li key={change.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs"><span>{new Date(change.createdAt).toLocaleString("vi-VN")}</span>{change.undoneAt ? <span className="text-muted-foreground">Đã hoàn tác</span> : <Button type="button" variant="ghost" size="sm" disabled={saving || aiBusy} onClick={() => void undoAiEdit(change.id)}><Undo2 aria-hidden="true" /> Hoàn tác</Button>}</li>)}</ul>}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger className={toolbarButton} aria-label="Kiểu trang"><Type aria-hidden="true" className="size-4" /></PopoverTrigger>
            <PopoverContent align="end" className="max-h-[70vh] w-80 overflow-y-auto">
              <fieldset disabled={aiBusy}><PageStyleControls value={effectiveStyle} onChange={next => { if (!aiBusy) setStyle(next); }} /></fieldset>
              <Button type="button" variant="link" className="mt-2 px-0" onClick={() => setStyle(null)}>Dùng kiểu mặc định của tôi</Button>
            </PopoverContent>
          </Popover>
          </>}
          <button type="button" className={toolbarButton} aria-pressed={reading} aria-label={reading ? "Quay lại viết" : "Chế độ đọc"} onClick={() => setReading(value => !value)}>
            {reading ? <PencilLine aria-hidden="true" className="size-4" /> : <BookOpen aria-hidden="true" className="size-4" />}
          </button>
          <button type="button" className={toolbarButton} aria-pressed={isFavorite} aria-label={isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"} onClick={() => void updateMeta(page.id, { isFavorite: !isFavorite })}>
            <Star aria-hidden="true" className={cn("size-4", isFavorite && "fill-amber-400 text-amber-400")} />
          </button>
          <PageActionsMenu page={summary} className="size-8 rounded-md text-muted-foreground hover:bg-muted" />
        </>}
      </div>
    </div>

    {trashed && <div role="alert" className="mx-auto mt-3 flex max-w-3xl flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
      Trang này đang ở thùng rác.
      <Button type="button" size="sm" variant="outline" onClick={() => void updateMeta(page.id, { restore: true }).then(ok => { if (ok) setTrashed(false); })}>Khôi phục</Button>
    </div>}
    {preserved && <div role="alert" className="mx-auto mt-3 flex max-w-3xl flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm">
      Trang dùng định dạng chưa hỗ trợ. Nội dung gốc được giữ nguyên và không tự lưu.
      {!trashed && <Button type="button" size="sm" variant="outline" onClick={replacePreserved}>Thay bằng trang trống</Button>}
    </div>}
    {error && <p role="alert" className="mx-auto mt-3 max-w-3xl rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">{error}</p>}

    <article className={cn("note-styled-page mx-auto w-full", hasCustomPaper(effectiveStyle) && "my-6 rounded-2xl shadow-sm")} style={pageStyleCss(effectiveStyle)}>
      <fieldset disabled={aiBusy} className="min-w-0">
        <div className="group/cover pl-12 pt-8 sm:pt-12">
          <Popover open={iconOpen} onOpenChange={setIconOpen}>
            <PopoverTrigger asChild>
              {icon
                ? <button type="button" disabled={trashed || reading} aria-label="Đổi icon trang" className="mb-3 rounded-lg p-1 text-6xl leading-none hover:bg-black/5 dark:hover:bg-white/10">{icon}</button>
                : <button type="button" disabled={trashed || reading} className="mb-2 flex h-7 items-center gap-1.5 rounded-md px-1.5 text-sm text-muted-foreground opacity-0 hover:bg-muted focus-visible:opacity-100 group-hover/cover:opacity-100 disabled:hidden"><Smile aria-hidden="true" className="size-4" />Thêm icon</button>}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <IconPicker value={icon} onSelect={next => { void updateMeta(page.id, { icon: next }); setIconOpen(false); }} />
            </PopoverContent>
          </Popover>
          <AutoTextarea
            aria-label="Tên trang"
            readOnly={reading || trashed || preserved}
            value={title}
            maxLength={200}
            onChange={event => setTitle(event.target.value.replace(/\n/g, " "))}
            onBlur={() => { if (!title.trim()) setTitle("Trang mới"); }}
            onKeyDown={event => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              document.querySelector<HTMLElement>("[data-block-input]")?.focus();
            }}
            placeholder="Trang chưa đặt tên"
            className="text-[2.5em] font-bold leading-tight tracking-tight placeholder:text-muted-foreground"
          />
        </div>
        <div className="mt-4">
          {preserved ? <pre className="ml-12 mb-16 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-muted/60 p-4 text-xs">{page.content}</pre>
            : reading || trashed ? <div className="pb-16 pl-12"><NoteReadingView blocks={blocks} linkedTask={linkedTask} /></div>
            : <BlockEditor blocks={blocks} onChange={setBlocks} linkedTask={linkedTask} onPickTask={task => setPicked(current => ({ ...current, [task.id]: task }))} />}
        </div>
      </fieldset>
    </article>
    {!trashed && !preserved && <BoardAssistant context={{ kind: "page", pageId: page.id, expectedUpdatedAt: updatedAt }} label={`Trang: ${title}`} onEditPage={runAiEdit} />}
  </div>;
};
