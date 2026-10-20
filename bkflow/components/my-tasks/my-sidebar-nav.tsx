"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { useMatch } from "react-router";
import Link from "@/web/shims/next-link";
import { usePathname } from "@/web/shims/next-navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  Settings,
  CalendarDays,
  ListTodo,
  Network,
  BarChart3,
} from "lucide-react";

import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";
import { TrashDialog } from "@/components/notes/page-actions";
import { useSettingsModal } from "@/hooks/use-settings-modal";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { useMyTaskCounts, useMyTasksContext } from "@/hooks/use-my-tasks";
import { getBoardNavigation } from "@/lib/boards/navigation";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { cn } from "@/lib/utils";
import { viewQueryOptions } from "@/web/lib/use-view";
import { getBoardCalendarQueryOptions } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_hooks/use-calendar-query";

const EMPTY_COURSE_IDS: string[] = [];
const NAV_ICONS = { tasks: ListTodo, calendar: CalendarDays, graph: Network, analytics: BarChart3 };

const itemClassName = (isActive: boolean) =>
  cn(
    "flex h-8 w-full items-center gap-x-2.5 rounded-md px-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive && "bg-violet-500/15 font-semibold text-violet-700 shadow-[inset_3px_0_0_var(--color-violet-500)] hover:bg-violet-500/20 dark:text-violet-300",
  );

const Count = ({ value }: { value: number | undefined }) =>
  value ? (
    <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {value}
    </span>
  ) : null;

export const MySidebarNav = () => {
  const pathname = usePathname();
  const boardRoute = useMatch("/board/:boardId/*");
  const queryClient = useQueryClient();
  const { data: context } = useMyTasksContext();
  const { data: counts } = useMyTaskCounts();
  const [trashOpen, setTrashOpen] = useState(false);
  const settingsModal = useSettingsModal();

  const board = context?.board ?? null;
  const boardId = boardRoute?.params.boardId ?? board?.id;
  const navigation = boardId ? getBoardNavigation(boardId, pathname) : [];
  const isCurrentBoard = boardId === board?.id;
  const selectedCourseIds = useBoardFilters((state) =>
    boardId ? state.filtersByBoardId[boardId]?.selectedCourseIds ?? EMPTY_COURSE_IDS : EMPTY_COURSE_IDS
  );
  const clearBoardFilters = () => { if (boardId) useBoardFilters.getState().clearFilters(boardId); };
  const prefetchBoard = (href: string) => {
    if (!boardId) return;
    void queryClient.prefetchQuery(viewQueryOptions(`/board/${boardId}/layout`));
    void queryClient.prefetchQuery(viewQueryOptions(href));
    if (href.endsWith("/calendar")) {
      void queryClient.prefetchQuery(getBoardCalendarQueryOptions(boardId));
    }
  };

  const workspaceBoardHref = context?.currentWorkspaceId ? `/workspace/${context.currentWorkspaceId}` : null;

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
      <WorkspaceSwitcher />

      {!boardId && workspaceBoardHref && (
        <Link href={workspaceBoardHref} aria-current={pathname === workspaceBoardHref ? "page" : undefined} className={itemClassName(pathname === workspaceBoardHref)}>
          <ListTodo className="h-4 w-4" />
          {tr("tasks.title")}
          <Count value={counts?.today} />
        </Link>
      )}
      {navigation.map(item => {
        const Icon = NAV_ICONS[item.id];
        const active = item.active && (item.id !== "tasks" || selectedCourseIds.length === 0);
        return <Link key={item.id} href={item.href} onMouseEnter={() => prefetchBoard(item.href)} onFocus={() => prefetchBoard(item.href)} onClick={() => {
          if (item.id === "tasks" || item.id === "calendar") clearBoardFilters();
          useMobileSidebar.getState().onClose();
        }} aria-current={active ? "page" : undefined} className={itemClassName(active)}>
          <Icon aria-hidden="true" className="h-4 w-4" />
          {item.label}
          {item.id === "tasks" && isCurrentBoard && <Count value={counts?.today} />}
        </Link>;
      })}
      </div>

      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => {
            useMobileSidebar.getState().onClose();
            settingsModal.onOpen();
          }}
          className={itemClassName(settingsModal.isOpen)}
        >
          <Settings aria-hidden="true" className="h-4 w-4" />
          {tr("common.settings")}
        </button>
        <button type="button" onClick={() => setTrashOpen(true)} className={itemClassName(false)}>
          <Trash2 className="h-4 w-4" />
          {tr("sidebar.trash")}
        </button>
        <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} />
      </div>
    </div>
  );
};
