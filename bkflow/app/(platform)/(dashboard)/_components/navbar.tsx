"use client";

import Link from "@/web/shims/next-link";
import { useNavigate } from "react-router";

import { useUser, signOut } from "@/web/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Settings } from "lucide-react";

import { MobileSidebar } from "./mobile-sidebar";
import { NotificationsPopover } from "@/components/notifications-popover";
import { NotificationToasts } from "@/components/notifications/notification-toasts";
import { RealtimeNotificationSync } from "@/components/notifications/realtime-notification-sync";
import { WorkspaceSearch } from "@/components/workspace-search";
import { BoardSidebarToggle } from "../board/[boardId]/_components/board-sidebar-toggle";
import { useSettingsModal } from "@/hooks/use-settings-modal";

const UserMenu = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const settingsModal = useSettingsModal();

  if (!user) return null;

  const initials = (user.fullName || user.username || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex size-8 shrink-0 items-center justify-center rounded-full outline-hidden ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar className="size-8">
            <AvatarImage src={user.imageUrl} alt={user.fullName || "Avatar"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.fullName || "Người dùng"}</p>
            {user.primaryEmailAddress?.emailAddress && (
              <p className="text-xs leading-none text-muted-foreground">
                {user.primaryEmailAddress.emailAddress}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => settingsModal.onOpen()}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          Cài đặt
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={handleSignOut}
          className="cursor-pointer"
        >
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Navbar = () => {
    return (
        <nav aria-label="Thanh công cụ" className="fixed z-50 top-0 px-4 md:px-6 w-full h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center justify-between gap-x-3">
            <RealtimeNotificationSync />
            <NotificationToasts />

            {/* Left Section */}
            <div className="flex items-center gap-x-2 md:gap-x-3 shrink-0">
                <MobileSidebar />
                <div className="flex items-center gap-x-2">
                    <Link href="/my/today" aria-label="UniFlow — Hôm nay" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                      <img src="/logo.svg" alt="" aria-hidden="true" className="size-7 rounded-lg" />
                      <span className="hidden sm:inline">UniFlow</span>
                      <span className="ml-1 hidden text-[10px] font-normal tracking-normal text-muted-foreground lg:inline">HUST</span>
                    </Link>
                    <BoardSidebarToggle />
                </div>
            </div>

            {/* Center Section */}
            <div className="flex-1 flex justify-center max-w-xl mx-auto">
                <WorkspaceSearch />
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-x-3 shrink-0">
                <NotificationsPopover />
                <UserMenu />
            </div>
        </nav>
    );
};
