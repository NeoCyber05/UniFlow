"use client";

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from "react";
import { tr } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages/vi";
import {
  ArrowDown, ArrowUp, CalendarClock, CheckSquare, Copy, GripVertical, Heading1, Heading2, Heading3,
  Lightbulb, Link2, List, ListOrdered, Minus, Pilcrow, Plus, Quote, Repeat, Trash2, type LucideIcon,
} from "lucide-react";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteBlock } from "@/lib/notes/blocks";
import type { LinkedTaskView } from "@/lib/notes/contract";
import { LinkedTaskBlock, type PickedTask } from "@/components/notes/linked-task-block";
import {
  commandAfterEnter, convertBlock, isTextBlock, makeBlock, matchMarkdownShortcut, numberedIndex, shouldExitListOnEnter,
  type BlockCommand,
} from "@/lib/notes/block-editing";
import { toSearchKey } from "@/lib/my-tasks/parse-quick-add";
import { cn } from "@/lib/utils";

type Focus = { id: string; pos: number | "end" };

const COMMANDS: { command: BlockCommand; labelKey: MessageKey; keywords: string; icon: LucideIcon }[] = [
  { command: "paragraph", labelKey: "notes.block.paragraph", keywords: "text paragraph doan", icon: Pilcrow },
  { command: "h1", labelKey: "notes.block.h1", keywords: "heading h1 title", icon: Heading1 },
  { command: "h2", labelKey: "notes.block.h2", keywords: "heading h2", icon: Heading2 },
  { command: "h3", labelKey: "notes.block.h3", keywords: "heading h3", icon: Heading3 },
  { command: "todo", labelKey: "notes.block.todo", keywords: "todo checkbox check viec can lam", icon: CheckSquare },
  { command: "bullet", labelKey: "notes.block.bullet", keywords: "bullet list ul", icon: List },
  { command: "numbered", labelKey: "notes.block.numbered", keywords: "numbered list ol", icon: ListOrdered },
  { command: "quote", labelKey: "notes.block.quote", keywords: "quote", icon: Quote },
  { command: "callout", labelKey: "notes.block.callout", keywords: "callout highlight", icon: Lightbulb },
  { command: "divider", labelKey: "notes.block.divider", keywords: "divider line hr", icon: Minus },
  { command: "deadline", labelKey: "notes.block.deadline", keywords: "deadline reminder date nhac han", icon: CalendarClock },
  { command: "task", labelKey: "notes.block.task", keywords: "task card link the cong viec lien ket", icon: Link2 },
];
const TEXT_COMMANDS = COMMANDS.filter(item => !["divider", "deadline", "task"].includes(item.command));

const PLACEHOLDERS: Partial<Record<NoteBlock["type"], MessageKey>> = {
  todo: "notes.block.todo", bullet: "notes.block.list", numbered: "notes.block.list", quote: "notes.block.quote", callout: "notes.block.callout",
};

// Keys must exist in reminderLabels (lib/notifications/reminder-notifications.ts).
const reminderOptions = [["none", "notes.reminder.none"], ["0", "notes.reminder.onTime"], ["15", "notes.reminder.m15"], ["60", "notes.reminder.h1"], ["1440", "notes.reminder.d1"], ["2880", "notes.reminder.d2"], ["10080", "notes.reminder.w1"]] as const;

// <input type="datetime-local"> works in local time without a zone suffix.
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const supportsFieldSizing = typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content");

export const AutoTextarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || supportsFieldSizing) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} className={cn("block w-full resize-none overflow-hidden bg-transparent outline-none [field-sizing:content]", className)} />;
};

