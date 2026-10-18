"use client";

import Link from "@/web/shims/next-link";
import Image from "@/web/shims/next-image";
import { usePathname } from "@/web/shims/next-navigation";
import { User } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { MySidebarNav } from "@/components/my-tasks/my-sidebar-nav";
import { useUser } from "@/web/lib/auth";
import { cn } from "@/lib/utils";

interface SidebarProps {
  storageKey?: string;
}

export const Sidebar = ({
  storageKey: _storageKey = "t-sidebar-state",
}: SidebarProps) => {
  const pathname = usePathname();
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
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="flex items-center gap-x-1.5 text-xs font-bold uppercase tracking-wider text-violet-700">
            <User className="h-4 w-4" />
            <span>Không gian cá nhân</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <Link
            href="/my/today"
            className={cn(
              "flex items-center gap-x-2.5 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted group",
              pathname === "/my/today" && "border-violet-200"
            )}
          >
            <div className="w-7 h-7 relative shrink-0 rounded-full overflow-hidden ring-2 ring-violet-200">
              {user?.imageUrl ? (
                <Image
                  fill
                  src={user.imageUrl}
                  alt={user?.fullName || "Sinh viên"}
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-violet-700 flex items-center justify-center text-white text-xs font-medium">
                  {user?.fullName?.[0]?.toUpperCase() || "U"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-neutral-800 truncate leading-tight">
                {user?.fullName || "Không gian của tôi"}
              </p>
              <p className="text-[11px] text-violet-600 font-medium">Học tập & cuộc sống</p>
            </div>
          </Link>

          <MySidebarNav />
        </div>
      </div>
    </div>
  );
};
