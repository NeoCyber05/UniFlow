import type { ListStatus } from "@/lib/boards/list-status";
import { cn } from "@/lib/utils";

const PILL: Record<ListStatus, string> = {
  todo: "task-badge-neutral",
  doing: "task-badge-info",
  review: "task-badge-review",
  blocked: "task-badge-warning",
  done: "task-badge-success",
  other: "task-badge-neutral",
};

/** Icon trạng thái kiểu Linear: vòng tròn rỗng → nửa → gần đầy → dấu tích. */
export const ListStatusIcon = ({ status, className }: { status: ListStatus; className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden className={cn("h-3.5 w-3.5 shrink-0", className)}>
    {status === "todo" && (
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.4 2.2" />
    )}
    {status === "doing" && (
      <>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor" />
      </>
    )}
    {status === "review" && (
      <>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 4a4 4 0 1 1-4 4h4z" fill="currentColor" />
      </>
    )}
    {status === "blocked" && (
      <>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 11 11 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    )}
    {status === "done" && (
      <>
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="m5 8.2 2 2 4-4.2" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
    {status === "other" && (
      <>
        <rect x="2.5" y="2.5" width="11" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8" cy="8" r="1.6" fill="currentColor" />
      </>
    )}
  </svg>
);

export const listStatusPillClassName = (status: ListStatus) =>
  cn("task-badge gap-1.5 px-2", PILL[status]);
