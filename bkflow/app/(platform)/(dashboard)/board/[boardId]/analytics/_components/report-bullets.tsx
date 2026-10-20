"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ReportTone = "success" | "danger" | "accent";

const toneClassName: Record<ReportTone, { icon: string; badge: string; marker: string; bar: string }> = {
  success: { icon: "bg-emerald-50 text-emerald-600", badge: "bg-emerald-50 text-emerald-700", marker: "text-emerald-500", bar: "bg-emerald-500" },
  danger: { icon: "bg-rose-50 text-rose-600", badge: "bg-rose-50 text-rose-700", marker: "text-rose-500", bar: "bg-rose-500" },
  accent: { icon: "bg-violet-50 text-violet-600", badge: "bg-violet-50 text-violet-700", marker: "text-violet-500", bar: "bg-violet-500" },
};

export const ReportBullets = ({
  title,
  items,
  tone,
  icon: Icon,
  emptyLabel,
  numbered = false,
}: {
  title: string;
  items: string[];
  tone: ReportTone;
  icon: LucideIcon;
  emptyLabel: string;
  numbered?: boolean;
}) => {
  const styles = toneClassName[tone];

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200/70 bg-white p-4">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", styles.bar)} />
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", styles.icon)}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="flex-1 text-sm font-semibold text-neutral-900">{title}</h3>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", styles.badge)}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">{emptyLabel}</p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {items.map((item, index) => (
            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-neutral-700">
              <span className={cn("mt-px w-4 shrink-0 text-center text-xs font-bold tabular-nums leading-relaxed", styles.marker)}>
                {numbered ? index + 1 : "•"}
              </span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
