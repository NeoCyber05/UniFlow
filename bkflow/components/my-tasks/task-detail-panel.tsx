"use client";

import { useEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import Link from "@/web/shims/next-link";
import { ExternalLink, Maximize2, Minimize2, Star, X } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
import { useQueryClient } from "@tanstack/react-query";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getCardQueryOptions } from "@/components/modals/card-modal/card-cache-utils";
import { CardDetailBody } from "@/components/modals/card-modal/card-detail-body";
import { CardRealtimeSync } from "@/components/modals/card-modal/card-realtime-sync";
import { runBeforeClose, type BeforeCloseRef } from "@/components/modals/card-modal/close-guard";
import { Button } from "@/components/ui/button";
import { useCardContext } from "@/hooks/use-my-tasks";
import { useMyTaskMutations } from "@/hooks/use-my-task-mutations";
import { cn } from "@/lib/utils";

type TaskDetailPanelProps = {
  taskId: string;
  onClose: () => void;
};

type TaskDetailPanelOuterProps = TaskDetailPanelProps & {
  /** Ghi đè vị trí/kích thước khi ở desktop (vd trong trang bảng) */
  desktopClassName?: string;
};

type PanelContentProps = TaskDetailPanelProps & { beforeCloseRef: BeforeCloseRef; expanded: boolean; onExpand: () => void };

const PanelContent = ({ taskId, onClose, beforeCloseRef, expanded, onExpand }: PanelContentProps) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.prefetchQuery(getCardQueryOptions(taskId));
  }, [taskId, queryClient]);
  const { data: context, isError, error, refetch, isFetching } = useCardContext(taskId);
  const errorStatus = isError ? (error as Error & { status?: number }).status : undefined;
  const isGone = errorStatus === 403 || errorStatus === 404;
  const requestClose = () => {
    void runBeforeClose(beforeCloseRef).then((ok) => ok && onClose());
  };
  const { setImportant } = useMyTaskMutations();
  const isReady = Boolean(context) && !isGone;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-12 shrink-0 items-center justify-end gap-1 border-b border-border px-4 py-2">
        <button
          type="button"
          disabled={!context}
          onClick={() => context && void setImportant(taskId, !context.isImportant)}
          aria-label={context?.isImportant ? tr("task.unmarkImportant") : tr("task.markImportant")}
          title={context?.isImportant ? tr("task.unmarkImportant") : tr("task.markImportant")}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Star className={cn("h-4 w-4", context?.isImportant && "fill-amber-400 text-amber-400")} />
        </button>
        <button type="button" onClick={onExpand} aria-label={expanded ? "Thu gọn chi tiết" : "Mở rộng chi tiết"} aria-pressed={expanded} className="hidden rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:inline-flex">
          {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        {context && (
          <Link
            href={`/board/${context.boardId}?cardId=${taskId}`}
            aria-label={tr("task.openInBoard")}
            title={tr("task.openInBoard")}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}
        <button
          type="button"
          onClick={requestClose}
          aria-label={tr("common.close")}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {isReady ? (
        <>
          <CardRealtimeSync cardId={taskId} isOpen />
          <CardDetailBody key={taskId} cardId={taskId} layout="panel" onClose={onClose} beforeCloseRef={beforeCloseRef} />
          <footer className="flex shrink-0 items-center justify-end gap-1.5 border-t border-border px-6 py-2 text-[10px] text-muted-foreground">
            <kbd className="rounded border border-border px-1">Esc</kbd>để đóng
          </footer>
        </>
      ) : isError ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-medium text-neutral-700">
            {errorStatus === 403
              ? tr("task.noAccess")
              : errorStatus === 404
                ? tr("task.notFound")
                : tr("task.loadError")}
          </p>
          <div className="flex gap-2">
            {!isGone && (
              <Button type="button" size="sm" disabled={isFetching} onClick={() => void refetch()}>
                {tr("common.retry")}
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              {tr("common.close")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
    </div>
  );
};

/** Panel chi tiết bên phải (≥ lg) hoặc Sheet toàn màn (< lg). */
export const TaskDetailPanel = ({ taskId, onClose, desktopClassName }: TaskDetailPanelOuterProps) => {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const beforeCloseRef: BeforeCloseRef = useRef(null);
  // The task actually on screen; it only follows `taskId` once unsaved edits are dealt with.
  const [shownId, setShownId] = useState(taskId);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (shownId === taskId) {
      return;
    }

    let cancelled = false;

    void runBeforeClose(beforeCloseRef).then((ok) => {
      if (ok && !cancelled) {
        setShownId(taskId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [taskId, shownId]);

  const requestClose = () => {
    void runBeforeClose(beforeCloseRef).then((ok) => ok && onClose());
  };

  if (isDesktop) {
    return (
      <aside
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented) {
            requestClose();
          }
        }}
        className={cn(
          "sticky top-20 h-[calc(100vh-6rem)] max-w-[calc(100vw-2rem)] shrink-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
          expanded ? "w-[min(740px,calc(100vw-20rem))]" : "w-[480px]",
          desktopClassName,
        )}
      >
        <PanelContent taskId={shownId} onClose={onClose} beforeCloseRef={beforeCloseRef} expanded={expanded} onExpand={() => setExpanded(value => !value)} />
      </aside>
    );
  }

  return (
    <Sheet open onOpenChange={(open) => !open && requestClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-full">
        <SheetTitle className="sr-only">{tr("task.detailTitle")}</SheetTitle>
        <PanelContent taskId={shownId} onClose={onClose} beforeCloseRef={beforeCloseRef} expanded={expanded} onExpand={() => setExpanded(value => !value)} />
      </SheetContent>
    </Sheet>
  );
};
