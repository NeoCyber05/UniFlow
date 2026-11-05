"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ResultTone = "default" | "success" | "danger" | "warning";

const TILE_TONES: Record<ResultTone, string> = {
  default: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

/** Ô icon nhỏ: màu chỉ nằm ở đây, phần thẻ còn lại trung tính. */
export const IconTile = ({ icon: Icon, tone = "default", className }: { icon: LucideIcon; tone?: ResultTone; className?: string }) => (
  <span aria-hidden="true" className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", TILE_TONES[tone], className)}>
    <Icon className="size-3.5" />
  </span>
);

/**
 * Một khuôn cho mọi kết quả và đề xuất trong chat: nền thẻ, viền mảnh, icon có màu theo trạng thái.
 * Thay cho 6 màu nền theo loại kết quả trước đây.
 */
export const ResultCard = ({
  icon,
  tone = "default",
  title,
  subtitle,
  children,
  actions,
  className,
}: {
  icon: LucideIcon;
  tone?: ResultTone;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) => (
  <div className={cn("rounded-xl border bg-card text-card-foreground", tone === "danger" && "border-destructive/30", className)}>
    <div className="flex items-start gap-3 p-3">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="break-words text-sm font-semibold leading-snug">{title}</p>
        {subtitle ? <div className="break-words text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
    </div>
    {children ? <div className="space-y-2 px-3 pb-3 text-xs">{children}</div> : null}
    {actions ? <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">{actions}</div> : null}
  </div>
);

/** Liên kết nhỏ dạng chữ trong thẻ kết quả (Mở thẻ, Xem trước…). */
export const CardLink = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1 rounded text-xs font-medium text-violet-700 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-violet-300"
  >
    {children}
  </button>
);
