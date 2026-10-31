import type { Checklist } from "@prisma/client";

import { intlDateFormat, tr } from "@/lib/i18n";
import type { ChecklistItemWithAssignee } from "@/types";

export type ChecklistWithItems = Checklist & {
  items: ChecklistItemWithAssignee[];
};

export const reorder = <T,>(list: T[], startIndex: number, endIndex: number) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

export const getDestinationIndex = ({
  actualItems,
  visibleItems,
  destinationIndex,
}: {
  actualItems: ChecklistItemWithAssignee[];
  visibleItems: ChecklistItemWithAssignee[];
  destinationIndex: number;
}) => {
  const targetVisibleItem = visibleItems[destinationIndex];

  if (targetVisibleItem) {
    return actualItems.findIndex((item) => item.id === targetVisibleItem.id);
  }

  const lastVisibleItem = visibleItems[destinationIndex - 1];

  if (lastVisibleItem) {
    const lastVisibleIndex = actualItems.findIndex(
      (item) => item.id === lastVisibleItem.id,
    );

    return lastVisibleIndex + 1;
  }

  return actualItems.length;
};

export const parseParentCardDueDate = (cardDueDate: Date | string | null) => {
  if (!cardDueDate) {
    return null;
  }

  const parsedDate = new Date(cardDueDate);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export const getChecklistDueDateRangeError = (parentCardDueDate: Date | null) => {
  if (!parentCardDueDate) {
    return tr("checklist.dueRangeError");
  }

  const max = intlDateFormat({
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parentCardDueDate);

  return tr("checklist.dueRangeErrorWithMax", { max });
};
