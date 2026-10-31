"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  blur,
  ReducedMotionConfig,
  spring,
  transition,
  useTempoTransition,
} from "@animate-ui/react/utils/motion";
import { ChevronDown } from "lucide-react";

import { getAgendaGroupLabel } from "@/lib/my-tasks/buckets";
import type { MyTaskGroup } from "@/lib/my-tasks/types";
import { cn } from "@/lib/utils";

import { TaskRow } from "./task-row";

/** Màu nhấn theo độ gấp của nhóm; nhóm theo cột (key = listId) dùng màu trung tính */
export const GROUP_TONES: Record<string, { bar: string; text: string; chip: string }> = {
  overdue: { bar: "bg-rose-500", text: "text-rose-600", chip: "bg-rose-50 text-rose-700 ring-rose-200" },
  today: { bar: "bg-amber-500", text: "text-amber-600", chip: "bg-amber-50 text-amber-700 ring-amber-200" },
  tomorrow: { bar: "bg-violet-500", text: "text-violet-700", chip: "bg-violet-50 text-violet-700 ring-violet-200" },
  week: { bar: "bg-neutral-500", text: "text-neutral-600", chip: "bg-white text-neutral-700 ring-neutral-200" },
  later: { bar: "bg-neutral-400", text: "text-neutral-500", chip: "bg-white text-neutral-600 ring-neutral-200" },
  nodue: { bar: "bg-neutral-300", text: "text-neutral-500", chip: "bg-white text-neutral-600 ring-neutral-200" },
  done: { bar: "bg-emerald-500", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};
const DEFAULT_TONE = { bar: "bg-neutral-400", text: "text-neutral-600", chip: "bg-white text-neutral-600 ring-neutral-200" };
export const getGroupTone = (key: string) => GROUP_TONES[key] ?? DEFAULT_TONE;

// Chỉ cắt tràn khi đang mở/gập, để dropdown của ô thêm nhanh (List view theo cột) không bị cắt lúc nghỉ
const collapsed = { height: 0, opacity: 0, filter: blur.disclosure, overflow: "hidden" };
const expanded = {
  height: "auto",
  opacity: 1,
  filter: "blur(0px)",
  transitionEnd: { filter: "none", overflow: "visible" },
};

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
  const disclosure = useTempoTransition(transition.disclosure);
  const reflow = useTempoTransition(spring.reflow);
  const fade = useTempoTransition(transition.fade);
  const tone = getGroupTone(group.key);

  const toggle = () => {
    if (onOpenChange) {
      onOpenChange(!isOpen);
    } else {
      setLocalOpen(!isOpen);
    }
  };

  if (group.tasks.length === 0 && !showWhenEmpty) return null;

  return (
    <ReducedMotionConfig>
      <section id={`task-group-${group.key}`} className="scroll-mt-4">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="group/head flex w-full items-center gap-2 rounded-md py-1 text-left"
        >
          <span className={cn("h-3.5 w-[3px] shrink-0 rounded-full", tone.bar)} />
          <span className={cn("text-xs font-bold uppercase tracking-wider", tone.text)}>{getAgendaGroupLabel(group.key) ?? group.label}</span>
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-neutral-100 px-1.5 text-[10px] font-bold text-neutral-600 tabular-nums">
            {group.tasks.length}
          </span>
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 text-neutral-400 opacity-0 transition-[transform,opacity] duration-350 ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover/head:opacity-100 group-focus-visible/head:opacity-100",
              !isOpen && "-rotate-90 opacity-100",
            )}
          />
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={collapsed}
              animate={expanded}
              exit={collapsed}
              transition={disclosure}
            >
              <div className="flex flex-col gap-1.5 pb-1 pt-2">
                {header}
                <AnimatePresence mode="popLayout" initial={false}>
                  {group.tasks.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { ...reflow, opacity: fade } }}
                      exit={{ opacity: 0, scale: 0.96, transition: fade }}
                      transition={reflow}
                    >
                      <TaskRow
                        task={task}
                        isSelected={task.id === selectedTaskId}
                        onOpen={onOpen}
                        showAssignees={showAssignees}
                        showBoardChip={showBoardChip}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </ReducedMotionConfig>
  );
};
