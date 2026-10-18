"use client";

import { useState } from "react";
import { useRouter } from "@/web/shims/next-navigation";
import { toast } from "sonner";
import { Activity, Archive, Download, MoreHorizontal, Sparkles, Trash2, X } from "lucide-react";
import type { Label, List } from "@prisma/client";

import { deleteBoard } from "@/actions/boards/delete-board";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConfirmModal } from "@/components/modals/confirm-modal";

import { ArchivedItemsModal } from "./archived-items-modal";
import { BoardActivityPopoverContent } from "./board-activity-popover-content";
import { BoardExportDialog } from "./board-export-dialog";
import { SmartCaptureDialog } from "./smart-capture-dialog";

interface BoardOptionsProps {
  id: string;
  title: string;
  orgId?: string;
  currentUserId: string;
  currentMemberRole?: string;
  canDelete?: boolean;
  canEdit?: boolean;
  lists: Pick<List, "id" | "title">[];
  members?: any[];
  labels: Pick<Label, "id" | "title" | "color">[];
}

export const BoardOptions = ({
  id,
  title,
  orgId: _orgId,
  currentUserId: _currentUserId,
  canDelete = false,
  canEdit = false,
  lists,
  members = [],
  labels,
}: BoardOptionsProps) => {
  const router = useRouter();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [view, setView] = useState<"menu" | "activity">("menu");
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isSmartCaptureOpen, setIsSmartCaptureOpen] = useState(false);

  const { execute: executeDeleteBoard, isLoading: isDeleting } = useAction(deleteBoard, {
    onSuccess: () => {
      router.push("/my/today");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onDelete = () => {
    executeDeleteBoard({ id });
  };

  const onPopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open);

    if (!open) {
      setView("menu");
    }
  };

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger asChild>
          <Button
            aria-label="Mở thao tác bảng"
            className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/20 rounded-lg cursor-pointer"
            variant="ghost"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          data-role="popover-content"
          className={view === "activity"
            ? "flex max-h-[620px] w-[420px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-lg"
            : "px-0 pt-3 pb-2 w-52 shadow-lg rounded-xl border border-neutral-200"
          }
          style={view === "activity" ? { maxHeight: "calc(100vh - 128px)" } : undefined}
          side="bottom"
          align="start"
        >
          {view === "activity" ? (
            <BoardActivityPopoverContent
              boardId={id}
              onBack={() => setView("menu")}
            />
          ) : (
            <>
              <div className="text-sm font-semibold text-center text-neutral-700 pb-2 border-b border-neutral-100 mb-2 px-4">
                Thao tác bảng
              </div>
              <PopoverClose asChild>
                <Button
                  className="h-auto w-auto p-2 absolute top-2 right-2 text-neutral-600 rounded-lg"
                  variant="ghost"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </Button>
              </PopoverClose>
              <Button
                variant="ghost"
                onClick={() => setView("activity")}
                className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-700 hover:bg-neutral-100 gap-x-2 rounded-none cursor-pointer"
              >
                <Activity className="h-4 w-4 text-neutral-500" />
                Nhật ký hoạt động
              </Button>
              {canEdit && (
                <PopoverClose asChild>
                  <Button
                    variant="ghost"
                    onClick={() => setIsSmartCaptureOpen(true)}
                    className="w-full h-9 px-4 justify-start font-normal text-sm text-violet-700 hover:bg-violet-50 hover:text-violet-800 gap-x-2 rounded-none cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 text-violet-600" />
                    Thêm việc bằng ảnh AI
                  </Button>
                </PopoverClose>
              )}
              <PopoverClose asChild>
                <Button
                  variant="ghost"
                  onClick={() => setIsExportDialogOpen(true)}
                  className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-700 hover:bg-neutral-100 gap-x-2 rounded-none cursor-pointer"
                >
                  <Download className="h-4 w-4 text-neutral-500" />
                  Xuất dữ liệu bảng
                </Button>
              </PopoverClose>
              <PopoverClose asChild>
                <Button
                  variant="ghost"
                  onClick={() => setIsArchivedModalOpen(true)}
                  className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-700 hover:bg-neutral-100 gap-x-2 rounded-none cursor-pointer"
                >
                  <Archive className="h-4 w-4 text-neutral-500" />
                  Mục đã lưu trữ
                </Button>
              </PopoverClose>
              {canDelete && (
                <ConfirmModal
                  onConfirm={onDelete}
                  title="Xóa bảng này?"
                  description="Bạn có chắc chắn muốn xóa bảng này? Mọi danh sách và thẻ bên trong bảng sẽ bị xóa vĩnh viễn và không thể khôi phục."
                  disabled={isDeleting}
                >
                  <Button
                    variant="ghost"
                    className="w-full h-9 px-4 justify-start font-normal text-sm text-red-500 hover:bg-red-50 hover:text-red-600 gap-x-2 rounded-none cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeleting ? "Đang xóa..." : "Xóa bảng này"}
                  </Button>
                </ConfirmModal>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
      <ArchivedItemsModal
        boardId={id}
        open={isArchivedModalOpen}
        onOpenChange={setIsArchivedModalOpen}
      />
      <BoardExportDialog
        boardId={id}
        boardTitle={title}
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
      />
      <SmartCaptureDialog
        boardId={id}
        open={isSmartCaptureOpen}
        onOpenChange={setIsSmartCaptureOpen}
        lists={lists}
        members={members}
        labels={labels}
      />
    </>
  );
};
