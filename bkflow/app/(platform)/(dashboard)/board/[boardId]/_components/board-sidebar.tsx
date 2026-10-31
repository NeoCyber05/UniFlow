"use client";

import { Sidebar } from "@/app/(platform)/(dashboard)/_components/sidebar";
import { useBoardSidebar } from "@/hooks/use-board-sidebar";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const BoardSidebar = () => {
  const isMounted = useIsMounted();
  const isOpen = useBoardSidebar((state) => state.isOpen);

  // Tránh hydration mismatch: trước khi mount, giữ trạng thái mở mặc định
  const effectiveIsOpen = isMounted ? isOpen : true;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 h-full overflow-hidden z-30",
        // Width snaps (one reflow); only the panel slides. On close the width waits for the slide.
        effectiveIsOpen ? "w-60" : "w-0 [transition:width_0s_200ms]"
      )}
      aria-label={tr("boardShell.sidebar.navLabel")}
      inert={!effectiveIsOpen}
    >
      <div
        className={cn(
          "w-60 flex flex-col h-full overflow-hidden border-r border-border bg-sidebar transition-transform duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)]",
          !effectiveIsOpen && "-translate-x-full"
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
