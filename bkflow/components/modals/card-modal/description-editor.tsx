"use client";

import { useEffect, useId, useRef, useState, type ComponentProps, type RefObject } from "react";
import { toast } from "sonner";
import { generateAiSelection } from "@/actions/ai/generate-ai-selection";
import { SELECTION_TASKS, type SelectionTask } from "@/lib/ai/selection-contract";
import { applySelectionResult, filterSlashCommands, getSlashContext, insertSlashCommand, openSlashAtCursor } from "@/lib/cards/description-editor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = Omit<ComponentProps<"textarea">, "value" | "onChange" | "ref"> & {
  value: string;
  onValueChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  boardId?: string;
  cardId?: string;
  pageId?: string;
  onBusyChange: (busy: boolean) => void;
};

export const DescriptionEditor = ({ value, onValueChange, textareaRef, boardId, cardId, pageId, onBusyChange, disabled, onKeyDown, ...props }: Props) => {
  const menuId = useId();
  const hintId = useId();
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState<SelectionTask | null>(null);
  const [undo, setUndo] = useState<{ before: string; after: string } | null>(null);
  const currentValue = useRef(value);
  const mounted = useRef(false);
  const pending = useRef(false);
  useEffect(() => { currentValue.current = value; }, [value]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    onBusyChange(Boolean(busy));
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  const signature = `${value}:${selection.start}:${selection.end}`;
  const slash = dismissed === signature ? null : getSlashContext(value, selection.start, selection.end);
  const commands = slash ? filterSlashCommands(slash.query) : [];
  const selectedText = value.slice(selection.start, selection.end).trim();
  const canUseAi = Boolean(selectedText) && selectedText.length <= 8000 && !disabled && !busy;
  const activeCommand = commands[Math.min(activeIndex, commands.length - 1)];

  const moveCaret = (start: number, end = start) => {
    setSelection({ start, end });
    requestAnimationFrame(() => {
      if (!mounted.current) return;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start, end);
    });
  };

  const insertCommand = (markdown: string) => {
    if (!slash || disabled || busy) return;
    const next = insertSlashCommand(value, slash, markdown);
    onValueChange(next.value);
    setDismissed(null);
    moveCaret(next.caret);
  };

  const runAi = async (task: SelectionTask) => {
    if (!canUseAi || pending.current) return;
    pending.current = true;
    const snapshot = value;
    const { start, end } = selection;
    setBusy(task);
    try {
      if (!pageId && (!boardId || !cardId)) return;
      const resource = pageId ? { pageId } : { boardId: boardId!, cardId: cardId! };
      const response = await generateAiSelection({ ...resource, task, text: selectedText });
      if (!mounted.current) return;
      if (!response.data) {
        toast.error(response.error || Object.values(response.fieldErrors ?? {}).flat().join(" ") || "AI chưa trả được nội dung.");
        return;
      }
      const next = applySelectionResult(currentValue.current, snapshot, start, end, response.data.text, task);
      if (next === null) {
        toast.error("Mô tả đã thay đổi. Hãy chọn lại đoạn cần xử lý.");
        return;
      }
      setUndo({ before: snapshot, after: next });
      onValueChange(next);
      moveCaret(start, start + next.length - snapshot.length + end - start);
      toast.success("Đã cập nhật bản nháp. Bạn có thể hoàn tác hoặc lưu mô tả.");
    } catch {
      if (mounted.current) toast.error("Chưa kết nối được AI. Hãy thử lại.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(null);
    }
  };

  return <div className="space-y-2" onKeyDown={event => {
    if (slash && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDismissed(signature);
      textareaRef.current?.focus();
    }
  }}>
    <div className="flex flex-wrap gap-1" role="group" aria-label="Khối nội dung và AI cho đoạn được chọn">
      <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(busy)} onClick={() => {
        const next = openSlashAtCursor(value, selection.start);
        onValueChange(next.value);
        setDismissed(null);
        setActiveIndex(0);
        moveCaret(next.caret);
      }}>Thêm nội dung</Button>
      {(Object.keys(SELECTION_TASKS) as SelectionTask[]).map(task => <Button
        key={task} type="button" size="sm" variant="ghost" disabled={!canUseAi}
        title="Bôi đen đoạn văn bản để dùng AI" onClick={() => void runAi(task)}
      >{busy === task ? "Đang xử lý…" : `AI: ${SELECTION_TASKS[task].label}`}</Button>)}
      {undo && <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(busy) || value !== undo.after} onClick={() => {
        if (value !== undo.after) return;
        onValueChange(undo.before);
        setUndo(null);
        moveCaret(undo.before.length);
      }}>Hoàn tác AI gần nhất</Button>}
    </div>
    <Textarea {...props} ref={textareaRef} value={value} disabled={disabled || Boolean(busy)}
      aria-describedby={[props["aria-describedby"], hintId].filter(Boolean).join(" ")}
      aria-controls={slash ? menuId : undefined}
      aria-activedescendant={slash && activeCommand ? `${menuId}-${activeCommand.id}` : undefined}
      onChange={event => {
        onValueChange(event.target.value);
        setSelection({ start: event.target.selectionStart, end: event.target.selectionEnd });
        setActiveIndex(0);
        setDismissed(null);
      }}
      onSelect={event => setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (slash && ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key) && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          if (event.key === "Escape") setDismissed(signature);
          else if (event.key === "Enter" && activeCommand) insertCommand(activeCommand.markdown);
          else if (event.key === "ArrowDown") setActiveIndex(index => commands.length ? (index + 1) % commands.length : 0);
          else if (event.key === "ArrowUp") setActiveIndex(index => commands.length ? (index - 1 + commands.length) % commands.length : 0);
          return;
        }
        onKeyDown?.(event);
      }}
    />
    {slash && <div id={menuId} role="listbox" aria-label="Chọn khối nội dung" className="rounded-lg border bg-popover p-1 text-popover-foreground shadow-sm">
      {commands.map(command => <button key={command.id} id={`${menuId}-${command.id}`} type="button" role="option"
        aria-selected={activeCommand?.id === command.id} disabled={disabled || Boolean(busy)}
        onMouseDown={event => event.preventDefault()} onClick={() => insertCommand(command.markdown)}
        className={`block w-full rounded-md px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring ${activeCommand?.id === command.id ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
      >{command.label}</button>)}
      {!commands.length && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Không tìm thấy lệnh. Nhấn Esc để tiếp tục viết.</p>}
    </div>}
    <p id={hintId} className="text-xs text-muted-foreground" role="status" aria-live="polite">
      {busy ? "AI đang xử lý đoạn đã chọn…" : selectedText.length > 8000 ? "Chọn tối đa 8.000 ký tự để dùng AI." : "Gõ / đầu dòng; dùng ↑ ↓, Enter để chọn khối, Esc để đóng. Bôi đen để dùng AI; giải thích được chèn sau đoạn chọn."}
    </p>
  </div>;
};
