"use client";

import { PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBoardSidebar } from "@/hooks/use-board-sidebar";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface BoardSidebarToggleProps {
  className?: string;
}

export const BoardSidebarToggle = ({
  className,
}: BoardSidebarToggleProps = {}) => {
  const isMounted = useIsMounted();
  const isOpen = useBoardSidebar((state) => state.isOpen);
  const toggle = useBoardSidebar((state) => state.toggle);

  const effectiveIsOpen = isMounted ? isOpen : true;

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
      title={effectiveIsOpen ? tr("boardShell.sidebar.collapse") : tr("boardShell.sidebar.expand")}
      aria-label={effectiveIsOpen ? tr("boardShell.sidebar.collapse") : tr("boardShell.sidebar.expand")}
      aria-expanded={effectiveIsOpen}
    >
      <PanelLeft className="h-4 w-4" />
    </Button>
  );
};
