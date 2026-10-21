"use client";

import { useState } from "react";
import { useRouter } from "@/web/shims/next-navigation";
import { toast } from "sonner";
import { Download, LayoutPanelLeft, MoreHorizontal, Trash2, X } from "lucide-react";
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

import { BoardExportDialog } from "./board-export-dialog";

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
}: BoardOptionsProps) => {
  const router = useRouter();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

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

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
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
          className="px-0 pt-3 pb-2 w-52 shadow-lg rounded-xl border border-neutral-200"
          side="bottom"
          align="start"
        >
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
          <PopoverClose asChild>
            <Button
              variant="ghost"
              onClick={() => router.push(`/board/${id}/split`)}
              className="h-9 w-full justify-start gap-x-2 rounded-none px-4 text-sm font-normal"
            >
              <LayoutPanelLeft className="h-4 w-4 text-neutral-500" />
              Chia đôi với Lịch
            </Button>
          </PopoverClose>
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
        </PopoverContent>
      </Popover>
      <BoardExportDialog
        boardId={id}
        boardTitle={title}
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
      />
    </>
  );
};
