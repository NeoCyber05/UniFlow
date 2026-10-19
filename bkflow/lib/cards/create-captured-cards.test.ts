/* eslint-disable @typescript-eslint/no-explicit-any -- fake db */
import { test } from "node:test";
import assert from "node:assert/strict";

import { CapturedCardsError, createCapturedCards, createCapturedCardsWithStatus } from "./create-captured-cards";

const ID1 = "11111111-1111-4111-8111-111111111111";
const FOREIGN = "33333333-3333-4333-8333-333333333333";

type Opts = { failItems?: boolean; failCardId?: string; failReminder?: boolean };

const setup = (opts: Opts = {}) => {
  const state: any = {
    cards: [
      // card of another user's board that already owns FOREIGN
      { id: FOREIGN, listId: "lx", title: "Bí mật", description: "", order: 1, courseId: null, dueDate: null, boardId: "bx", userId: "other" },
    ],
    cardLabels: [] as any[],
    checklists: [] as any[],
    items: [] as any[],
    deliveries: [] as any[],
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
    userStates: c.userStates ?? [],
    _count: { comments: 0, attachments: 0 },
  });
  const make = (s: any) => ({
    list: {
      findMany: async ({ where }: any) =>
        where.id.in
          .map((id: string) => lists[id])
          .filter((l: any) => l && l.boardId === where.board.id && l.userId === where.board.userId),
    },
    label: { findMany: async ({ where }: any) => where.id.in.filter((id: string) => id === "lab1").map((id: string) => ({ id })) },
    course: { findMany: async ({ where }: any) => where.id.in.filter((id: string) => id === "c1").map((id: string) => ({ id })) },
    card: {
      findMany: async ({ where }: any) => s.cards.filter((c: any) => where.id.in.includes(c.id)).map(shape),
      findFirst: async () => null,
      findUnique: async ({ where }: any) => {
        const c = s.cards.find((card: any) => card.id === where.id);
        return c && { ...c, list: { archivedAt: null, board: { userId: "u1" } } };
      },
      update: async ({ where, data }: any) => Object.assign(s.cards.find((c: any) => c.id === where.id), data),
      create: async ({ data }: any) => {
        if (s.cards.some((c: any) => c.id === data.id)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const { userStates, ...rest } = data;
        s.cards.push({ isCompleted: false, archivedAt: null, ...rest, userStates: userStates ? [userStates.create] : [], boardId: "b1", userId: "u1" });
        return data;
      },
    },
    webPushSubscription: { findMany: async () => [{ id: "sub1" }] },
    reminderDelivery: {
      updateMany: async () => ({ count: 0 }),
      createMany: async ({ data }: any) => {
        if (opts.failReminder) throw new Error("reminder boom");
        s.deliveries.push(...data);
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

const FULL = {
  deadlineOn: "2099-10-20",
  scheduledStartAt: "2099-10-19T12:00:00.000Z",
  scheduledEndAt: "2099-10-19T13:00:00.000Z",
  reminder: "60",
  isImportant: true,
  myDay: true,
  courseId: "c1",
  labelIds: ["lab1"],
};

test("all capture fields survive create and replay", async () => {
  const { state, database } = setup();
  const [card] = await createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database);
  const stored = state.cards.find((c: any) => c.id === ID1);
  assert.equal(stored.deadlineOn.toISOString(), "2099-10-20T00:00:00.000Z");
  assert.equal(stored.dueDate, undefined);
  assert.equal(stored.scheduledStartAt.toISOString(), FULL.scheduledStartAt);
  assert.equal(stored.startDate, undefined);
  assert.equal(stored.reminder, "60");
  assert.ok(stored.reminderSetAt instanceof Date);
  assert.equal(stored.userStates[0].isImportant, true);
  assert.ok(stored.userStates[0].myDayAt instanceof Date);
  assert.equal(state.deliveries.length, 1);
  assert.equal((card as any).userStates, undefined);

  const { createdIds } = await createCapturedCardsWithStatus({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database);
  assert.equal(createdIds.size, 0);
  assert.equal(state.cards.length, 2);
  assert.equal(state.deliveries.length, 1);
});

test("todo or reminder failure rolls back whole creation", async () => {
  const { state, database } = setup({ failReminder: true });
  await assert.rejects(() => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database));
  assert.equal(state.cards.length, 1);
  assert.equal(state.items.length, 0);
});

test("same id changed schedule is conflict", async () => {
  const { database } = setup();
  await createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database);
  for (const change of [
    { scheduledStartAt: "2099-10-19T13:00:00.000Z", scheduledEndAt: "2099-10-19T14:00:00.000Z" },
    { reminder: "1440" },
    { myDay: false },
    { isImportant: false },
    { deadlineOn: null, dueDate: "2099-10-20T10:00:00.000Z" },
  ]) {
    await assert.rejects(
      () => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, { ...FULL, ...change })] }, database),
      (e: any) => e.code === "CAPTURE_ALREADY_PROCESSED",
    );
  }
});

test("foreign ids rejected without leak", async () => {
  const { state, database } = setup();
  for (const extra of [{ courseId: "c-other" }, { labelIds: ["lab-other"] }]) {
    await assert.rejects(
      () => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, extra)] }, database),
      (e: any) => e instanceof CapturedCardsError && !/other/.test(e.message),
    );
  }
  assert.equal(state.cards.length, 1);
});

test("invalid dates are rejected before any write", async () => {
  const { state, database } = setup();
  for (const extra of [
    { dueDate: "2099-10-20T10:00:00.000Z", deadlineOn: "2099-10-20" },
    { scheduledStartAt: "2099-10-19T13:00:00.000Z", scheduledEndAt: "2099-10-19T12:00:00.000Z" },
    { scheduledOn: "2099-10-19", scheduledStartAt: "2099-10-19T12:00:00.000Z", scheduledEndAt: "2099-10-19T13:00:00.000Z" },
    { deadlineOn: "2099-02-30" },
    { reminder: "60" },
    { deadlineOn: "2000-01-01", reminder: "60" },
    { deadlineOn: "2099-10-20", reminder: "soon" },
  ]) {
    await assert.rejects(() => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, extra)] }, database), CapturedCardsError);
  }
  assert.equal(state.cards.length, 1);
});

test("lost response retries exactly once", async () => {
  const { state, database } = setup();
  const first = await createCapturedCardsWithStatus({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database);
  // response lost: client retries the frozen snapshot with the same id
  const retry = await createCapturedCardsWithStatus({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database);
  assert.deepEqual([...first.createdIds], [ID1]);
  assert.equal(retry.createdIds.size, 0);
  assert.equal(retry.cards[0].id, ID1);
  assert.equal(state.cards.filter((c: any) => c.id === ID1).length, 1);
  assert.equal(state.checklists.length, 1);
});
