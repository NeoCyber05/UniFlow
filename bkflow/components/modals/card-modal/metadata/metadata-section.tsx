"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { getDueDateStatus } from "@/components/due-date-badge";
import { formatDateTimeLocalInput } from "@/lib/date-utils";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";

import { CardCourseSelect } from "./card-course-select";
import { CardDateStatusColumn } from "./card-date-status-column";
import { CardLabelSummary } from "./card-label-summary";
import { MetadataActionRow } from "./metadata-action-row";
import { getDateSummary } from "./metadata-utils";
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

  const [startDateValue, setStartDateValue] = useState(formatDateTimeLocalInput(data.startDate));
  const [dueDateValue, setDueDateValue] = useState(formatDateTimeLocalInput(data.dueDate));
  const [reminderValue, setReminderValue] = useState(data.reminder || "none");

  const [isDateOpen, setIsDateOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartDateValue(formatDateTimeLocalInput(data.startDate));
    setDueDateValue(formatDateTimeLocalInput(data.dueDate));
    setReminderValue(data.reminder || "none");
  }, [data.startDate, data.dueDate, data.reminder]);

  const {
    isLoadingUpdate,
    updateDueDate,
    updateStartDate,
    onDateSubmit,
  } = useCardMetadataActions({
    data,
    boardId,
    queryClient,
    invalidateBoardCalendar,
    reminderValue,
    setIsDateOpen,
  });

  const hasStartDate = !!data.startDate;
  const hasDueDate = !!data.dueDate;
  const hasDateRange = hasStartDate || hasDueDate;
  const hasLabels = data.labels && data.labels.length > 0;
  const canSetReminder = !!dueDateValue;

  const status = data.dueDate ? getDueDateStatus(data.dueDate) : "normal";
  const dateSummary = getDateSummary({
    startDate: data.startDate,
    dueDate: data.dueDate,
    hasStartDate,
    hasDueDate,
  });

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
          startDateValue={startDateValue}
          dueDateValue={dueDateValue}
          reminderValue={reminderValue}
          canSetReminder={canSetReminder}
          hasStartDate={hasStartDate}
          hasDueDate={hasDueDate}
          isLoadingUpdate={isLoadingUpdate}
          onStartDateValueChange={setStartDateValue}
          onDueDateValueChange={setDueDateValue}
          onReminderValueChange={setReminderValue}
          onDateSubmit={onDateSubmit}
          onClearStartDate={() => updateStartDate(null)}
          onClearDueDate={() => updateDueDate(null)}
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
          hasStartDate={hasStartDate}
          hasDueDate={hasDueDate}
          dateSummary={dateSummary}
          status={status}
          isLoadingUpdate={isLoadingUpdate}
          onToggleComplete={() => {}}
          isDateOpen={isDateOpen}
          onDateOpenChange={setIsDateOpen}
          startDateValue={startDateValue}
          dueDateValue={dueDateValue}
          reminderValue={reminderValue}
          canSetReminder={canSetReminder}
          onStartDateValueChange={setStartDateValue}
          onDueDateValueChange={setDueDateValue}
          onReminderValueChange={setReminderValue}
          onDateSubmit={onDateSubmit}
          onClearStartDate={() => updateStartDate(null)}
          onClearDueDate={() => updateDueDate(null)}
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
