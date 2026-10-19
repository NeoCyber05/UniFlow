"use client";

import { PanelLeftClose, Sidebar as SidebarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sidebar } from "@/app/(platform)/(dashboard)/_components/sidebar";
import { useBoardSidebar } from "@/hooks/use-board-sidebar";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { cn } from "@/lib/utils";

export const BoardSidebar = () => {
  const isMounted = useIsMounted();
  const isOpen = useBoardSidebar((state) => state.isOpen);
  const close = useBoardSidebar((state) => state.close);

  // Tránh hydration mismatch: trước khi mount, giữ trạng thái mở mặc định
  const effectiveIsOpen = isMounted ? isOpen : true;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 h-full overflow-hidden z-30",
        // Width snaps (one reflow); only the panel slides. On close the width waits for the slide.
        effectiveIsOpen ? "w-60" : "w-0 [transition:width_0s_200ms]"
      )}
      aria-label="Thanh điều hướng cá nhân"
      inert={!effectiveIsOpen}
    >
      <div
        className={cn(
          "w-60 flex flex-col h-full overflow-hidden border-r border-border bg-sidebar transition-transform duration-200 ease-[cubic-bezier(0.215,0.61,0.355,1)]",
          !effectiveIsOpen && "-translate-x-full"
        )}
      >
        {/* Header của Sidebar */}
        <div className="flex h-12 items-center justify-between px-3 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <SidebarIcon className="h-3.5 w-3.5 text-violet-600" />
            <span>Điều hướng</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={close}
            className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
            title="Thu gọn thanh bên"
            aria-label="Thu gọn thanh bên"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Nội dung Sidebar */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 scrollbar-thin">
          <Sidebar storageKey="t-sidebar-board-state" />
        </div>
      </div>
    </aside>
  );
};
