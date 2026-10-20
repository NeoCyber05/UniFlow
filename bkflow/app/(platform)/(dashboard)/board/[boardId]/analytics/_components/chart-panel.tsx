"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const ChartPanel = ({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn("flex h-full flex-col rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-xs transition-shadow duration-300 hover:shadow-md", className)}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Icon className="h-4.5 w-4.5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
    <div className="flex-1 pt-4">{children}</div>
  </section>
);
