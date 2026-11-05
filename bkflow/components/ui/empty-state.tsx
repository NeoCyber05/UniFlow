import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Minh hoạ nhỏ: ba ô bo góc chồng nhau, ô trên cùng mang icon. Không cần ảnh. */
const IconStack = ({ icon: Icon, small }: { icon: LucideIcon; small: boolean }) => (
  <span aria-hidden="true" className={cn("relative grid place-items-center", small ? "size-10" : "size-14")}>
    <span className={cn("absolute inset-0 -rotate-[10deg] rounded-xl bg-violet-500/15", small && "rounded-lg")} />
    <span className={cn("absolute inset-0 rotate-[6deg] rounded-xl border border-violet-500/20 bg-violet-500/5", small && "rounded-lg")} />
    <span className={cn("relative grid size-full place-items-center rounded-xl border bg-card text-violet-700 shadow-xs dark:text-violet-300", small && "rounded-lg")}>
      <Icon className={small ? "size-4" : "size-6"} />
    </span>
  </span>
);

/**
 * Màn trống dùng chung: minh hoạ, tiêu đề, mô tả và bước tiếp theo.
 * `size="sm"` cho chỗ hẹp (danh sách bên, popover).
 */
export const EmptyState = ({
  icon,
  title,
  description,
  actions,
  size = "default",
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  size?: "default" | "sm";
  className?: string;
}) => {
  const small = size === "sm";
  return (
    <div className={cn("flex flex-col items-center text-center", small ? "gap-2 px-3 py-6" : "gap-3 rounded-xl bg-muted/40 px-6 py-8", className)}>
      <IconStack icon={icon} small={small} />
      <div className="space-y-1">
        <p className={cn("font-semibold text-foreground", small ? "text-sm" : "text-base")}>{title}</p>
        {description ? <p className={cn("mx-auto max-w-sm text-muted-foreground", small ? "text-xs" : "text-sm")}>{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{actions}</div> : null}
    </div>
  );
};
