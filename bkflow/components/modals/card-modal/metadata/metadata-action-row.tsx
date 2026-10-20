"use client";

import { CheckSquare, Clock, Paperclip, Tag } from "lucide-react";

import { useBoardCourses } from "@/hooks/use-board-courses";
import type { CardWithList } from "@/types";
import { ChecklistPopover } from "../checklists/checklist-popover";
import { LabelPopover } from "./label-popover";
import { AttachmentAddPopover } from "../attachments/attachment-add-popover";

import type { TaskDatesPatch } from "@/lib/cards/task-dates-form";

import { CardDatePopover } from "./card-date-popover";

interface MetadataActionRowProps {
  data: CardWithList;
  boardId: string;
  hasDateRange: boolean;
  hasLabels: boolean;
  isDateOpen: boolean;
  onDateOpenChange: (open: boolean) => void;
  isLoadingUpdate: boolean;
  onSave: (patch: TaskDatesPatch) => void;
  onClearSchedule: () => void;
  onClearLegacyStart: () => void;
}

export const MetadataActionRow = ({
  data,
  boardId,
  hasDateRange,
  hasLabels,
  isDateOpen,
  onDateOpenChange,
  isLoadingUpdate,
  onSave,
  onClearSchedule,
  onClearLegacyStart,
}: MetadataActionRowProps) => {
  // Bảng học kỳ đã có Danh mục (môn) để phân loại; nhãn chỉ hiện khi việc đã gắn nhãn từ trước.
  const { isWorkspaceBoard } = useBoardCourses(boardId);

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      {/* Ngày Button (Only shown when no schedule is set) */}
      {!hasDateRange && (
        <CardDatePopover
          open={isDateOpen}
          onOpenChange={onDateOpenChange}
          data={data}
          isLoadingUpdate={isLoadingUpdate}
          onSave={onSave}
          onClearSchedule={onClearSchedule}
          onClearLegacyStart={onClearLegacyStart}
          trigger={(
            <button
              type="button"
              className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
            >
              <Clock className="h-3.5 w-3.5 text-neutral-500" />
              Hạn và lịch
            </button>
          )}
        />
      )}

      {/* Nhãn Button (Only shown when card has no labels) */}
      {!hasLabels && !isWorkspaceBoard && (
        <LabelPopover
          cardId={data.id}
          boardId={boardId}
          labels={data.labels}
          boardLabels={data.boardLabels}
        >
          <button
            type="button"
            className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
          >
            <Tag className="h-3.5 w-3.5 text-neutral-500" />
            Nhãn
          </button>
        </LabelPopover>
      )}

      {/* Checklist Button */}
      <ChecklistPopover
        cardId={data.id}
        boardId={boardId}
        boardChecklists={data.boardChecklists || []}
      >
        <button
          type="button"
          className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
        >
          <CheckSquare className="h-3.5 w-3.5 text-neutral-500" />
          Checklist
        </button>
      </ChecklistPopover>

      {/* Tệp đính kèm Button */}
      <AttachmentAddPopover cardId={data.id} boardId={boardId} side="bottom" align="start">
        <button
          type="button"
          className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
        >
          <Paperclip className="h-3.5 w-3.5 text-neutral-500" />
          Đính kèm
        </button>
      </AttachmentAddPopover>
    </div>
  );
};
