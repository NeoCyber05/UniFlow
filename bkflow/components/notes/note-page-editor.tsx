"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/web/shims/next-link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Smile, Star, LoaderCircle, Sparkles, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockEditor } from "@/components/notes/block-editor";
import { PageStyleControls } from "@/components/notes/page-style-controls";
import { parseNoteBlocks, serializeNoteBlocks, type NoteBlock } from "@/lib/notes/blocks";
import { pageStyleCss, type PageStyle } from "@/lib/notes/page-style";
import { NoteReadingView } from "@/components/notes/note-reading-view";
import { useAppearance } from "@/components/providers/appearance-provider";
import { shouldResaveNote } from "@/lib/notes/save-state";
import { NOTE_PAGES_KEY, useNotePages } from "@/components/notes/note-pages-list";
import { getPagePath } from "@/lib/notes/page-tree";
import { IconPicker, PageActionsMenu, rememberRecentPage, usePageActions } from "@/components/notes/page-actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Page = { id: string; title: string; content: string; style: PageStyle | null; updatedAt: string; icon?: string | null; isFavorite?: boolean; parentId?: string | null; deletedAt?: Date | string | null };
type UndoEntry = { id: string; createdAt: string; undoneAt: string | null };
const initialDraft = (page: Page) => ({ title: page.title, blocks: parseNoteBlocks(page.content), style: page.style });
const signature = (draft: { title: string; blocks: NoteBlock[]; style: PageStyle | null }) => JSON.stringify(draft);

