"use client";

import Link from "@/web/shims/next-link";
import Image from "@/web/shims/next-image";

import { Skeleton } from "@/components/ui/skeleton";
import { MySidebarNav } from "@/components/my-tasks/my-sidebar-nav";
import { useUser } from "@/web/lib/auth";

interface SidebarProps {
  storageKey?: string;
}

export const Sidebar = ({
  storageKey: _storageKey = "t-sidebar-state",
}: SidebarProps) => {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link
        href="/my/today"
        className="flex h-9 items-center gap-x-2 rounded-md px-2 hover:bg-muted"
      >
        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md">
          {user?.imageUrl ? (
            <Image
              fill
              src={user.imageUrl}
              alt={user?.fullName || "Sinh viên"}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-violet-600 text-xs font-medium text-white">
              {user?.fullName?.[0]?.toUpperCase() || "U"}
            </div>
          )}
        </div>
        <p className="truncate text-sm font-semibold text-foreground">
          {user?.fullName || "Không gian của tôi"}
        </p>
      </Link>

      <MySidebarNav />
    </div>
  );
};
