"use client";

import { useSyncExternalStore } from "react";
import { CheckSquare, LockKeyhole, MessageSquare, Paperclip } from "lucide-react";

import { DueDateBadge } from "@/components/due-date-badge";
import { Hint } from "@/components/hint";
import { cn, getColorName } from "@/lib/utils";
import type { CardBadgesProps } from "../_types";

const getContrastColor = (hexColor: string): string => {
  let hex = hexColor.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (hex.length !== 6) {
    return "text-neutral-900";
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  
  const luminance = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  
  return luminance > 0.4 ? "text-neutral-900" : "text-white";
};

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
      {card.labels.map((cardLabel) => {
        const textClass = getContrastColor(cardLabel.label.color);
        
        return (
          <Hint
            key={cardLabel.id}
            description={`Màu: ${getColorName(cardLabel.label.color)}, Tiêu đề: ${cardLabel.label.title || "Không"}`}
            side="top"
            sideOffset={4}
          >
            {isExpanded ? (
              <div
                className={cn(
                  "h-5 min-w-8 max-w-[140px] px-2 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs border border-black/5 hover:opacity-90 transition-all duration-150 cursor-pointer select-none",
                  textClass
                )}
                style={{ backgroundColor: cardLabel.label.color }}
              >
                <span className="truncate">{cardLabel.label.title || " "}</span>
              </div>
            ) : (
              <div
                className="h-2 w-10 rounded-full shadow-xs border border-black/5 hover:brightness-95 cursor-pointer"
                style={{ backgroundColor: cardLabel.label.color }}
              />
            )}
          </Hint>
        );
      })}
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
            <span className="inline-flex h-7 items-center gap-x-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-semibold shadow-xs">
              <CheckSquare className="h-3 w-3.5 text-emerald-600 shrink-0" />
              Hoàn thành
            </span>
          </Hint>
        )}
        {isBlocked && (
          <Hint
            description={`Đang bị chặn bởi ${unresolvedBlockerCount} công việc`}
            side="bottom"
          >
            <div className="flex items-center gap-x-1 text-xs text-amber-700 py-0.5 px-1.5 rounded bg-amber-50 border border-amber-200">
              <LockKeyhole className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
              <span className="font-semibold leading-none">{unresolvedBlockerCount}</span>
            </div>
          </Hint>
        )}
        {card._count && card._count.comments > 0 && (
          <Hint description={`${card._count.comments} bình luận`} side="bottom">
            <div className="flex items-center gap-x-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors py-0.5 px-1.5 rounded bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-100">
              <MessageSquare className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
              <span className="font-semibold text-neutral-500 leading-none">{card._count.comments}</span>
            </div>
          </Hint>
        )}
        {hasAttachments && (
          <Hint description={`${attachmentCount} tệp đính kèm`} side="bottom">
            <div className="flex items-center gap-x-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors py-0.5 px-1.5 rounded bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-100">
              <Paperclip className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
              <span className="font-semibold text-neutral-500 leading-none">{attachmentCount}</span>
            </div>
          </Hint>
        )}
        {hasChecklistProgress && (
          <Hint description={`${checklistCompletedItems}/${checklistTotalItems} mục hoàn thành`} side="bottom">
            <div className={cn(
              "flex items-center gap-x-1 text-xs py-0.5 px-1.5 rounded border transition-colors",
              isChecklistAllDone
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-neutral-50 border-neutral-100 text-neutral-500 hover:bg-neutral-100/70",
            )}>
              <CheckSquare className={cn("h-3.5 w-3.5 flex-shrink-0", isChecklistAllDone ? "text-emerald-600" : "text-neutral-400")} />
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
