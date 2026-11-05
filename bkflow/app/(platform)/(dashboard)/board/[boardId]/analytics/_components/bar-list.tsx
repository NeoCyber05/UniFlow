"use client";

import { motion } from "motion/react";
import { spring, useTempoTransition } from "@animate-ui/react/utils/motion";

import { cn } from "@/lib/utils";

export type BarSegment = {
  label: string;
  value: number;
  className: string;
};

export type BarItem = {
  key: string;
  name: string;
  dotClassName?: string;
  segments: BarSegment[];
};

// Horizontal bars as plain rows: full names, ~36px per row, scrolls past max height
// instead of growing the panel (10+ courses stay compact).
export const BarList = ({ items, className }: { items: BarItem[]; className?: string }) => {
  const barSpring = useTempoTransition(spring.number);
  const totals = items.map((item) => item.segments.reduce((sum, segment) => sum + segment.value, 0));
  const max = Math.max(1, ...totals);

  return (
    <ul className={cn("max-h-[340px] space-y-1 overflow-y-auto pr-1 styled-scrollbar", className)}>
      {items.map((item, index) => {
        const total = totals[index];

        return (
          <li
            key={item.key}
            className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2rem] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-neutral-50"
            title={`${item.name}: ${item.segments.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              {item.dotClassName && <span className={cn("h-2 w-2 shrink-0 rounded-full", item.dotClassName)} />}
              <span className="truncate text-xs font-medium text-neutral-700">{item.name}</span>
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
              {/* Static width per total; the bar grows in by scaleX, never animating width. */}
              <motion.span
                className="flex h-full overflow-hidden rounded-full"
                style={{ width: `${(total / max) * 100}%`, originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ ...barSpring, delay: index * 0.03 }}
              >
                {item.segments.map((segment) =>
                  segment.value > 0 ? (
                    <span key={segment.label} className={cn("h-full", segment.className)} style={{ flexGrow: segment.value }} />
                  ) : null,
                )}
              </motion.span>
            </span>
            <span className="text-right text-xs font-semibold tabular-nums text-neutral-900">{total}</span>
          </li>
        );
      })}
    </ul>
  );
};

export const BarLegend = ({ segments }: { segments: Pick<BarSegment, "label" | "className">[] }) => (
  <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-2">
    {segments.map((segment) => (
      <span key={segment.label} className="flex items-center gap-1.5 text-xs text-neutral-500">
        <span className={cn("h-2 w-2 rounded-full", segment.className)} />
        {segment.label}
      </span>
    ))}
  </div>
);
