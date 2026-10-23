"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";

import { useAction } from "@/hooks/use-action";
import { createChecklist } from "@/actions/checklists/create-checklist";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChecklistPopoverProps {
  cardId: string;
  boardId: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export const ChecklistPopover = ({
  cardId,
  boardId,
  children,
  side = "bottom",
  align = "start",
}: ChecklistPopoverProps) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("Checklist");

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) setTitle("Checklist");
  };

  const { execute, isLoading } = useAction(createChecklist, {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["card", cardId],
      });
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    execute({ boardId, cardId, title: title.trim() });
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange} modal={true}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-72 p-0 rounded-xl border border-neutral-200 shadow-lg bg-white z-[9999]"
        sideOffset={6}
      >
        <form onSubmit={onSubmit}>
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-neutral-900">Thêm checklist</h3>
            <PopoverClose asChild>
              <button
                type="button"
                aria-label="Đóng"
                className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </PopoverClose>
          </div>

          <div className="space-y-1.5 px-4 py-4">
            <label htmlFor="checklist-title" className="text-xs font-medium text-neutral-600">
              Tiêu đề
            </label>
            <Input
              id="checklist-title"
              autoFocus
              placeholder="Checklist"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="h-9 rounded-lg border-neutral-200 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-100 px-4 py-3">
            <PopoverClose asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg text-xs text-neutral-600 cursor-pointer">
                Hủy
              </Button>
            </PopoverClose>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !title.trim()}
              className="h-8 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700 cursor-pointer"
            >
              {isLoading ? "Đang thêm…" : "Thêm"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};
