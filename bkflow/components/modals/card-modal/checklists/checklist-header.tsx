"use client";

import { useRef, useState, type ReactNode } from "react";
import { CheckSquare, Eye, EyeOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tr } from "@/lib/i18n";

interface ChecklistHeaderProps {
  title: string;
  completedCount: number;
  isHidingCompleted: boolean;
  isRenaming: boolean;
  onDelete: () => void;
  onRename: (title: string) => void;
  onToggleHideCompleted: () => void;
  canEdit?: boolean;
  compact?: boolean;
  actions?: ReactNode;
  totalCount?: number;
}

export const ChecklistHeader = ({
  title,
  completedCount,
  isHidingCompleted,
  isRenaming,
  onDelete,
  onRename,
  onToggleHideCompleted,
  canEdit = true,
  compact = false,
  actions,
  totalCount,
}: ChecklistHeaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  const startEditing = () => {
    if (!canEdit) {
      return;
    }

    setIsEditing(true);
    setDraftTitle(title);
    setTimeout(() => inputRef.current?.focus());
  };

  const cancelEditing = () => {
    setDraftTitle(title);
    setIsEditing(false);
  };

  const save = () => {
    const nextTitle = draftTitle.trim();

    if (!nextTitle || nextTitle === title) {
      cancelEditing();
      return;
    }

    onRename(nextTitle);
    setIsEditing(false);
  };

  const toggleLabel = isHidingCompleted ? tr("checklist.showCompleted") : tr("checklist.hideCompleted");

  return (
    <div className="flex items-start justify-between gap-x-3 w-full">
      <div className="flex min-w-0 items-start gap-x-3.5">
        <div className={compact ? "hidden" : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"}>
          <CheckSquare className="h-5 w-5 text-neutral-500" />
        </div>
        {isEditing ? (
          <Input
            ref={inputRef}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelEditing();
              }
            }}
            disabled={isRenaming}
            className="h-9 min-w-0 rounded-lg border-violet-400 text-base font-semibold focus-visible:ring-1 focus-visible:ring-violet-200"
            aria-label={tr("checklist.renameAria")}
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            disabled={!canEdit}
            className={`min-w-0 rounded-md px-1 py-1 text-left font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent ${compact ? "text-xs" : "text-base"}`}
          >
            <span className="block break-words">{title}{compact && <span className="ml-2 text-[10px] font-normal tabular-nums text-muted-foreground">{completedCount}/{totalCount}</span>}</span>
          </button>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1">
        {actions}
        {completedCount > 0 && (
          <Button
            onClick={onToggleHideCompleted}
            variant="outline"
            size="sm"
            aria-label={toggleLabel}
            className="h-8 rounded-lg border-neutral-200 text-xs text-neutral-600 hover:bg-neutral-50 font-semibold cursor-pointer"
          >
            {compact ? (isHidingCompleted ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />) : toggleLabel}
          </Button>
        )}
        {canEdit && (
          <Button
            onClick={onDelete}
            aria-label={tr("checklist.deleteAria")}
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-neutral-200 text-xs text-neutral-600 hover:bg-neutral-50 font-semibold cursor-pointer"
          >
            {compact ? <Trash2 className="size-3.5" /> : tr("checklist.delete")}
          </Button>
        )}
      </div>
    </div>
  );
};
