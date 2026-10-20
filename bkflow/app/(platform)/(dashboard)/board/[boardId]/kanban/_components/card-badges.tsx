"use client";

import { useSyncExternalStore } from "react";
import { CheckSquare, LockKeyhole, MessageSquare, Paperclip } from "lucide-react";

import { DueDateBadge } from "@/components/due-date-badge";
import { Hint } from "@/components/hint";
import { TaskLabels } from "@/components/tasks/task-labels";
import { safeLabelColor } from "@/lib/cards/task-labels";
import { cn, getColorName } from "@/lib/utils";
import type { CardBadgesProps } from "../_types";

const LABELS_STORAGE_KEY = "uniflow:labels-expanded";
let cachedSnapshot: boolean | null = null;

const labelsStore = {
  getSnapshot: (): boolean => {
    if (typeof window === "undefined") {
      return false;
    }

    if (cachedSnapshot === null) {
      cachedSnapshot = window.localStorage.getItem(LABELS_STORAGE_KEY) === "true";
    }

    return cachedSnapshot;
  },
  subscribe: (callback: () => void) => {
    if (typeof window === "undefined") {
      return () => {};
    }

    const handler = (event: StorageEvent) => {
      if (event.key === LABELS_STORAGE_KEY) {
        cachedSnapshot = event.newValue === "true";
        callback();
      }
    };

    window.addEventListener("storage", handler);

    return () => {
      window.removeEventListener("storage", handler);
    };
  },
  toggle: () => {
    if (typeof window === "undefined") {
      return;
    }

    const next = !labelsStore.getSnapshot();
    cachedSnapshot = next;
    window.localStorage.setItem(LABELS_STORAGE_KEY, String(next));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: LABELS_STORAGE_KEY,
        newValue: String(next),
      }),
    );
  },
};

export const CardLabels = ({
  card,
}: Pick<CardBadgesProps, "card">) => {
  const isExpanded = useSyncExternalStore(
    labelsStore.subscribe,
    labelsStore.getSnapshot,
    () => false,
  );

  const onToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    labelsStore.toggle();
  };

  if (!card.labels || card.labels.length === 0) {
    return null;
  }

  return (
    <div 
      onClick={onToggle}
      className="flex flex-wrap gap-1 mb-1.5 transition-all duration-300"
    >
      {isExpanded ? (
        <TaskLabels labels={card.labels.map((cardLabel) => cardLabel.label)} mode="full" />
      ) : (
        card.labels.map((cardLabel) => (
          <Hint
            key={cardLabel.id}
            description={`Màu: ${getColorName(cardLabel.label.color)}, Tiêu đề: ${cardLabel.label.title || "Không"}`}
            side="top"
            sideOffset={4}
          >
            <div
              className="h-2 w-10 rounded-full shadow-xs border border-black/5 hover:brightness-95 cursor-pointer"
              style={{ backgroundColor: safeLabelColor(cardLabel.label.color) }}
            />
          </Hint>
        ))
      )}
    </div>
  );
};

export const CardBadges = ({
  card,
}: CardBadgesProps) => {
  const fallbackChecklistTotalItems = card.checklists?.reduce((acc, cl) => acc + cl.items.length, 0) ?? 0;
  const fallbackChecklistCompletedItems = card.checklists?.reduce(
    (acc, cl) => acc + cl.items.filter((item) => item.isCompleted).length,
    0,
  ) ?? 0;
  const checklistTotalItems = card.checklistProgress?.total ?? fallbackChecklistTotalItems;
  const checklistCompletedItems = card.checklistProgress?.completed ?? fallbackChecklistCompletedItems;
  const hasChecklistProgress = checklistTotalItems > 0;
  const isChecklistAllDone = hasChecklistProgress && checklistCompletedItems === checklistTotalItems;

  const attachmentCount = card._count?.attachments ?? 0;
  const hasAttachments = attachmentCount > 0;
  const unresolvedBlockerCount = card.unresolvedBlockerCount ?? 0;
  const isBlocked = unresolvedBlockerCount > 0;

  const hasFooter = Boolean(card.dueDate) || Boolean(card.startDate) || card.isCompleted
    || Boolean(card._count && card._count.comments > 0) || hasChecklistProgress || hasAttachments || isBlocked;

  if (!hasFooter) {
    return null;
  }

  return (
    <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
      <div className="flex items-center gap-x-1.5 flex-wrap gap-y-1">
        {(card.dueDate || card.startDate) && (
          <DueDateBadge
            dueDate={card.dueDate}
            startDate={card.startDate}
            isCompleted={card.isCompleted}
            isCard
          />
        )}
        {!card.dueDate && card.isCompleted && (
          <Hint description="Thẻ đã hoàn thành" side="bottom">
            <span className="task-badge task-badge-success h-7 px-2">
              <CheckSquare aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Hoàn thành
            </span>
          </Hint>
        )}
        {isBlocked && (
          <Hint
            description={`Đang bị chặn bởi ${unresolvedBlockerCount} công việc`}
            side="bottom"
          >
            <div className="task-badge task-badge-warning">
              <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold leading-none">{unresolvedBlockerCount}</span>
            </div>
          </Hint>
        )}
        {card._count && card._count.comments > 0 && (
          <Hint description={`${card._count.comments} bình luận`} side="bottom">
            <div className="task-badge task-badge-neutral">
              <MessageSquare aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-none">{card._count.comments}</span>
            </div>
          </Hint>
        )}
        {hasAttachments && (
          <Hint description={`${attachmentCount} tệp đính kèm`} side="bottom">
            <div className="task-badge task-badge-neutral">
              <Paperclip aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-none">{attachmentCount}</span>
            </div>
          </Hint>
        )}
        {hasChecklistProgress && (
          <Hint description={`${checklistCompletedItems}/${checklistTotalItems} mục hoàn thành`} side="bottom">
            <div className={cn(
              "task-badge",
              isChecklistAllDone
                ? "task-badge-success"
                : "task-badge-neutral",
            )}>
              <CheckSquare aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold leading-none">
                {checklistCompletedItems}/{checklistTotalItems}
              </span>
            </div>
          </Hint>
        )}
      </div>
    </div>
  );
};
