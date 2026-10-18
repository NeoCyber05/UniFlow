"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { taskDatesToForm } from "@/lib/cards/task-dates-form";
import { getTaskDeadlineStatus } from "@/lib/cards/task-deadline";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";

import { CardCourseSelect } from "./card-course-select";
import { CardDateStatusColumn } from "./card-date-status-column";
import { CardLabelSummary } from "./card-label-summary";
import { MetadataActionRow } from "./metadata-action-row";
import { getDateLines } from "./metadata-utils";
import { useCardMetadataActions } from "./use-card-metadata-actions";

interface MetadataProps {
  data: CardWithList;
  canEdit?: boolean;
}

export const MetadataSection = ({
  data,
  canEdit = true,
}: MetadataProps) => {
  const boardId = data.list.boardId;
  const queryClient = useQueryClient();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);

  const [isDateOpen, setIsDateOpen] = useState(false);

  const {
    isLoadingUpdate,
    saveTaskDates,
    clearSchedule,
    clearLegacyStart,
  } = useCardMetadataActions({
    data,
    boardId,
    queryClient,
    invalidateBoardCalendar,
    setIsDateOpen,
  });

  const hasDeadline = Boolean(data.dueDate || data.deadlineOn);
  const hasDateRange = hasDeadline || Boolean(data.startDate || data.scheduledOn || data.scheduledStartAt);
  const hasLabels = data.labels && data.labels.length > 0;
  const status = getTaskDeadlineStatus(
    { dueDate: data.dueDate, deadlineOn: data.dueDate ? null : taskDatesToForm(data).deadlineDate || null },
    new Date(),
  );
  const dateLines = getDateLines(data);

  const showActionButtonRow = canEdit;

  return (
    <div className="space-y-5">
      {/* 1. Action Button Row */}
      {showActionButtonRow && (
        <MetadataActionRow
          data={data}
          boardId={boardId}
          hasDateRange={hasDateRange}
          hasLabels={hasLabels}
          isDateOpen={isDateOpen}
          onDateOpenChange={setIsDateOpen}
          isLoadingUpdate={isLoadingUpdate}
          onSave={saveTaskDates}
          onClearSchedule={clearSchedule}
          onClearLegacyStart={clearLegacyStart}
        />
      )}

      {/* 2. Metadata Display Row (Columns) */}
      <div className="flex flex-wrap gap-x-8 gap-y-4 pt-1">
        <CardCourseSelect
          cardId={data.id}
          boardId={boardId}
          courseId={data.courseId}
          canEdit={canEdit}
        />

        {/* Nhãn (Active State) */}
        {hasLabels && (
          <CardLabelSummary
            cardId={data.id}
            boardId={boardId}
            labels={data.labels}
            boardLabels={data.boardLabels}
            canEdit={canEdit}
          />
        )}

        {/* Ngày / Trạng thái */}
        <CardDateStatusColumn
          data={data}
          hasDateRange={hasDateRange}
          dateLines={dateLines}
          status={data.isCompleted ? "completed" : status === "overdue" ? "overdue" : "normal"}
          isLoadingUpdate={isLoadingUpdate}
          isDateOpen={isDateOpen}
          onDateOpenChange={setIsDateOpen}
          onSave={saveTaskDates}
          onClearSchedule={clearSchedule}
          onClearLegacyStart={clearLegacyStart}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
};

MetadataSection.Skeleton = function MetadataSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mt-1">
        <Skeleton className="w-16 h-8 rounded-lg bg-neutral-100" />
        <Skeleton className="w-16 h-8 rounded-lg bg-neutral-100" />
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="space-y-2">
          <Skeleton className="w-20 h-3 rounded bg-neutral-100" />
          <div className="flex items-center gap-x-2">
            <Skeleton className="w-4.5 h-4.5 rounded bg-neutral-100" />
            <Skeleton className="w-32 h-8 rounded-lg bg-neutral-100" />
          </div>
        </div>
      </div>
    </div>
  );
};
