"use client";

import { PanelLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBoardSidebar } from "@/hooks/use-board-sidebar";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { cn } from "@/lib/utils";

interface BoardSidebarToggleProps {
  variant?: "navbar" | "board-navbar" | "docked";
  className?: string;
}

export const BoardSidebarToggle = ({
  variant = "navbar",
  className,
}: BoardSidebarToggleProps) => {
  const isMounted = useIsMounted();
  const isOpen = useBoardSidebar((state) => state.isOpen);
  const toggle = useBoardSidebar((state) => state.toggle);
  const open = useBoardSidebar((state) => state.open);

  const effectiveIsOpen = isMounted ? isOpen : true;

  if (variant === "docked") {
    // Chỉ hiện nút docked ở mép trái khi Sidebar đang đóng
    if (effectiveIsOpen) return null;

    return (
      <button
        type="button"
        onClick={open}
        className={cn(
          "absolute left-0 top-3 z-40 hidden md:flex items-center gap-1.5 rounded-r-lg border border-l-0 border-white/20 bg-black/40 hover:bg-black/60 px-2 py-1.5 text-xs text-white backdrop-blur-md shadow-md transition-colors group cursor-pointer",
          className
        )}
        title="Mở thanh điều hướng"
      >
        <PanelLeftOpen className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        <span className="text-[11px] font-medium hidden lg:inline">Menu</span>
      </button>
    );
  }

  if (variant === "board-navbar") {
    // Nút trên BoardNavbar (chỉ hiển thị khi Sidebar đang đóng để tiết kiệm diện tích)
    if (effectiveIsOpen) return null;

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={open}
        className={cn(
          "hidden md:flex items-center gap-1.5 h-8 px-2 text-white/90 hover:text-white hover:bg-white/20 mr-1.5 rounded-md",
          className
        )}
        title="Mở thanh điều hướng"
      >
        <PanelLeftOpen className="h-4 w-4" />
        <span className="text-xs font-normal">Thanh bên</span>
      </Button>
    );
  }

  // Variant "navbar" (trên Top Navbar cạnh logo)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={cn(
        "hidden md:flex h-8 w-8 text-foreground hover:bg-muted rounded-lg",
        effectiveIsOpen && "bg-muted text-foreground",
        className
      )}
      title={effectiveIsOpen ? "Thu gọn thanh bên" : "Mở thanh bên"}
      aria-label={effectiveIsOpen ? "Thu gọn thanh bên" : "Mở thanh bên"}
      aria-expanded={effectiveIsOpen}
    >
      <PanelLeft className="h-4 w-4" />
    </Button>
  );
};
