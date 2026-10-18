"use client";

import Link from "@/web/shims/next-link";
import { OrganizationSwitcher, UserButton } from "@clerk/react";
import { useParams } from "@/web/shims/next-navigation";

import { MobileSidebar } from "./mobile-sidebar";
import { NotificationsPopover } from "@/components/notifications-popover";
import { AppearancePopover } from "@/components/appearance-popover";
import { NotificationToasts } from "@/components/notifications/notification-toasts";
import { RealtimeNotificationSync } from "@/components/notifications/realtime-notification-sync";
import { WorkspaceSearch } from "@/components/workspace-search";
import { BoardSidebarToggle } from "../board/[boardId]/_components/board-sidebar-toggle";

export const Navbar = () => {
    const params = useParams();
    const boardId = params.boardId as string;

    return (
        <nav aria-label="Thanh công cụ" className="fixed z-50 top-0 px-4 md:px-6 w-full h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center justify-between gap-x-3">
            <RealtimeNotificationSync />
            <NotificationToasts />

            {/* Left Section */}
            <div className="flex items-center gap-x-2 md:gap-x-3 shrink-0">
                <MobileSidebar />
                <div className="flex items-center gap-x-2">
                    <Link href="/my/today" aria-label="UniFlow — Hôm nay" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                      <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-lg bg-violet-700 text-lg font-medium text-white">u</span>
                      <span className="hidden sm:inline">uniflow</span>
                      <span className="ml-1 hidden text-[10px] font-normal tracking-normal text-muted-foreground lg:inline">HUST</span>
                    </Link>
                    {boardId && <BoardSidebarToggle variant="navbar" />}
                </div>
            </div>

            {/* Center Section */}
            <div className="flex-1 flex justify-center max-w-xl mx-auto">
                <WorkspaceSearch />
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-x-3 shrink-0">
                <AppearancePopover />
                <NotificationsPopover />
                <div className="hidden sm:block"><OrganizationSwitcher
                    hidePersonal
                    afterCreateOrganizationUrl="/organization/:id"
                    afterSelectOrganizationUrl="/organization/:id"
                    afterLeaveOrganizationUrl="/select-org"
                    appearance={{
                        elements: {
                            rootBox: {
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                             },
                        },
                    }}
                /></div>
                <UserButton
                    appearance={{
                        elements: {
                            avatarBox: {
                                height: 30,
                                width: 30,
                            },
                        },
                    }}
                />
            </div>
        </nav>
    );
};
