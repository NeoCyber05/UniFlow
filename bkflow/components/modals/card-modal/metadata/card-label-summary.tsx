"use client";

import { Plus } from "lucide-react";

import type { CardWithList } from "@/types";
import { Hint } from "@/components/hint";
import { TaskLabels } from "@/components/tasks/task-labels";
import { getLabelTextColor, safeLabelColor } from "@/lib/cards/task-labels";
import { tr } from "@/lib/i18n";
import { LabelPopover } from "./label-popover";
import { getLocalizedColorName } from "./metadata-utils";

interface CardLabelSummaryProps {
  cardId: string;
  boardId: string;
  labels: CardWithList["labels"];
  boardLabels: CardWithList["boardLabels"];
  canEdit?: boolean;
}

export const CardLabelSummary = ({
  cardId,
  boardId,
  labels,
  boardLabels,
  canEdit = true,
}: CardLabelSummaryProps) => {
  if (!canEdit) {
    // Chỉ đọc: badge dùng chung, không bọc control chỉnh nhãn.
    if (labels.length === 0) return null;
    return (
      <div className="flex flex-col gap-y-1.5">
        <span className="text-xs font-semibold text-neutral-600 pl-0.5">{tr("cardMeta.labels")}</span>
        <TaskLabels labels={labels.map((cardLabel) => cardLabel.label)} mode="full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-1.5">
      <span className="text-xs font-semibold text-neutral-600 pl-0.5">
        {tr("cardMeta.labels")}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.map((cardLabel) => (
          <Hint
            key={cardLabel.id}
            description={tr("cardMeta.labelHint", {
              color: getLocalizedColorName(cardLabel.label.color),
              title: cardLabel.label.title || tr("cardMeta.labelNoTitle"),
            })}
            side="bottom"
          >
            <div className="inline-block">
              <LabelPopover
                cardId={cardId}
                boardId={boardId}
                labels={labels}
                boardLabels={boardLabels}
              >
                <button
                  type="button"
                  style={{ backgroundColor: safeLabelColor(cardLabel.label.color), color: getLabelTextColor(cardLabel.label.color) }}
                  className="h-8 min-w-[32px] max-w-[140px] px-3 rounded-md flex items-center font-bold text-xs shadow-xs border border-black/5 hover:opacity-85 transition cursor-pointer"
                >
                  <span className="truncate">{cardLabel.label.title}</span>
                </button>
              </LabelPopover>
            </div>
          </Hint>
        ))}

        {/* Plus button inside active state to add/remove labels */}
        {canEdit && <LabelPopover
          cardId={cardId}
          boardId={boardId}
          labels={labels}
          boardLabels={boardLabels}
        >
          <button
            type="button"
            className="rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 flex items-center justify-center h-8 w-8 cursor-pointer transition-colors shadow-xs"
            aria-label={tr("cardMeta.manageLabelsAria")}
          >
            <Plus className="h-4 w-4 text-neutral-600" />
          </button>
        </LabelPopover>}
      </div>
    </div>
  );
};