const DeadlineBlock = ({ block, onChange, onEnter }: { block: Extract<NoteBlock, { type: "deadline" }>; onChange: (patch: Partial<NoteBlock>) => void; onEnter: () => void }) => {
  const [openedAt] = useState(() => Date.now());
  const overdue = !block.checked && Boolean(block.dueAt) && new Date(block.dueAt).getTime() < openedAt;
  return <div className={cn("flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2", overdue ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40")}>
    <input type="checkbox" aria-label={tr("notes.deadline.doneAria")} checked={block.checked} onChange={event => onChange({ checked: event.target.checked })} className="size-4 accent-violet-600" />
    <CalendarClock aria-hidden="true" className={cn("size-4 shrink-0", overdue ? "text-destructive" : "text-violet-600")} />
    <span className="shrink-0 text-xs font-medium text-muted-foreground">{tr("notes.block.deadline")}</span>
    <input data-block-input={block.id} aria-label={tr("notes.deadline.nameAria")} value={block.text} maxLength={200} placeholder={tr("notes.deadline.namePlaceholder")} onChange={event => onChange({ text: event.target.value })} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); onEnter(); } }} className={cn("min-w-40 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60", block.checked && "text-muted-foreground line-through")} />
    <input type="datetime-local" aria-label={tr("notes.deadline.timeAria")} value={toLocalInput(block.dueAt)} onChange={event => onChange({ dueAt: event.target.value ? new Date(event.target.value).toISOString() : "" })} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground" />
    <select aria-label={tr("notes.deadline.reminderAria")} value={block.reminder} onChange={event => onChange({ reminder: event.target.value })} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground">
      {reminderOptions.map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}
    </select>
    {overdue && <span className="text-xs font-medium text-destructive">{tr("notes.deadline.overdue")}</span>}
  </div>;
};

const focusBlock = (target: Focus) => {
  const element = document.querySelector<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>(`[data-block-input="${target.id}"]`);
  if (!element) return;
  element.focus();
  if (element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && element.type === "text")) {
    const pos = target.pos === "end" ? element.value.length : target.pos;
    element.setSelectionRange(pos, pos);
  }
};

