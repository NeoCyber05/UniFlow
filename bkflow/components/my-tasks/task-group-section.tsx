"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { MyTaskGroup } from "@/lib/my-tasks/types";
import { cn } from "@/lib/utils";

import { TaskRow } from "./task-row";

type TaskGroupSectionProps = {
  group: MyTaskGroup;
  selectedTaskId: string | null;
  onOpen: (taskId: string) => void;
  showAssignees?: boolean;
  showBoardChip?: boolean;
  /** Slot dưới tiêu đề nhóm, vd ô thêm nhanh của cột (List view) */
  header?: React.ReactNode;
  /** Hiện nhóm cả khi rỗng (List view cần ô thêm nhanh cho cột trống) */
  showWhenEmpty?: boolean;
  /** Điều khiển mở/thu gọn từ ngoài (vd lưu localStorage); bỏ trống → tự quản lý theo group.collapsed */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const TaskGroupSection = ({
  group,
  selectedTaskId,
  onOpen,
  showAssignees,
  showBoardChip,
  header,
  showWhenEmpty = false,
  isOpen: controlledOpen,
  onOpenChange,
}: TaskGroupSectionProps) => {
  const [localOpen, setLocalOpen] = useState(!group.collapsed);
  const isOpen = controlledOpen ?? localOpen;

  const toggle = () => {
    if (onOpenChange) {
      onOpenChange(!isOpen);
    } else {
      setLocalOpen(!isOpen);
    }
  };

  if (group.tasks.length === 0 && !showWhenEmpty) return null;

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-800",
          group.key === "overdue" && "text-rose-600 hover:text-rose-700",
        )}
      >
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {group.label}
        <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
          {group.tasks.length}
        </span>
      </button>
      {isOpen && (
        <div className="space-y-1.5">
          {header}
          {group.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isSelected={task.id === selectedTaskId}
              onOpen={onOpen}
              showAssignees={showAssignees}
              showBoardChip={showBoardChip}
            />
          ))}
        </div>
      )}
    </section>
  );
};
