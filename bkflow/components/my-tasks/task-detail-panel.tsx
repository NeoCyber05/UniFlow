"use client";

import { useEffect } from "react";
import Link from "@/web/shims/next-link";
import { ExternalLink, Star, Sun, X } from "lucide-react";
import { toast } from "sonner";
import { useMediaQuery } from "usehooks-ts";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CardDetailBody } from "@/components/modals/card-modal/card-detail-body";
import { CardRealtimeSync } from "@/components/modals/card-modal/card-realtime-sync";
import { useCardContext } from "@/hooks/use-my-tasks";
import { useMyTaskMutations } from "@/hooks/use-my-task-mutations";
import { isSameVNDay } from "@/lib/my-tasks/vn-day";
import { cn } from "@/lib/utils";

type TaskDetailPanelProps = {
  taskId: string;
  onClose: () => void;
};

type TaskDetailPanelOuterProps = TaskDetailPanelProps & {
  /** Ghi đè vị trí/kích thước khi ở desktop (vd trong trang bảng) */
  desktopClassName?: string;
};

const PanelContent = ({ taskId, onClose }: TaskDetailPanelProps) => {
  const { data: context, isError } = useCardContext(taskId);
  const { setImportant, setMyDay } = useMyTaskMutations();
  const isReady = Boolean(context);
  const isPinned = Boolean(context?.myDayAt && isSameVNDay(new Date(context.myDayAt), new Date()));

  useEffect(() => {
    if (isError) {
      toast.error("Không tìm thấy việc.");
      onClose();
    }
  }, [isError, onClose]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-neutral-100 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-500">
          {context?.boardTitle ?? "Đang tải…"}
        </p>
        <button
          type="button"
          disabled={!context}
          onClick={() => context && void setMyDay(taskId, !isPinned)}
          title={isPinned ? "Bỏ khỏi Hôm nay" : "Thêm vào Hôm nay"}
          className={cn("rounded-md p-1.5 text-neutral-400 hover:bg-amber-50 hover:text-amber-500", isPinned && "text-amber-500")}
        >
          <Sun className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!context}
          onClick={() => context && void setImportant(taskId, !context.isImportant)}
          title={context?.isImportant ? "Bỏ đánh dấu quan trọng" : "Đánh dấu quan trọng"}
          className="rounded-md p-1.5 text-neutral-400 hover:bg-amber-50 hover:text-amber-500"
        >
          <Star className={cn("h-4 w-4", context?.isImportant && "fill-amber-400 text-amber-400")} />
        </button>
        {context && (
          <Link
            href={`/board/${context.boardId}?cardId=${taskId}`}
            title="Mở trong bảng"
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {isReady ? (
        <>
          <CardRealtimeSync cardId={taskId} isOpen />
          <CardDetailBody key={taskId} cardId={taskId} layout="panel" onClose={onClose} />
        </>
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

  if (isDesktop) {
    return (
      <aside
        className={cn(
          "sticky top-20 h-[calc(100vh-6rem)] w-[420px] shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm",
          desktopClassName,
        )}
      >
        <PanelContent taskId={taskId} onClose={onClose} />
      </aside>
    );
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-full">
        <SheetTitle className="sr-only">Chi tiết việc</SheetTitle>
        <PanelContent taskId={taskId} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
};
