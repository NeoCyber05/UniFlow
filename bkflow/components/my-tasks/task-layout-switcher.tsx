"use client";

import { Columns3, Rows3 } from "lucide-react";
import { tr } from "@/lib/i18n";

import { getTaskLayoutHref, type TaskLayout } from "@/lib/my-tasks/task-layout";
import { cn } from "@/lib/utils";
import Link from "@/web/shims/next-link";
import { useSearchParams } from "@/web/shims/next-navigation";

export const TaskLayoutSwitcher = ({ boardId, layout }: { boardId: string; layout: TaskLayout }) => {
  const searchParams = useSearchParams();

  return (
    <nav aria-label={tr("tasks.layoutLabel")} className="inline-flex shrink-0 rounded-xl bg-neutral-100 p-1 text-xs font-medium">
      {([
        ["rows", tr("tasks.layoutRows"), Rows3],
        ["columns", tr("tasks.layoutColumns"), Columns3],
      ] as const).map(([value, label, Icon]) => (
        <Link
          key={value}
          href={getTaskLayoutHref(boardId, value, searchParams.toString())}
          aria-current={layout === value ? "page" : undefined}
          onClick={(event) => { if (layout === value) event.preventDefault(); }}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            layout === value ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/70" : "text-neutral-500 hover:text-neutral-900",
          )}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {label}
        </Link>
      ))}
    </nav>
  );
};
