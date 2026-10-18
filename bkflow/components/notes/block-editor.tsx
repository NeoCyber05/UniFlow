"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CalendarClock, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NoteBlock } from "@/lib/notes/blocks";

const commandLabels = [
  ["paragraph", "Văn bản"], ["heading", "Tiêu đề"], ["todo", "Việc cần làm"],
  ["callout", "Ghi chú nổi bật"], ["divider", "Đường phân cách"], ["task", "Liên kết công việc"], ["deadline", "Hạn & nhắc"],
] as const;

// Keys must exist in reminderLabels (lib/notifications/reminder-notifications.ts).
const reminderOptions = [["none", "Không nhắc"], ["0", "Đúng giờ"], ["15", "Trước 15 phút"], ["60", "Trước 1 giờ"], ["1440", "Trước 1 ngày"], ["2880", "Trước 2 ngày"], ["10080", "Trước 1 tuần"]] as const;

// <input type="datetime-local"> works in local time without a zone suffix.
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const DeadlineBlock = ({ block, onChange }: { block: Extract<NoteBlock, { type: "deadline" }>; onChange: (patch: Partial<NoteBlock>) => void }) => {
  const [openedAt] = useState(() => Date.now());
  const overdue = !block.checked && Boolean(block.dueAt) && new Date(block.dueAt).getTime() < openedAt;
  return <div className={`ml-7 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${overdue ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40"}`}>
    <input type="checkbox" aria-label="Đánh dấu hạn đã xong" checked={block.checked} onChange={event => onChange({ checked: event.target.checked })} className="size-4 accent-primary" />
    <CalendarClock aria-hidden="true" className={`size-4 shrink-0 ${overdue ? "text-destructive" : "text-violet-600"}`} />
    <input aria-label="Tên hạn" value={block.text} maxLength={200} placeholder="Nộp bài, thi, đăng ký…" onChange={event => onChange({ text: event.target.value })} className={`min-w-40 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60 ${block.checked ? "text-muted-foreground line-through" : ""}`} />
    <input type="datetime-local" aria-label="Thời điểm hạn" value={toLocalInput(block.dueAt)} onChange={event => onChange({ dueAt: event.target.value ? new Date(event.target.value).toISOString() : "" })} className="h-8 rounded-md border bg-background px-2 text-sm" />
    <select aria-label="Nhắc trước" value={block.reminder} onChange={event => onChange({ reminder: event.target.value })} className="h-8 rounded-md border bg-background px-2 text-sm">
      {reminderOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    {overdue && <span className="text-xs font-medium text-destructive">Quá hạn</span>}
  </div>;
};

const makeBlock = (type: typeof commandLabels[number][0]): NoteBlock => {
  const id = crypto.randomUUID();
  if (type === "heading") return { id, type, level: 2, text: "" };
  if (type === "todo") return { id, type, checked: false, text: "" };
  if (type === "divider") return { id, type };
  if (type === "task") return { id, type, taskId: "" };
  if (type === "deadline") return { id, type, text: "", dueAt: "", reminder: "60", checked: false };
  return { id, type, text: "" };
};

export const BlockEditor = ({ blocks, onChange, tasks }: { blocks: NoteBlock[]; onChange: (blocks: NoteBlock[]) => void; tasks: { id: string; title: string; dueDate: string | null; boardId: string }[] }) => {
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (menuIndex !== null) menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [menuIndex]);
  const update = (index: number, patch: Partial<NoteBlock>) => onChange(blocks.map((block, current) => current === index ? { ...block, ...patch } as NoteBlock : block));
  const insert = (index: number, type: typeof commandLabels[number][0]) => {
    if (blocks.length >= 100) return;
    const next = [...blocks];
    next.splice(index + 1, 0, makeBlock(type));
    onChange(next);
    setMenuIndex(null);
  };
  const remove = (index: number) => onChange(blocks.length === 1 ? [makeBlock("paragraph")] : blocks.filter((_, current) => current !== index));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return <div className="space-y-1">
    {blocks.map((block, index) => <div key={block.id} className="group/block relative rounded-xl px-2 py-2 transition-colors hover:bg-black/[0.025] focus-within:bg-black/[0.025] dark:hover:bg-white/[0.035]">
      <div className="mb-1 flex items-center justify-end gap-0.5 text-muted-foreground">
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Thêm khối bên dưới" onClick={() => setMenuIndex(menuIndex === index ? null : index)}><Plus aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Di chuyển khối lên" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Di chuyển khối xuống" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Xóa khối" onClick={() => remove(index)}><Trash2 aria-hidden="true" /></Button>
      </div>
      {block.type === "deadline" ? <DeadlineBlock block={block} onChange={patch => update(index, patch)} /> : block.type === "divider" ? <hr className="my-3 border-border" aria-label="Đường phân cách" /> : block.type === "task" ? <div className="space-y-2 pl-7"><label className="block text-xs text-muted-foreground">Liên kết công việc<select aria-label="Công việc được liên kết" value={block.taskId} onChange={event => update(index, { taskId: event.target.value })} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"><option value="">Chọn công việc…</option>{block.taskId && !tasks.some(task => task.id === block.taskId) && <option value={block.taskId}>Công việc không còn trong học kỳ này</option>}{tasks.map(task => <option key={task.id} value={task.id}>{task.title}{task.dueDate ? ` · hạn ${new Date(task.dueDate).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : ""}</option>)}</select></label>{block.taskId && tasks.some(task => task.id === block.taskId) && <a className="text-xs font-medium text-primary underline-offset-4 hover:underline" href={`/board/${encodeURIComponent(tasks.find(task => task.id === block.taskId)!.boardId)}?cardId=${encodeURIComponent(block.taskId)}`}>Mở công việc ↗</a>}</div> : <div className={`pl-7 ${block.type === "callout" ? "rounded-lg border-l-2 border-primary/60 bg-primary/5 px-4 py-3" : ""}`}>
        {block.type === "todo" && <input type="checkbox" aria-label="Đánh dấu việc đã xong" checked={block.checked} onChange={event => update(index, { checked: event.target.checked })} className="mr-2 size-4 accent-primary align-middle" />}
        <textarea
          aria-label={block.type === "heading" ? "Tiêu đề khối" : block.type === "todo" ? "Nội dung việc cần làm" : block.type === "callout" ? "Nội dung ghi chú nổi bật" : "Đoạn văn bản"}
          value={block.text}
          rows={block.type === "heading" ? 1 : 2}
          maxLength={10000}
          placeholder={block.type === "heading" ? "Tiêu đề" : "Nhập nội dung... (gõ / để thêm khối)"}
          className={`w-full resize-y bg-transparent outline-none placeholder:text-muted-foreground/60 ${block.type === "heading" ? "text-xl font-semibold" : "text-[15px] leading-7"} ${block.type === "todo" && block.checked ? "text-muted-foreground line-through" : ""}`}
          onChange={event => update(index, { text: event.target.value })}
          onKeyDown={event => { if (event.key === "/" && !block.text && event.currentTarget.selectionStart === 0) { event.preventDefault(); setMenuIndex(index); } }}
        />
      </div>}
      {menuIndex === index && <div ref={menuRef} role="menu" aria-label="Chọn loại khối" className="ml-7 mt-2 flex flex-wrap gap-1 rounded-lg border bg-popover p-2 shadow-md" onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); setMenuIndex(null); return; }
        if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) return;
        event.preventDefault();
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
        const active = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const direction = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
        buttons[(active + direction + buttons.length) % buttons.length]?.focus();
      }}>{commandLabels.map(([type, label]) => <Button key={type} role="menuitem" disabled={blocks.length >= 100} size="sm" variant="ghost" onClick={() => insert(index, type)}>{label}</Button>)}</div>}
      <span className="sr-only">Khối {index + 1} trên {blocks.length}</span>
    </div>)}
    <div className="pl-7">
      <Button type="button" variant="ghost" size="sm" onClick={() => setMenuIndex(menuIndex === blocks.length - 1 ? null : blocks.length - 1)}><Plus aria-hidden="true" /> Thêm khối <kbd className="ml-1 rounded border px-1 text-[10px]">/</kbd></Button>
    </div>
  </div>;
};
