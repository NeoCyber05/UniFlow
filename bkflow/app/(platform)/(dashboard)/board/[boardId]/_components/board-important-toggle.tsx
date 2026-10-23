"use client";

import { usePathname } from "@/web/shims/next-navigation";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { cn } from "@/lib/utils";

/** Lọc thẻ đã gắn ⭐ (trạng thái riêng từng người). Ẩn ở tab không áp bộ lọc. */
export const BoardImportantToggle = ({ boardId, tone = "dark" }: { boardId: string; tone?: "dark" | "light" }) => {
  const pathname = usePathname();
  const importantOnly = useBoardFilters((state) => state.filtersByBoardId[boardId]?.importantOnly ?? false);
  const toggleImportant = useBoardFilters((state) => state.toggleImportant);

  if (pathname.endsWith("/analytics") || pathname.endsWith("/graph")) {
    return null;
  }

  return (
    <Hint description={importantOnly ? "Đang lọc việc quan trọng" : "Chỉ hiện việc quan trọng"} side="bottom" sideOffset={8}>
      <Button
        type="button"
        size="icon"
        variant="transparent"
        onClick={() => toggleImportant(boardId)}
        aria-pressed={importantOnly}
        aria-label="Lọc việc quan trọng"
        className={cn(
          "h-8 w-8 rounded-lg shadow-sm cursor-pointer",
          tone === "dark"
            ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
            : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
          importantOnly && "border-amber-200 bg-amber-300 text-amber-950 hover:bg-amber-200",
        )}
      >
        <Star className={cn("h-4 w-4", importantOnly && "fill-amber-950")} />
      </Button>
    </Hint>
  );
};
