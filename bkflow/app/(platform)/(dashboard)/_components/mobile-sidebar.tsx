"use client";

import { Menu } from "lucide-react";
import { useEffect } from "react";
import { usePathname } from "@/web/shims/next-navigation";

import { useIsMounted } from "@/hooks/use-is-mounted";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { Sidebar } from "./sidebar";

export const MobileSidebar = () => {
  const pathname = usePathname();
  const isMounted = useIsMounted();

  const onOpen = useMobileSidebar((state) => state.onOpen);
  const onClose = useMobileSidebar((state) => state.onClose);
  const isOpen = useMobileSidebar((state) => state.isOpen);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <Button
        onClick={onOpen}
        className="block md:hidden mr-2"
        variant="ghost"
        size="sm"
        aria-label="Mở điều hướng"
        aria-expanded={isOpen}
      >
        <Menu className="h-4 w-4" />
      </Button>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent
          side="left"
          className="overflow-y-auto bg-sidebar p-4 pt-10"
        >
          <SheetTitle className="sr-only">Điều hướng cá nhân</SheetTitle>
          <Sidebar
            storageKey="t-sidebar-mobile-state"
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
