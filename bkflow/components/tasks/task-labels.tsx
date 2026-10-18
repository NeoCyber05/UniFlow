"use client";

import { useSyncExternalStore } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getLabelTextColor,
  partitionTaskLabels,
  safeLabelColor,
  type TaskLabel,
} from "@/lib/cards/task-labels";

const DESKTOP_QUERY = "(min-width: 640px)";

const subscribe = (callback: () => void) => {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
};
const useIsDesktop = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP_QUERY).matches, () => true);

const Badge = ({ label }: { label: TaskLabel }) => (
  <span
    title={label.title}
    style={{ backgroundColor: safeLabelColor(label.color), color: getLabelTextColor(label.color) }}
    className="inline-flex h-5 min-w-5 max-w-[9rem] items-center rounded-full border border-black/5 px-2 text-[10px] font-bold"
  >
    <span className="truncate">{label.title || "\u00a0"}</span>
  </span>
);

type TaskLabelsProps = {
  labels: TaskLabel[];
  /** compact: tối đa 2 (desktop) / 1 (mobile) + "+N"; full: hiện tất cả */
  mode: "compact" | "full";
};

export const TaskLabels = ({ labels, mode }: TaskLabelsProps) => {
  const isDesktop = useIsDesktop();
  if (labels.length === 0) return null;

  const { visible, hidden } = partitionTaskLabels(
    labels,
    mode === "full" ? labels.length : isDesktop ? 2 : 1,
  );

  // Chặn click/phím (kể cả từ nội dung Popover được portal) nổi lên hàng/thẻ cha.
  return (
    <span
      className="inline-flex flex-wrap items-center gap-1"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {visible.map((label) => (
        <Badge key={label.id} label={label} />
      ))}
      {hidden.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Xem thêm ${hidden.length} nhãn`}
              className="inline-flex h-5 items-center rounded-full bg-neutral-100 px-1.5 text-[10px] font-bold text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-200"
            >
              +{hidden.length}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-xs flex-row flex-wrap gap-1">
            {hidden.map((label) => (
              <Badge key={label.id} label={label} />
            ))}
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
};
