"use client";

import { useSyncExternalStore } from "react";
import { CheckSquare, LockKeyhole, MessageSquare, Paperclip } from "lucide-react";

import { DueDateBadge } from "@/components/due-date-badge";
import { Hint } from "@/components/hint";
import { TaskLabels } from "@/components/tasks/task-labels";
import { safeLabelColor } from "@/lib/cards/task-labels";
import { tr } from "@/lib/i18n";
import type { BoardMessageKey } from "@/lib/i18n/messages/vi-board";
import { cn } from "@/lib/utils";
import type { CardBadgesProps } from "../_types";

const COLOR_KEY_MAP: Record<string, BoardMessageKey> = {
  // Row 1
  "#bbf7d0": "kanban.color.lightGreen",
  "#fef08a": "kanban.color.lightYellow",
  "#fed7aa": "kanban.color.lightOrange",
  "#fecaca": "kanban.color.lightRed",
  "#f3e8ff": "kanban.color.lightPurple",
  // Row 2
  "#4ade80": "kanban.color.green",
  "#facc15": "kanban.color.yellow",
  "#fb923c": "kanban.color.orange",
  "#f87171": "kanban.color.red",
  "#c084fc": "kanban.color.purple",
  // Row 3
  "#15803d": "kanban.color.darkGreen",
  "#a16207": "kanban.color.darkYellow",
  "#c2410c": "kanban.color.darkOrange",
  "#b91c1c": "kanban.color.darkRed",
  "#7e22ce": "kanban.color.darkPurple",
  // Row 4
  "#dbeafe": "kanban.color.lightBlue",
  "#e0f2fe": "kanban.color.lightSky",
  "#d9f99d": "kanban.color.lightLime",
  "#fce7f3": "kanban.color.lightPink",
  "#e5e7eb": "kanban.color.lightGray",
  // Row 5
  "#3b82f6": "kanban.color.blue",
  "#0ea5e9": "kanban.color.sky",
  "#84cc16": "kanban.color.lime",
  "#db2777": "kanban.color.pink",
  "#9ca3af": "kanban.color.gray",
  // Row 6
  "#1d4ed8": "kanban.color.darkBlue",
  "#0369a1": "kanban.color.darkSky",
  "#4d7c0f": "kanban.color.darkLime",
  "#9d174d": "kanban.color.darkPink",
  "#4b5563": "kanban.color.darkGray",
  // Seeded default blue
  "#60a5fa": "kanban.color.blue",
};

function getLocalizedColorName(colorHex: string): string {
  const key = COLOR_KEY_MAP[colorHex.toLowerCase()];
  return tr(key ?? "kanban.color.other");
}

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
            description={tr("kanban.badges.labelTooltip", {
              color: getLocalizedColorName(cardLabel.label.color),
              title: cardLabel.label.title || tr("kanban.badges.noLabelTitle"),
            })}
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
          <Hint description={tr("kanban.badges.completedHint")} side="bottom">
            <span className="task-badge task-badge-success h-7 px-2">
              <CheckSquare aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {tr("kanban.badges.completedLabel")}
            </span>
          </Hint>
        )}
        {isBlocked && (
          <Hint
            description={tr("kanban.badges.blockedHint", { count: unresolvedBlockerCount })}
            side="bottom"
          >
            <div className="task-badge task-badge-warning">
              <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold leading-none">{unresolvedBlockerCount}</span>
            </div>
          </Hint>
        )}
        {card._count && card._count.comments > 0 && (
          <Hint description={tr("kanban.badges.commentsHint", { count: card._count.comments })} side="bottom">
            <div className="task-badge task-badge-neutral">
              <MessageSquare aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-none">{card._count.comments}</span>
            </div>
          </Hint>
        )}
        {hasAttachments && (
          <Hint description={tr("kanban.badges.attachmentsHint", { count: attachmentCount })} side="bottom">
            <div className="task-badge task-badge-neutral">
              <Paperclip aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-none">{attachmentCount}</span>
            </div>
          </Hint>
        )}
        {hasChecklistProgress && (
          <Hint
            description={tr("kanban.badges.checklistHint", {
              completed: checklistCompletedItems,
              total: checklistTotalItems,
            })}
            side="bottom"
          >
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
