"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { tr } from "@/lib/i18n";
import { useMatch } from "react-router";
import Link from "@/web/shims/next-link";
import { usePathname } from "@/web/shims/next-navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  CalendarDays,
  ListTodo,
  Network,
  BarChart3,
} from "lucide-react";

import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";
import { useSettingsModal } from "@/hooks/use-settings-modal";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { useMyTaskCounts, useMyTasksContext } from "@/hooks/use-my-tasks";
import { getBoardNavigation } from "@/lib/boards/navigation";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { cn } from "@/lib/utils";
import { viewQueryOptions } from "@/web/lib/use-view";
import { preloadRouteCode, preloadRouteCodeWhenIdle } from "@/web/lib/prefetch-route";
import { getBoardCalendarQueryOptions } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_hooks/use-calendar-query";

const EMPTY_COURSE_IDS: string[] = [];
const NAV_ICONS = { tasks: ListTodo, calendar: CalendarDays, graph: Network, analytics: BarChart3 };

// Ctrl/Cmd/Shift/chuột giữa mở tab mới, trang hiện tại không đổi
const isPlainClick = (event: MouseEvent) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

const itemClassName = (isActive: boolean) =>
  cn(
    "relative isolate flex h-11 w-full items-center gap-x-3 rounded-lg px-3 text-base text-sidebar-foreground transition-[background-color,transform] duration-150 hover:bg-sidebar-accent active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive && "font-semibold text-violet-700 dark:text-violet-300",
  );

// Trượt giữa các mục khi đổi trang (cùng kiểu với tab Cài đặt); lastHostRef riêng theo instance để sidebar desktop và sheet mobile không trượt qua nhau.
// Mỗi lúc chỉ một chỉ báo: khi mở Cài đặt, chỉ báo của trang hiện tại tạm ẩn.
// FLIP bằng Web Animations trên transform: chạy trên compositor, không tranh main thread với trang mới đang render
// (layout animation của motion chạy JS mỗi frame, làm trang mới hiện chậm hơn).
const ActiveIndicator = ({ lastHostRef }: { lastHostRef: RefObject<HTMLElement | null> }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    const previous = lastHostRef.current;
    if (!ref.current || !host) return;
    lastHostRef.current = host;
    if (!previous || previous === host || !previous.isConnected || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const from = previous.getBoundingClientRect();
    const to = host.getBoundingClientRect();
    ref.current.animate(
      [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: "none" }],
      { duration: 350, easing: "cubic-bezier(0.25, 1.15, 0.5, 1)" },
    );
  }, [lastHostRef]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 -z-10 rounded-lg bg-violet-500/15 shadow-[inset_3px_0_0_var(--color-violet-500)]"
    />
  );
};

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
  const settingsModal = useSettingsModal();
  const indicatorHostRef = useRef<HTMLElement>(null);
  // Mục vừa bấm sáng ngay; trang mới render trong transition nên pathname đổi sau
  const [pending, setPending] = useState<{ from: string; href: string } | null>(null);
  if (pending && pending.from !== pathname) setPending(null);
  const pendingHref = pending?.from === pathname ? pending.href : null;

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
    preloadRouteCode(href);
    void queryClient.prefetchQuery(viewQueryOptions(`/board/${boardId}/layout`));
    void queryClient.prefetchQuery(viewQueryOptions(href));
    if (href.endsWith("/calendar")) {
      void queryClient.prefetchQuery(getBoardCalendarQueryOptions(boardId));
    }
  };

  // Tải sẵn code các tab khi trình duyệt rảnh, lần bấm đầu không phải chờ chunk
  useEffect(() => {
    if (!boardId) return;
    return preloadRouteCodeWhenIdle(getBoardNavigation(boardId, "").map((item) => item.href));
  }, [boardId]);

  const workspaceBoardHref = context?.currentWorkspaceId ? `/workspace/${context.currentWorkspaceId}` : null;

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
      <WorkspaceSwitcher />

      {!boardId && workspaceBoardHref && (
        <Link href={workspaceBoardHref} aria-current={pathname === workspaceBoardHref ? "page" : undefined} className={itemClassName(pathname === workspaceBoardHref)}>
          <ListTodo className="h-5.5 w-5.5" />
          {tr("tasks.title")}
          <Count value={counts?.today} />
          {pathname === workspaceBoardHref && !settingsModal.isOpen && <ActiveIndicator lastHostRef={indicatorHostRef} />}
        </Link>
      )}
      {navigation.map(item => {
        const Icon = NAV_ICONS[item.id];
        const active = pendingHref
          ? item.href === pendingHref
          : item.active && (item.id !== "tasks" || selectedCourseIds.length === 0);
        return <Link key={item.id} href={item.href} onMouseEnter={() => prefetchBoard(item.href)} onFocus={() => prefetchBoard(item.href)} onClick={(event) => {
          if (isPlainClick(event)) setPending({ from: pathname, href: item.href });
          if (item.id === "tasks" || item.id === "calendar") clearBoardFilters();
          useMobileSidebar.getState().onClose();
        }} aria-current={active ? "page" : undefined} className={itemClassName(active)}>
          {active && !settingsModal.isOpen && <ActiveIndicator lastHostRef={indicatorHostRef} />}
          <Icon aria-hidden="true" className="h-5.5 w-5.5" />
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
          {settingsModal.isOpen && <ActiveIndicator lastHostRef={indicatorHostRef} />}
          <Settings aria-hidden="true" className="h-5.5 w-5.5" />
          {tr("common.settings")}
        </button>
      </div>
    </div>
  );
};
