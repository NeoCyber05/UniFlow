"use client";

import { Sidebar } from "@/app/(platform)/(dashboard)/_components/sidebar";
import { useBoardSidebar } from "@/hooks/use-board-sidebar";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const BoardSidebar = ({ compact = false }: { compact?: boolean }) => {
  const expanded = useBoardSidebar((state) => state.calendarExpanded);
  const isMounted = useIsMounted();
  const isOpen = useBoardSidebar((state) => state.isOpen);

  // Tránh hydration mismatch: trước khi mount, giữ trạng thái mở mặc định
  const effectiveIsOpen = isMounted ? isOpen : true;

  if (compact && !expanded) {
    return (
      <aside aria-label={tr("boardShell.sidebar.navLabel")} className="hidden h-full w-16 shrink-0 flex-col border-r border-border glass-surface py-3 md:flex">
        <div className="min-h-0 flex-1 overflow-y-auto px-2"><Sidebar compact /></div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 h-full overflow-hidden z-30",
        // Width snaps (one reflow); only the panel slides. On close the width waits for the slide.
        (compact || effectiveIsOpen) ? "w-60" : "w-0 [transition:width_0s_200ms]"
      )}
      aria-label={tr("boardShell.sidebar.navLabel")}
      inert={!compact && !effectiveIsOpen}
    >
      <div
        className={cn(
          "w-60 flex flex-col h-full overflow-hidden border-r border-border glass-surface transition-transform duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)]",
          !compact && !effectiveIsOpen && "-translate-x-full"
        )}
      >
        {/* Nội dung Sidebar */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 scrollbar-thin">
          <Sidebar storageKey="t-sidebar-board-state" />
        </div>
      </div>
    </aside>
  );
};