export const NotePageEditor = ({ initialPage, tasks }: { initialPage: Page; tasks: { id: string; title: string; dueDate: string | null; boardId: string }[] }) => {
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
  const resaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const response = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, content: serializeNoteBlocks(draft.blocks), expectedUpdatedAt: versionRef.current }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Không lưu được trang.");
      versionRef.current = result.page.updatedAt;
      if (JSON.parse(savedSignatureRef.current).title !== draft.title) void queryClient.invalidateQueries({ queryKey: NOTE_PAGES_KEY });
      savedSignatureRef.current = currentSignature;
      setUpdatedAt(result.page.updatedAt);
      setSaved(signature(draftRef.current) === currentSignature);
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
  }, [page.id, queryClient]);

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

  const runAiEdit = async () => {
    if (!prompt.trim() || aiRequestRef.current) return;
    aiRequestRef.current = true;
    setAiBusy(true);
    setError("");
    try {
      if (!(await saveChanges())) return;
      const response = await fetch(`/api/pages/${page.id}/ai`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, expectedUpdatedAt: versionRef.current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "AI chưa chỉnh được trang.");
      const nextBlocks = parseNoteBlocks(result.page.content);
      const nextDraft = { title: result.page.title, blocks: nextBlocks, style: result.page.style ?? style };
      setTitle(nextDraft.title); setBlocks(nextBlocks); setStyle(nextDraft.style);
      versionRef.current = result.page.updatedAt; setUpdatedAt(result.page.updatedAt);
      draftRef.current = nextDraft; savedSignatureRef.current = signature(nextDraft); setSaved(true);
      setHistory(current => [result.change, ...current]); setPrompt("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI chưa chỉnh được trang."); }
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không hoàn tác được thay đổi."); }
    finally { aiRequestRef.current = false; setAiBusy(false); }
  };

  const effectiveStyle = style ?? defaultStyle;

  return <main className="mx-auto w-full px-4 pb-24 pt-5 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <Link href="/pages" className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground">Trang của tôi</Link>
          {ancestors.map(ancestor => <span key={ancestor.id} className="flex min-w-0 items-center gap-1">
            <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
            <Link href={`/pages/${encodeURIComponent(ancestor.id)}`} className="max-w-40 truncate rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground">{ancestor.title || "Trang chưa đặt tên"}</Link>
          </span>)}
          <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
          <span aria-current="page" className="flex min-w-0 items-center gap-1.5 px-1.5 text-foreground">{icon && <span aria-hidden="true">{icon}</span>}<span className="truncate">{title.trim() || "Trang chưa đặt tên"}</span></span>
        </nav>
        {!trashed && <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-pressed={isFavorite} aria-label={isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"} onClick={() => void updateMeta(page.id, { isFavorite: !isFavorite })}>
            <Star className={isFavorite ? "fill-amber-400 text-amber-400" : ""} />
          </Button>
          <PageActionsMenu page={summary} className="size-8" />
        </div>}
        <Button type="button" variant="outline" aria-pressed={reading} onClick={() => setReading(value => !value)}>{reading ? "Quay lại viết" : "Chế độ đọc"}</Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">{saving ? <><LoaderCircle className="size-3.5 animate-spin" /> Đang lưu</> : saved ? <><Check className="size-3.5" /> Đã lưu</> : "Chưa lưu"}<span className="sr-only">Cập nhật lúc {new Date(updatedAt).toLocaleTimeString("vi-VN")}</span></div>
      </header>
      {trashed && <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Trang này đang ở thùng rác.
        <Button type="button" size="sm" variant="outline" onClick={() => void updateMeta(page.id, { restore: true }).then(ok => { if (ok) setTrashed(false); })}>Khôi phục</Button>
      </div>}
      <article className="note-styled-page mx-auto rounded-2xl border border-border/70 bg-card shadow-sm" style={pageStyleCss(effectiveStyle)}>
        <fieldset disabled={aiBusy} className="mx-auto w-full min-w-0">
          <Popover open={iconOpen} onOpenChange={setIconOpen}>
            <PopoverTrigger asChild>
              {icon
                ? <button type="button" disabled={trashed} aria-label="Đổi icon trang" className="mb-2 rounded-lg p-1 text-5xl leading-none hover:bg-muted">{icon}</button>
                : <Button type="button" variant="ghost" size="sm" disabled={trashed || reading} className="mb-1 -ml-2 text-muted-foreground"><Smile aria-hidden="true" /> Thêm icon</Button>}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <IconPicker value={icon} onSelect={next => { void updateMeta(page.id, { icon: next }); setIconOpen(false); }} />
            </PopoverContent>
          </Popover>
          <Input aria-label="Tên trang" readOnly={reading} value={title} onChange={event => setTitle(event.target.value)} onBlur={() => { if (!title.trim()) setTitle("Trang mới"); }} placeholder="Trang chưa đặt tên" className="mb-7 h-auto border-0 bg-transparent px-0 py-1 text-3xl font-semibold shadow-none focus-visible:ring-0 sm:text-4xl" />
          <div hidden={reading}>
          <BlockEditor blocks={blocks} onChange={setBlocks} tasks={tasks} />
          <section className="mt-9 border-t border-border/60 pt-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium"><Sparkles aria-hidden="true" className="size-4 text-primary" /> Nhờ AI chỉnh trang</h2>
            <div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Yêu cầu AI chỉnh nội dung" value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void runAiEdit(); }} placeholder="Ví dụ: chia ghi chú thành các mục ôn tập" /><Button onClick={() => void runAiEdit()} disabled={saving || aiBusy || !prompt.trim()} className="min-h-11">{aiBusy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Áp dụng</Button></div>
            {!!history.length && <ul className="mt-3 space-y-1">{history.map(change => <li key={change.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs"><span>AI chỉnh trang · {new Date(change.createdAt).toLocaleString("vi-VN")}</span>{change.undoneAt ? <span className="text-muted-foreground">Đã hoàn tác</span> : <Button type="button" variant="ghost" size="sm" disabled={saving || aiBusy} onClick={() => void undoAiEdit(change.id)}><Undo2 aria-hidden="true" /> Hoàn tác</Button>}</li>)}</ul>}
          </section>
          </div>
          {reading && <NoteReadingView blocks={blocks} tasks={tasks} />}
        </fieldset>
      </article>
      <details className="mx-auto mt-4 max-w-5xl rounded-xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">Tùy chỉnh trang</summary>
        <fieldset disabled={aiBusy} className="mt-4 max-w-xl"><PageStyleControls value={effectiveStyle} onChange={next => { if (!aiBusy) setStyle(next); }} /><Button type="button" variant="link" className="mt-3" onClick={() => setStyle(null)}>Dùng kiểu mặc định của tôi</Button></fieldset>
      </details>
      {error && <p role="alert" className="mx-auto mt-4 max-w-5xl rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <Button className="mt-4" disabled={saving || aiBusy} onClick={() => void saveChanges()} aria-label="Lưu trang">Lưu trang</Button>
    </div>
  </main>;
};