export const BlockEditor = ({ blocks, onChange, linkedTask, onPickTask }: {
  blocks: NoteBlock[];
  onChange: (blocks: NoteBlock[]) => void;
  linkedTask: (taskId: string) => LinkedTaskView;
  onPickTask: (task: PickedTask) => void;
}) => {
  const [slash, setSlash] = useState<{ id: string; active: number } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number | null } | null>(null);
  const focusRef = useRef<Focus | null>(null);
  const full = blocks.length >= 100;

  // Move the caret after structural edits (split, merge, convert) once the new blocks are rendered.
  useLayoutEffect(() => {
    const target = focusRef.current;
    focusRef.current = null;
    if (target) focusBlock(target);
  }, [blocks]);

  const commit = (next: NoteBlock[], focus?: Focus) => {
    focusRef.current = focus ?? null;
    onChange(next);
  };
  const replaceAt = (index: number, ...items: NoteBlock[]) => { const next = [...blocks]; next.splice(index, 1, ...items); return next; };
  const update = (index: number, patch: Partial<NoteBlock>) => commit(replaceAt(index, { ...blocks[index], ...patch } as NoteBlock));

  const slashBlock = slash ? blocks.find(block => block.id === slash.id) : undefined;
  const slashQuery = slashBlock && "text" in slashBlock && slashBlock.text.startsWith("/") ? slashBlock.text.slice(1) : null;
  const slashItems = useMemo(() => slashQuery === null ? [] : COMMANDS.filter(item => toSearchKey(`${tr(item.labelKey)} ${item.keywords}`).includes(toSearchKey(slashQuery))), [slashQuery]);
  const slashOpen = slash !== null && slashQuery !== null;

  const applyCommand = (index: number, command: BlockCommand) => {
    const block = blocks[index];
    const stripped = "text" in block && block.text.startsWith("/") ? { ...block, text: "" } as NoteBlock : block;
    const converted = convertBlock(stripped, command);
    setSlash(null);
    setMenuFor(null);
    if (command === "divider" && !full) {
      const paragraph = makeBlock("paragraph");
      commit(replaceAt(index, converted, paragraph), { id: paragraph.id, pos: 0 });
      return;
    }
    commit(replaceAt(index, converted), { id: converted.id, pos: "end" });
  };

  const insertBelow = (index: number, block: NoteBlock = makeBlock("paragraph"), openSlash = false) => {
    if (full) return;
    const next = [...blocks];
    next.splice(index + 1, 0, block);
    commit(next, { id: block.id, pos: "end" });
    if (openSlash) setSlash({ id: block.id, active: 0 });
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to > blocks.length || to === from || to === from + 1) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, item);
    commit(next);
  };

  const remove = (index: number, focus?: Focus) => commit(blocks.length === 1 ? [makeBlock("paragraph")] : blocks.filter((_, current) => current !== index), focus);

  const handleTextChange = (index: number, value: string) => {
    const block = blocks[index];
    if (block.type === "paragraph") {
      const shortcut = matchMarkdownShortcut(value);
      if (shortcut) {
        if (shortcut.command === "divider") { applyCommand(index, "divider"); return; }
        commit(replaceAt(index, convertBlock({ ...block, text: shortcut.rest }, shortcut.command)), { id: block.id, pos: 0 });
        return;
      }
    }
    if ("text" in block && block.text === "" && value === "/") setSlash({ id: block.id, active: 0 });
    update(index, { text: value });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const block = blocks[index];
    if (!isTextBlock(block) || event.nativeEvent.isComposing) return;

    if (slashOpen && slash.id === block.id) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const count = Math.max(slashItems.length, 1);
        setSlash({ id: block.id, active: (slash.active + (event.key === "ArrowDown" ? 1 : -1) + count) % count });
        return;
      }
      if (event.key === "Enter" && slashItems.length) { event.preventDefault(); applyCommand(index, slashItems[Math.min(slash.active, slashItems.length - 1)].command); return; }
      if (event.key === "Escape") { event.preventDefault(); setSlash(null); return; }
    }

    const element = event.currentTarget;
    const caret = element.selectionStart;
    const collapsed = caret === element.selectionEnd;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (shouldExitListOnEnter(block)) { commit(replaceAt(index, convertBlock(block, "paragraph")), { id: block.id, pos: 0 }); return; }
      if (full) return;
      const next = makeBlock(commandAfterEnter(block), block.text.slice(element.selectionEnd));
      commit(replaceAt(index, { ...block, text: block.text.slice(0, caret) } as NoteBlock, next), { id: next.id, pos: 0 });
      return;
    }

    if (event.key === "Backspace" && collapsed && caret === 0) {
      if (block.type !== "paragraph") { event.preventDefault(); commit(replaceAt(index, convertBlock(block, "paragraph")), { id: block.id, pos: 0 }); return; }
      if (index === 0) return;
      const previous = blocks[index - 1];
      if (isTextBlock(previous)) {
        event.preventDefault();
        const merged = { ...previous, text: previous.text + block.text } as NoteBlock;
        commit(blocks.flatMap((item, current) => current === index ? [] : current === index - 1 ? [merged] : [item]), { id: previous.id, pos: previous.text.length });
        return;
      }
      if (block.text === "") { event.preventDefault(); remove(index, { id: previous.id, pos: "end" }); }
      return;
    }

    if (event.key === "ArrowUp" && collapsed && caret === 0 && index > 0) { event.preventDefault(); focusBlock({ id: blocks[index - 1].id, pos: "end" }); return; }
    if (event.key === "ArrowDown" && collapsed && caret === block.text.length && index < blocks.length - 1) { event.preventDefault(); focusBlock({ id: blocks[index + 1].id, pos: 0 }); }
  };

  const renderText = (block: NoteBlock, index: number) => {
    if (!isTextBlock(block)) return null;
    const heading = block.type === "heading" ? block.level : null;
    const onlyEmpty = blocks.length === 1 && block.text === "";
    const label = heading ? tr("notes.block.headingLabel", { level: heading }) : tr(PLACEHOLDERS[block.type] ?? "notes.block.textPlaceholder");
    const textarea = <AutoTextarea
      data-block-input={block.id}
      aria-label={label}
      value={block.text}
      maxLength={10000}
      placeholder={heading || PLACEHOLDERS[block.type] ? label : tr("notes.block.slashHint")}
      onChange={event => handleTextChange(index, event.target.value)}
      onKeyDown={event => handleKeyDown(event, index)}
      onBlur={() => { if (slash?.id === block.id) setSlash(null); }}
      className={cn(
        "placeholder:text-muted-foreground/50",
        block.type === "paragraph" && !onlyEmpty && "placeholder:text-transparent focus:placeholder:text-muted-foreground/50",
        heading === 1 && "text-[1.875em] font-bold leading-tight",
        heading === 2 && "text-[1.5em] font-semibold leading-snug",
        heading === 3 && "text-[1.25em] font-semibold leading-snug",
        block.type === "todo" && block.checked && "text-muted-foreground line-through",
      )}
    />;

    if (block.type === "todo") return <div className="flex items-start gap-2">
      <input type="checkbox" aria-label={tr("notes.block.checkAria")} checked={block.checked} onChange={event => update(index, { checked: event.target.checked })} className="mt-[0.4em] size-4 shrink-0 accent-violet-600" />
      {textarea}
    </div>;
    if (block.type === "bullet") return <div className="flex items-start"><span aria-hidden="true" className="w-6 shrink-0 select-none text-center">•</span>{textarea}</div>;
    if (block.type === "numbered") return <div className="flex items-start"><span aria-hidden="true" className="w-6 shrink-0 select-none pr-1 text-right tabular-nums">{numberedIndex(blocks, index)}.</span>{textarea}</div>;
    if (block.type === "quote") return <div className="border-l-[3px] border-current/30 pl-3">{textarea}</div>;
    if (block.type === "callout") return <div className="flex items-start gap-2 rounded-lg bg-muted/70 px-3 py-2.5"><span aria-hidden="true">💡</span>{textarea}</div>;
    return textarea;
  };

  return <div>
    {blocks.map((block, index) => <div
      key={block.id}
      data-block-row
      className={cn("group/block relative py-[3px] pl-12", block.type === "heading" && (block.level === 1 ? "mt-6" : "mt-4"), drag?.from === index && "opacity-40")}
      onDragOver={event => {
        if (!drag) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const to = event.clientY < rect.top + rect.height / 2 ? index : index + 1;
        if (drag.to !== to) setDrag({ ...drag, to });
      }}
      onDrop={event => { event.preventDefault(); if (drag?.to != null) move(drag.from, drag.to); setDrag(null); }}
    >
      {drag?.to === index && <div aria-hidden="true" className="absolute inset-x-12 -top-px h-0.5 rounded bg-violet-500" />}
      {drag?.to === blocks.length && index === blocks.length - 1 && <div aria-hidden="true" className="absolute inset-x-12 -bottom-px h-0.5 rounded bg-violet-500" />}

      <div className={cn("absolute left-0 top-[3px] flex h-[1.7em] w-12 items-center justify-end gap-0.5 pr-1.5 text-muted-foreground opacity-0 transition-opacity group-hover/block:opacity-100 group-focus-within/block:opacity-100", menuFor === block.id && "opacity-100")}>
        <button type="button" disabled={full} onClick={() => insertBelow(index, makeBlock("paragraph", "/"), true)} aria-label={tr("notes.block.addBelow")} className="flex size-5 items-center justify-center rounded hover:bg-muted hover:text-foreground disabled:opacity-40">
          <Plus className="size-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            draggable
            onDragStart={event => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", block.id);
              const row = event.currentTarget.closest("[data-block-row]");
              if (row) event.dataTransfer.setDragImage(row, 24, 12);
              setDrag({ from: index, to: null });
            }}
            onDragEnd={() => setDrag(null)}
            onClick={() => setMenuFor(block.id)}
            aria-label={tr("notes.block.dragHandle")}
            aria-haspopup="menu"
            className="flex h-6 w-4 cursor-grab items-center justify-center rounded hover:bg-muted hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
          {/* The grip stays a plain draggable button; this hidden trigger only anchors the menu. */}
          <DropdownMenu open={menuFor === block.id} onOpenChange={open => setMenuFor(open ? block.id : null)}>
            <DropdownMenuTrigger asChild><span aria-hidden="true" tabIndex={-1} className="pointer-events-none absolute inset-0" /></DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="left" className="w-52">
              {isTextBlock(block) && <DropdownMenuSub>
                <DropdownMenuSubTrigger><Repeat className="size-4" />{tr("notes.block.convertTo")}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  {TEXT_COMMANDS.map(item => <DropdownMenuItem key={item.command} onSelect={() => applyCommand(index, item.command)}><item.icon className="size-4" />{tr(item.labelKey)}</DropdownMenuItem>)}
                </DropdownMenuSubContent>
              </DropdownMenuSub>}
              <DropdownMenuItem disabled={full} onSelect={() => insertBelow(index, { ...structuredClone(block), id: crypto.randomUUID() })}><Copy className="size-4" />{tr("notes.block.duplicate")}</DropdownMenuItem>
              <DropdownMenuItem disabled={index === 0} onSelect={() => move(index, index - 1)}><ArrowUp className="size-4" />{tr("notes.block.moveUp")}</DropdownMenuItem>
              <DropdownMenuItem disabled={index === blocks.length - 1} onSelect={() => move(index, index + 2)}><ArrowDown className="size-4" />{tr("notes.block.moveDown")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => remove(index)}><Trash2 className="size-4" />{tr("notes.block.delete")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {block.type === "divider" ? <div className="py-2"><hr className="border-border" aria-label={tr("notes.block.divider")} /></div>
        : block.type === "task" ? <LinkedTaskBlock block={block} resolved={linkedTask(block.taskId)} onRemove={() => remove(index)} onChoose={task => { onPickTask(task); update(index, { taskId: task.id }); }} />
        : block.type === "deadline" ? <DeadlineBlock block={block} onChange={patch => update(index, patch)} onEnter={() => insertBelow(index)} />
        : renderText(block, index)}

      {slashOpen && slash.id === block.id && <div
        role="listbox"
        aria-label={tr("notes.block.pickType")}
        onMouseDown={event => event.preventDefault()}
        className="absolute left-12 top-full z-30 mt-1 max-h-80 w-72 max-w-[calc(100vw-7rem)] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-sm text-popover-foreground shadow-xl"
      >
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{tr("notes.block.basic")}</p>
        {slashItems.length === 0 && <p className="px-2 py-2 text-muted-foreground">{tr("notes.block.noMatch")}</p>}
        {slashItems.map((item, itemIndex) => <button
          key={item.command}
          type="button"
          role="option"
          aria-selected={itemIndex === slash.active}
          onMouseEnter={() => setSlash({ id: block.id, active: itemIndex })}
          onClick={() => applyCommand(index, item.command)}
          className={cn("flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left", itemIndex === slash.active && "bg-muted")}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background"><item.icon className="size-4" /></span>
          {tr(item.labelKey)}
        </button>)}
      </div>}
    </div>)}
    {/* Clicking below the last block keeps typing in a paragraph, like AppFlowy. */}
    <div
      aria-hidden="true"
      className="h-24 cursor-text"
      onClick={() => {
        const last = blocks[blocks.length - 1];
        if (last.type === "paragraph" && last.text === "") focusBlock({ id: last.id, pos: 0 });
        else insertBelow(blocks.length - 1);
      }}
    />
  </div>;
};
