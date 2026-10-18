import type { Prisma } from "@prisma/client";

import { CHECKLIST_MESSAGES } from "@/lib/checklists/checklist-messages";

export const CHECKLIST_CONFLICT_ERROR_CODE = "CHECKLIST_CONFLICT";
export const CHECKLIST_CONFLICT_MESSAGE =
  "Danh sách công việc đã thay đổi ở nơi khác. Hãy tải lại rồi thử lại.";

export class ChecklistConflictError extends Error {
  constructor() {
    super(CHECKLIST_CONFLICT_MESSAGE);
  }
}

export class ChecklistInvalidError extends Error {}

type Tx = Prisma.TransactionClient;
type OrderedItem = { id: string; order: number };

/** Maps a thrown mutation error to a safe-action result; rethrows unknown errors. */
export const toChecklistActionError = (error: unknown) => {
  if (error instanceof ChecklistConflictError) {
    return { error: error.message, errorCode: CHECKLIST_CONFLICT_ERROR_CODE };
  }
  if (error instanceof ChecklistInvalidError) {
    return { error: error.message };
  }
  return null;
};

// CAS inside the write itself: count 0 means someone changed the order since the client's snapshot.
const casBump = async (tx: Tx, checklistId: string, expected: number) => {
  const { count } = await tx.checklist.updateMany({
    where: { id: checklistId, orderVersion: expected },
    data: { orderVersion: { increment: 1 } },
  });
  if (count !== 1) throw new ChecklistConflictError();
  return expected + 1;
};

// Unconditional bump (create/delete/append) also takes the row lock, serializing concurrent writers.
const bump = async (tx: Tx, checklistId: string) =>
  (await tx.checklist.update({
    where: { id: checklistId },
    data: { orderVersion: { increment: 1 } },
    select: { orderVersion: true },
  })).orderVersion;

const sameIds = (actual: string[], payload: string[]) =>
  actual.length === payload.length &&
  new Set(payload).size === payload.length &&
  actual.every((id) => payload.includes(id));

export const reorderItems = async (
  tx: Tx,
  input: { checklistId: string; expectedOrderVersion: number; items: OrderedItem[] },
) => {
  const orderVersion = await casBump(tx, input.checklistId, input.expectedOrderVersion);
  const current = await tx.checklistItem.findMany({
    where: { checklistId: input.checklistId },
    select: { id: true },
  });

  if (!sameIds(current.map((item) => item.id), input.items.map((item) => item.id))) {
    throw new ChecklistInvalidError(CHECKLIST_MESSAGES.checklistReorderForeignItem);
  }

  const items = await Promise.all(
    input.items.map((item) =>
      tx.checklistItem.update({ where: { id: item.id }, data: { order: item.order } }),
    ),
  );

  return { items, orderVersion };
};

export const moveItems = async (
  tx: Tx,
  input: {
    sourceChecklistId: string;
    destinationChecklistId: string;
    expectedSourceOrderVersion: number;
    expectedDestinationOrderVersion: number;
    sourceItems: OrderedItem[];
    destinationItems: OrderedItem[];
  },
) => {
  const sourceOrderVersion = await casBump(tx, input.sourceChecklistId, input.expectedSourceOrderVersion);
  const destinationOrderVersion = await casBump(
    tx,
    input.destinationChecklistId,
    input.expectedDestinationOrderVersion,
  );
  const write = (checklistId: string, items: OrderedItem[]) =>
    items.map((item) =>
      tx.checklistItem.update({ where: { id: item.id }, data: { checklistId, order: item.order } }),
    );
  const items = await Promise.all([
    ...write(input.sourceChecklistId, input.sourceItems),
    ...write(input.destinationChecklistId, input.destinationItems),
  ]);

  return { items, sourceOrderVersion, destinationOrderVersion };
};

const nextOrder = async (tx: Tx, checklistId: string) => {
  const last = await tx.checklistItem.findFirst({
    where: { checklistId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return last ? last.order + 1 : 0;
};

export const createItemWithVersion = async (tx: Tx, input: { checklistId: string; title: string }) => {
  const orderVersion = await bump(tx, input.checklistId);
  const item = await tx.checklistItem.create({
    data: {
      checklistId: input.checklistId,
      title: input.title,
      order: await nextOrder(tx, input.checklistId),
      isCompleted: false,
    },
  });
  return { item, orderVersion };
};

export const deleteItemWithVersion = async (tx: Tx, input: { checklistId: string; itemId: string }) => {
  const orderVersion = await bump(tx, input.checklistId);
  await tx.checklistItem.delete({ where: { id: input.itemId } });
  return { orderVersion };
};

/** AI append: one version bump for the whole batch; never touches existing items or the card. */
export const appendChecklistItems = async (tx: Tx, input: { checklistId: string; titles: string[] }) => {
  const orderVersion = await bump(tx, input.checklistId);
  const start = await nextOrder(tx, input.checklistId);
  const items = [];
  for (const [index, title] of input.titles.entries()) {
    items.push(
      await tx.checklistItem.create({
        data: { checklistId: input.checklistId, title, order: start + index, isCompleted: false },
      }),
    );
  }
  return { items, orderVersion };
};
