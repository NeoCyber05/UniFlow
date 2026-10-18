/* eslint-disable @typescript-eslint/no-explicit-any -- fake db */
import { test } from "node:test";
import assert from "node:assert/strict";

import { CapturedCardsError, createCapturedCards } from "./create-captured-cards";

const ID1 = "11111111-1111-4111-8111-111111111111";
const FOREIGN = "33333333-3333-4333-8333-333333333333";

type Opts = { failItems?: boolean; failCardId?: string };

const setup = (opts: Opts = {}) => {
  const state: any = {
    cards: [
      // card of another user's board that already owns FOREIGN
      { id: FOREIGN, listId: "lx", title: "Bí mật", description: "", order: 1, courseId: null, dueDate: null, boardId: "bx", userId: "other" },
    ],
    cardLabels: [] as any[],
    checklists: [] as any[],
    items: [] as any[],
  };
  const lists: any = { l1: { id: "l1", title: "Todo", boardId: "b1", userId: "u1" }, lx: { id: "lx", title: "X", boardId: "bx", userId: "other" } };
  const shape = (c: any) => ({
    ...c,
    list: { boardId: c.boardId ?? lists[c.listId].boardId, board: { userId: c.userId ?? lists[c.listId].userId } },
    labels: state.cardLabels.filter((l: any) => l.cardId === c.id).map((l: any) => ({ labelId: l.labelId, label: { id: l.labelId } })),
    checklists: state.checklists.filter((k: any) => k.cardId === c.id).map((k: any) => ({
      ...k,
      items: state.items.filter((i: any) => i.checklistId === k.id).sort((a: any, b: any) => a.order - b.order),
    })),
    _count: { comments: 0, attachments: 0 },
  });
  const make = (s: any) => ({
    list: {
      findMany: async ({ where }: any) =>
        where.id.in
          .map((id: string) => lists[id])
          .filter((l: any) => l && l.boardId === where.board.id && l.userId === where.board.userId),
    },
    label: { findMany: async () => [] },
    course: { findMany: async () => [] },
    card: {
      findMany: async ({ where }: any) => s.cards.filter((c: any) => where.id.in.includes(c.id)).map(shape),
      findFirst: async () => null,
      create: async ({ data }: any) => {
        if (s.cards.some((c: any) => c.id === data.id)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        s.cards.push({ ...data, boardId: "b1", userId: "u1", listId: data.listId });
        return data;
      },
    },
    cardLabel: { createMany: async ({ data }: any) => void s.cardLabels.push(...data) },
    checklist: {
      create: async ({ data }: any) => {
        const row = { id: `k${s.checklists.length + 1}`, ...data };
        s.checklists.push(row);
        return row;
      },
    },
    checklistItem: {
      createMany: async ({ data }: any) => {
        if (opts.failItems) throw new Error("boom");
        s.items.push(...data.map((d: any, i: number) => ({ id: `i${s.items.length + i}`, ...d })));
      },
    },
  });
  const database: any = {
    ...make(state),
    $transaction: async (fn: any) => {
      const snap = JSON.stringify(state);
      try {
        return await fn(make(state));
      } catch (e) {
        Object.assign(state, JSON.parse(snap));
        throw e;
      }
    },
  };
  return { state, database };
};

const draft = (creationId: string, extra: any = {}) => ({
  creationId,
  listId: "l1",
  title: "Học bài A",
  description: "",
  checklistItems: ["Đọc", "Tóm tắt", "Làm bài", "Ôn"],
  ...extra,
});

test("rolls back card and checklist when the last item write fails", async () => {
  const { state, database } = setup({ failItems: true });
  await assert.rejects(() => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1)] }, database));
  assert.equal(state.cards.length, 1);
  assert.equal(state.checklists.length, 0);
});

test("retries the same creation id without duplicating cards or todos", async () => {
  const { state, database } = setup();
  const first = await createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1)] }, database);
  const retry = await createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1)] }, database);
  assert.equal(retry[0].id, first[0].id);
  assert.equal(state.cards.length, 2);
  assert.equal(state.items.length, 4);
  assert.deepEqual(retry[0].checklistProgress, { total: 4, completed: 0 });
});

test("foreign creation id returns a generic error without leaking", async () => {
  const { state, database } = setup();
  await assert.rejects(
    () => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(FOREIGN, { title: "Bí mật" })] }, database),
    (e: any) => e instanceof CapturedCardsError && !/Bí mật/.test(e.message) && e.code !== "CAPTURE_ALREADY_PROCESSED",
  );
  assert.equal(state.cards.length, 1);
});

test("same id with changed content reports already processed and keeps old card", async () => {
  const { state, database } = setup();
  await createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1)] }, database);
  await assert.rejects(
    () => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, { title: "Khác" })] }, database),
    (e: any) => e.code === "CAPTURE_ALREADY_PROCESSED",
  );
  assert.equal(state.cards.find((c: any) => c.id === ID1).title, "Học bài A");
  assert.equal(state.items.length, 4);
});

test("duplicate creation ids inside one batch are rejected", async () => {
  const { state, database } = setup();
  await assert.rejects(() =>
    createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1), draft(ID1, { title: "B" })] }, database),
  );
  assert.equal(state.cards.length, 1);
});

test("primary key conflict from a racing request replays the existing card", async () => {
  const { state, database } = setup();
  const realFindMany = database.card.findMany;
  let calls = 0;
  // first lookup (pre-check) sees nothing; a concurrent request commits right after it
  database.card.findMany = async (args: any) => {
    calls++;
    if (calls === 1) {
      state.cards.push({ id: ID1, listId: "l1", title: "Học bài A", description: "", order: 1, courseId: null, dueDate: null, boardId: "b1", userId: "u1" });
      state.checklists.push({ id: "kr", cardId: ID1, title: "Việc cần làm", order: 0 });
      state.items.push(...["Đọc", "Tóm tắt", "Làm bài", "Ôn"].map((title, order) => ({ id: `r${order}`, checklistId: "kr", title, order, isCompleted: false })));
      return [];
    }
    return realFindMany(args);
  };
  const cards = await createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1)] }, database);
  assert.equal(cards[0].id, ID1);
  assert.equal(state.items.length, 4);
});
