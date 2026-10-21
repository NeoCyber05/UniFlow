"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { MySidebarNav } from "@/components/my-tasks/my-sidebar-nav";
import { useUser } from "@/web/lib/auth";

interface SidebarProps {
  storageKey?: string;
}

export const Sidebar = ({
  storageKey: _storageKey = "t-sidebar-state",
}: SidebarProps) => {
  const { isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  return <MySidebarNav />;
};
