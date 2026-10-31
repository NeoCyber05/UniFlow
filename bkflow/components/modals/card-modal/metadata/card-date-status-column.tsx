"use client";

import { ChevronDown } from "lucide-react";

import type { CardWithList } from "@/types";
import type { TaskDatesPatch } from "@/lib/cards/task-dates-form";
import { tr } from "@/lib/i18n";

import { CardDatePopover } from "./card-date-popover";

interface CardDateStatusColumnProps {
  data: CardWithList;
  hasDateRange: boolean;
  dateLines: string[];
  status: string;
  isLoadingUpdate: boolean;
  isDateOpen: boolean;
  onDateOpenChange: (open: boolean) => void;
  onSave: (patch: TaskDatesPatch) => void;
  onClearSchedule: () => void;
  onClearLegacyStart: () => void;
  canEdit?: boolean;
}

export const CardDateStatusColumn = ({
  data,
  hasDateRange,
  dateLines,
  status,
  isLoadingUpdate,
  isDateOpen,
  onDateOpenChange,
  onSave,
  onClearSchedule,
  onClearLegacyStart,
  canEdit = true,
}: CardDateStatusColumnProps) => {
  if (!hasDateRange) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-1.5">
      <span className="text-xs font-semibold text-neutral-600 pl-0.5">
        {tr("cardMeta.datesAndSchedule")}
      </span>
      <div className="flex items-center gap-x-2">
        {canEdit ? (
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
                className="inline-flex min-h-8 max-w-full items-center gap-x-1.5 rounded-lg border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 active:bg-neutral-100 px-3 text-xs font-medium text-neutral-700 cursor-pointer transition-colors shadow-xs"
              >
                <span className="flex flex-col items-start text-left">{dateLines.map((line) => <span key={line} className="truncate">{line}</span>)}</span>

                {data.isCompleted ? (
                  <span className="shrink-0 bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {tr("cardMeta.statusCompleted")}
                  </span>
                ) : status === "overdue" ? (
                  <span className="shrink-0 bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {tr("cardMeta.statusOverdue")}
                  </span>
                ) : status === "warning" ? (
                  <span className="shrink-0 bg-yellow-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {tr("cardMeta.statusDueSoon")}
                  </span>
                ) : null}

                <ChevronDown className="h-3.5 w-3.5 text-neutral-500 ml-0.5" />
              </button>
            )}
          />
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex min-h-8 max-w-full items-center gap-x-1.5 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 text-xs font-medium text-neutral-700 shadow-xs"
          >
            <span className="flex flex-col items-start text-left">{dateLines.map((line) => <span key={line} className="truncate">{line}</span>)}</span>
          </button>
        )}
      </div>
    </div>
  );
};
