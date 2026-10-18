/* eslint-disable @typescript-eslint/no-explicit-any -- fake tx */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ChecklistConflictError,
  ChecklistInvalidError,
  appendChecklistItems,
  createItemWithVersion,
  deleteItemWithVersion,
  moveItems,
  reorderItems,
} from "./checklist-mutations";

type Item = { id: string; checklistId: string; order: number; title: string; isCompleted: boolean };

const setup = () => {
  const state = {
    checklists: {
      k1: { id: "k1", orderVersion: 0 },
      k2: { id: "k2", orderVersion: 3 },
    } as Record<string, { id: string; orderVersion: number }>,
    items: [
      { id: "a", checklistId: "k1", order: 0, title: "A", isCompleted: true },
      { id: "b", checklistId: "k1", order: 1, title: "B", isCompleted: false },
      { id: "c", checklistId: "k1", order: 2, title: "C", isCompleted: true },
      { id: "x", checklistId: "k2", order: 0, title: "X", isCompleted: false },
    ] as Item[],
    itemWrites: 0,
    cardWrites: 0,
  };
  const tx: any = {
    checklist: {
      updateMany: async ({ where, data }: any) => {
        const row = state.checklists[where.id];
        if (!row || (where.orderVersion !== undefined && row.orderVersion !== where.orderVersion)) {
          return { count: 0 };
        }
        row.orderVersion += data.orderVersion.increment;
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        const row = state.checklists[where.id];
        row.orderVersion += data.orderVersion.increment;
        return { ...row };
      },
    },
    checklistItem: {
      findMany: async ({ where }: any) =>
        state.items.filter((i) => i.checklistId === where.checklistId).sort((p, q) => p.order - q.order),
      findFirst: async ({ where }: any) =>
        state.items.filter((i) => i.checklistId === where.checklistId).sort((p, q) => q.order - p.order)[0] ?? null,
      update: async ({ where, data }: any) => {
        state.itemWrites++;
        const item = state.items.find((i) => i.id === where.id)!;
        Object.assign(item, data);
        return { ...item };
      },
      create: async ({ data }: any) => {
        state.itemWrites++;
        const item = { id: `n${state.items.length}`, isCompleted: false, ...data };
        state.items.push(item);
        return { ...item };
      },
      delete: async ({ where }: any) => {
        state.itemWrites++;
        state.items = state.items.filter((i) => i.id !== where.id);
        return {};
      },
    },
    card: {
      update: async () => {
        state.cardWrites++;
      },
    },
  };
  // Mimics $transaction rollback: restore a snapshot if the callback throws.
  const run = async <T,>(fn: () => Promise<T>) => {
    const snapshot = structuredClone({ checklists: state.checklists, items: state.items });
    try {
      return await fn();
    } catch (error) {
      state.checklists = snapshot.checklists;
      state.items = snapshot.items;
      throw error;
    }
  };
  return { state, tx, run };
};

const o = (...ids: string[]) => ids.map((id, order) => ({ id, order }));

test("reorder succeeds with matching version and bumps it", async () => {
  const { state, tx } = setup();
  const result = await reorderItems(tx, { checklistId: "k1", expectedOrderVersion: 0, items: o("c", "a", "b") });
  assert.equal(result.orderVersion, 1);
  assert.equal(state.checklists.k1.orderVersion, 1);
  assert.deepEqual(state.items.filter((i) => i.checklistId === "k1").sort((p, q) => p.order - q.order).map((i) => i.id), ["c", "a", "b"]);
});

test("reorder rejects duplicate, missing and foreign ids without writing", async () => {
  for (const items of [o("a", "a", "b"), o("a", "b"), o("a", "b", "x")]) {
    const { state, tx } = setup();
    await assert.rejects(
      reorderItems(tx, { checklistId: "k1", expectedOrderVersion: 0, items }),
      ChecklistInvalidError,
    );
    assert.equal(state.itemWrites, 0);
  }
});

test("two reorders on the same version: only one wins", async () => {
  const { state, tx } = setup();
  await reorderItems(tx, { checklistId: "k1", expectedOrderVersion: 0, items: o("b", "a", "c") });
  await assert.rejects(
    reorderItems(tx, { checklistId: "k1", expectedOrderVersion: 0, items: o("c", "b", "a") }),
    ChecklistConflictError,
  );
  assert.deepEqual(state.items.filter((i) => i.checklistId === "k1").sort((p, q) => p.order - q.order).map((i) => i.id), ["b", "a", "c"]);
});

test("create/delete make a stale reorder fail", async () => {
  const { state, tx } = setup();
  const created = await createItemWithVersion(tx, { checklistId: "k1", title: "D" });
  assert.equal(created.orderVersion, 1);
  assert.equal(created.item.order, 3);
  await assert.rejects(
    reorderItems(tx, { checklistId: "k1", expectedOrderVersion: 0, items: o("a", "b", "c") }),
    ChecklistConflictError,
  );
  const deleted = await deleteItemWithVersion(tx, { checklistId: "k1", itemId: "a" });
  assert.equal(deleted.orderVersion, 2);
  assert.equal(state.cardWrites, 0);
});

test("move with a stale version changes nothing", async () => {
  const { state, tx, run } = setup();
  const move = (srcV: number, dstV: number) =>
    run(() => moveItems(tx, {
      sourceChecklistId: "k1",
      destinationChecklistId: "k2",
      expectedSourceOrderVersion: srcV,
      expectedDestinationOrderVersion: dstV,
      sourceItems: o("a", "c"),
      destinationItems: o("x", "b"),
    }));
  await assert.rejects(move(0, 99), ChecklistConflictError);
  assert.equal(state.itemWrites, 0);
  assert.equal(state.checklists.k1.orderVersion, 0);
  const ok = await move(0, 3);
  assert.deepEqual([ok.sourceOrderVersion, ok.destinationOrderVersion], [1, 4]);
  assert.equal(state.items.find((i) => i.id === "b")!.checklistId, "k2");
});

test("keeps checklist progress independent from task completion", async () => {
  const { state, tx } = setup();
  await appendChecklistItems(tx, { checklistId: "k1", titles: ["D", "E"] });
  const k1 = state.items.filter((i) => i.checklistId === "k1");
  assert.equal(state.checklists.k1.orderVersion, 1);
  assert.deepEqual(k1.map((i) => i.order), [0, 1, 2, 3, 4]);
  assert.equal(state.cardWrites, 0);
  assert.deepEqual(
    { total: k1.length, completed: k1.filter((i) => i.isCompleted).length },
    { total: 5, completed: 2 },
  );
});
