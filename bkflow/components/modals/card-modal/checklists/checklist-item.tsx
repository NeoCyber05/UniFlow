"use client";

import { type BoardMember } from "@/types";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";

import { GripVertical } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { ChecklistItemWithAssignee } from "@/types";

import { ChecklistItemActions } from "./checklist-item-actions";
import { ChecklistItemDueDate } from "./checklist-item-due-date";

interface ChecklistItemProps {
  item: ChecklistItemWithAssignee;
  boardMembers?: BoardMember[];
  isMutating: boolean;
  isTogglePending: boolean;
  maxDueDate?: Date | string | null;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  isDragging?: boolean;
  onAssign?: (itemId: string, assigneeId: string | null) => void;
  onDelete: (itemId: string) => void;
  onRename: (itemId: string, title: string) => void;
  onSetDueDate: (itemId: string, dueDate: Date | null) => void;
  onToggle: (itemId: string, isCompleted: boolean) => void;
  canEdit?: boolean;
}

export const ChecklistItem = ({
  item,
  isMutating,
  maxDueDate,
  dragHandleProps,
  isDragging = false,
  onDelete,
  onRename,
  onSetDueDate,
  onToggle,
  canEdit = true,
}: ChecklistItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const titleId = useId();
  const cancelledRef = useRef(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.blur();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelledRef.current = true;
      setTitle(item.title);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (cancelledRef.current) { cancelledRef.current = false; return; }
    const trimmedTitle = title.trim();

    if (!trimmedTitle || trimmedTitle === item.title) {
      setTitle(item.title);
      return;
    }

    onRename(item.id, trimmedTitle);
  };

  return (
    <div
      className={`group/item flex items-start justify-between gap-x-2 rounded-lg px-2 py-1.5 transition-colors ${
        isDragging ? "bg-white shadow-md ring-1 ring-black/5" : "hover:bg-neutral-50"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-x-2">
        {canEdit && (
          <button
            type="button"
            className="mt-1 text-neutral-400 hover:text-neutral-600 cursor-grab active:cursor-grabbing"
            aria-label="Kéo để sắp xếp mục"
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <input
          type="checkbox"
          id={titleId}
          aria-label={`Hoàn thành: ${item.title}`}
          checked={item.isCompleted}
          disabled={!canEdit}
          onChange={(e) => onToggle(item.id, e.target.checked)}
          className="mt-1 h-4 w-4 cursor-pointer rounded border-border accent-primary disabled:cursor-not-allowed"
        />
        <div className="min-w-0 flex-1">
          {isEditing && canEdit ? (
            <Textarea
              value={title}
              disabled={isMutating}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              autoFocus
              aria-label="Tên mục checklist"
              className="min-h-0 resize-none rounded-md border-neutral-300 px-2 py-1 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-neutral-400"
            />
          ) : (
            <div className="space-y-1">
              <button
                type="button"
                disabled={!canEdit}
                aria-label={`Sửa: ${item.title}`}
                onClick={(e) => {
                  if (canEdit) {
                    e.preventDefault();
                    cancelledRef.current = false;
                    setTitle(item.title);
                    setIsEditing(true);
                  }
                }}
                className={`block w-full cursor-text break-words rounded text-left text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-ring ${
                  item.isCompleted
                    ? "text-neutral-400 line-through"
                    : "text-neutral-700"
                }`}
              >
                {item.title}
              </button>
              {item.dueDate && (
                <div className="flex items-center gap-x-1">
                  <ChecklistItemDueDate
                    dueDate={item.dueDate}
                    isCompleted={item.isCompleted}
                    isPending={isMutating}
                    maxDueDate={maxDueDate}
                    onChange={(dueDate) => canEdit && onSetDueDate(item.id, dueDate)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-x-1">
        {canEdit && !item.dueDate && (
          <ChecklistItemDueDate
            dueDate={item.dueDate}
            isCompleted={item.isCompleted}
            isPending={isMutating}
            maxDueDate={maxDueDate}
            onChange={(dueDate) => onSetDueDate(item.id, dueDate)}
          />
        )}
        {canEdit && (
          <ChecklistItemActions
            isPending={isMutating}
            onDelete={() => onDelete(item.id)}
          />
        )}
      </div>
    </div>
  );
};
