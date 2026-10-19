"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "@/web/shims/next-link";
import { usePathname } from "@/web/shims/next-navigation";
import {
  BarChart3,
  CalendarDays,
  Columns3,
  LayoutPanelLeft,
  List,
  LucideIcon,
  Network,
  X,
} from "lucide-react";
import type { BoardType } from "@prisma/client";

import { resolveViewOrder } from "@/lib/boards/view-order";
import { cn } from "@/lib/utils";

interface BoardViewSwitcherProps {
  boardId: string;
  boardType: BoardType;
}

const DEFAULT_VIEW_IDS = [
  "board",
  "list",
  "calendar",
  "graph",
  "analytics",
] as const;

type ViewId = (typeof DEFAULT_VIEW_IDS)[number];

type ViewItem = {
  id: ViewId;
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  canDragToSplit?: boolean;
  splitTooltip?: string;
};

const VIEW_ORDER_CHANGED_EVENT = "bkflow-view-order-changed";

const subscribeToViewOrder = (callback: () => void) => {
  window.addEventListener(VIEW_ORDER_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(VIEW_ORDER_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

const getViewOrderSnapshot = (boardId: string): string => {
  try {
    return (
      localStorage.getItem(`bkflow_view_order_${boardId}`) ||
      localStorage.getItem("bkflow_view_order_global") ||
      JSON.stringify(DEFAULT_VIEW_IDS)
    );
  } catch {
    return JSON.stringify(DEFAULT_VIEW_IDS);
  }
};

const getViewOrderServerSnapshot = () => JSON.stringify(DEFAULT_VIEW_IDS);

export const BoardViewSwitcher = ({ boardId, boardType }: BoardViewSwitcherProps) => {
  const pathname = usePathname();
  const calendarHref = `/board/${boardId}/calendar`;
  const graphHref = `/board/${boardId}/graph`;
  const analyticsHref = `/board/${boardId}/analytics`;
  const boardHref = `/board/${boardId}`;
  const listHref = `/board/${boardId}/list`;
  const splitHref = `/board/${boardId}/split`;

  const isBoard = pathname === boardHref;
  const isList = pathname === listHref;
  const isCalendar = pathname === calendarHref;
  const isGraph = pathname === graphHref;
  const isAnalytics = pathname === analyticsHref;
  const isSplit = pathname === splitHref;

  const [draggedViewId, setDraggedViewId] = useState<ViewId | null>(null);
  const [dragOverViewId, setDragOverViewId] = useState<ViewId | null>(null);
  const isDraggingRef = useRef(false);

  // Synchronize view order with localStorage using useSyncExternalStore
  const savedOrderJson = useSyncExternalStore(
    subscribeToViewOrder,
    () => getViewOrderSnapshot(boardId),
    getViewOrderServerSnapshot,
  );

  const orderedViewIds = useMemo(
    () => resolveViewOrder(savedOrderJson, DEFAULT_VIEW_IDS),
    [savedOrderJson],
  );

  const viewsMap: Record<ViewId, ViewItem> = useMemo(() => {
    return {
      board: {
        id: "board" as const,
        href: boardHref,
        label: "Bảng",
        icon: Columns3,
        active: isBoard,
        canDragToSplit: isCalendar,
        splitTooltip: isCalendar ? "kéo thả xuống để chia đôi với Lịch" : undefined,
      },
      list: {
        id: "list" as const,
        href: listHref,
        label: "Danh sách",
        icon: List,
        active: isList,
      },
      calendar: {
        id: "calendar" as const,
        href: calendarHref,
        label: "Lịch",
        icon: CalendarDays,
        active: isCalendar,
        canDragToSplit: isBoard,
        splitTooltip: isBoard ? "kéo thả xuống để chia đôi với Bảng" : undefined,
      },
      graph: {
        id: "graph" as const,
        href: graphHref,
        label: "Sơ đồ",
        icon: Network,
        active: isGraph,
      },
      analytics: {
        id: "analytics" as const,
        href: analyticsHref,
        label: "Thống kê",
        icon: BarChart3,
        active: isAnalytics,
      },
    };
  }, [
    boardHref,
    listHref,
    calendarHref,
    graphHref,
    analyticsHref,
    isBoard,
    isList,
    isCalendar,
    isGraph,
    isAnalytics,
  ]);

  const handleDragStart = (e: React.DragEvent, viewId: ViewId) => {
    isDraggingRef.current = true;
    setDraggedViewId(viewId);
    e.dataTransfer.setData("application/bkflow-tab-reorder", viewId);

    // Also support split drag if applicable
    const viewItem = viewsMap[viewId];
    if (viewItem?.canDragToSplit) {
      e.dataTransfer.setData("application/bkflow-split", viewId);
      window.dispatchEvent(new CustomEvent("bkflow-split-drag-start", { detail: { viewId } }));
    }

    e.dataTransfer.effectAllowed = "copyMove";
  };

  const handleDragOver = (e: React.DragEvent, targetViewId: ViewId) => {
    e.preventDefault();
    if (draggedViewId && draggedViewId !== targetViewId) {
      e.dataTransfer.dropEffect = "move";
      setDragOverViewId(targetViewId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, targetViewId: ViewId) => {
    if (dragOverViewId === targetViewId) {
      setDragOverViewId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetViewId: ViewId) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceViewId = (e.dataTransfer.getData("application/bkflow-tab-reorder") ||
      draggedViewId) as ViewId | null;

    if (!sourceViewId || sourceViewId === targetViewId) {
      setDraggedViewId(null);
      setDragOverViewId(null);
      return;
    }

    const oldIndex = orderedViewIds.indexOf(sourceViewId);
    const newIndex = orderedViewIds.indexOf(targetViewId);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const next = [...orderedViewIds];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);

      try {
        localStorage.setItem(`bkflow_view_order_${boardId}`, JSON.stringify(next));
        localStorage.setItem("bkflow_view_order_global", JSON.stringify(next));
      } catch {
        // Ignore localStorage write errors
      }

      window.dispatchEvent(new CustomEvent(VIEW_ORDER_CHANGED_EVENT));
    }

    setDraggedViewId(null);
    setDragOverViewId(null);
    window.dispatchEvent(new CustomEvent("bkflow-split-drag-end"));
  };

  const handleDragEnd = () => {
    setDraggedViewId(null);
    setDragOverViewId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 80);
    window.dispatchEvent(new CustomEvent("bkflow-split-drag-end"));
  };

  return (
    <div className="flex items-center gap-1.5">
      <nav
        aria-label="Chế độ xem bảng"
        className="flex h-8 shrink-0 items-center rounded-lg bg-white/10 p-0.5 ring-1 ring-white/15"
      >
        {orderedViewIds.map((viewId) => {
          const view = viewsMap[viewId];
          if (!view) return null;
          if (boardType === "SEMESTER" && (viewId === "list" || viewId === "calendar")) return null;
          const Icon = view.icon;

          const tooltip = view.splitTooltip
            ? `${view.label} (Kéo đổi thứ tự, hoặc ${view.splitTooltip})`
            : `${view.label} (Kéo thả để đổi thứ tự)`;

          const isBeingDragged = draggedViewId === view.id;
          const isDragOver = dragOverViewId === view.id;

          return (
            <Link
              key={view.id}
              href={view.href}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, view.id)}
              onDragOver={(e) => handleDragOver(e, view.id)}
              onDragLeave={(e) => handleDragLeave(e, view.id)}
              onDrop={(e) => handleDrop(e, view.id)}
              onDragEnd={handleDragEnd}
              onClick={(e) => {
                if (isDraggingRef.current) {
                  e.preventDefault();
                }
              }}
              aria-current={view.active ? "page" : undefined}
              title={tooltip}
              className={cn(
                "inline-flex h-7 min-w-7 items-center justify-center gap-x-1.5 rounded-md px-1.5 text-xs font-semibold text-white/75 transition select-none cursor-grab active:cursor-grabbing hover:bg-white/15 hover:text-white lg:px-2",
                view.active && "bg-white text-neutral-800 shadow-sm hover:bg-white hover:text-neutral-900",
                isBeingDragged && "opacity-30 scale-95",
                isDragOver && "ring-2 ring-violet-400 bg-white/20 scale-105 transition-transform",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden lg:inline">{view.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Split View Active Badge with quick exit button */}
      {isSplit && (
        <div className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-violet-600/90 px-2 text-xs font-semibold text-white shadow-sm ring-1 ring-white/20">
          <LayoutPanelLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Chia đôi: Bảng & Lịch</span>
          <Link
            href={boardHref}
            title="Thoát chế độ chia đôi"
            className="ml-1 rounded p-0.5 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <X className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
};

