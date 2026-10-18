/* eslint-disable @typescript-eslint/no-explicit-any -- fake db */
import { test } from "node:test";
import assert from "node:assert/strict";

import { CapturedCardsError, createCapturedCards, createCapturedCardsWithStatus } from "./create-captured-cards";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const FOREIGN = "33333333-3333-4333-8333-333333333333";

type Opts = { failItems?: boolean; failReminder?: boolean };

const setup = (opts: Opts = {}) => {
  const state: any = {
    cards: [
      // card of another user's board that already owns FOREIGN
      { id: FOREIGN, listId: "lx", title: "Bí mật", description: "", order: 1, courseId: null, dueDate: null, boardId: "bx", userId: "other" },
    ],
    cardLabels: [] as any[],
    checklists: [] as any[],
    items: [] as any[],
    userStates: [] as any[],
    deliveries: [] as any[],
  };
  const lists: any = { l1: { id: "l1", title: "Todo", boardId: "b1", userId: "u1" }, lx: { id: "lx", title: "X", boardId: "bx", userId: "other" } };
  const courses: any[] = [{ id: "c1", boardId: "b1", userId: "u1" }, { id: "cx", boardId: "bx", userId: "other" }];
  const subs = [{ id: "s1", userId: "u1", active: true }];
  const shape = (s: any, c: any) => ({
    deadlineOn: null,
    scheduledOn: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    reminder: null,
    ...c,
    dueDate: c.dueDate ?? null,
    list: { boardId: c.boardId ?? lists[c.listId].boardId, board: { userId: c.userId ?? lists[c.listId].userId } },
    userStates: s.userStates.filter((u: any) => u.cardId === c.id),
    labels: s.cardLabels.filter((l: any) => l.cardId === c.id).map((l: any) => ({ labelId: l.labelId, label: { id: l.labelId } })),
    checklists: s.checklists.filter((k: any) => k.cardId === c.id).map((k: any) => ({
      ...k,
      items: s.items.filter((i: any) => i.checklistId === k.id).sort((a: any, b: any) => a.order - b.order),
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
    course: {
      findMany: async ({ where }: any) =>
        courses.filter((c) => where.id.in.includes(c.id) && c.boardId === where.boardId && c.userId === where.board.userId),
    },
    card: {
      findMany: async ({ where }: any) => s.cards.filter((c: any) => where.id.in.includes(c.id)).map((c: any) => shape(s, c)),
      findFirst: async () => null,
      findUnique: async ({ where }: any) => {
        const card = s.cards.find((c: any) => c.id === where.id);
        return card && { ...shape(s, card), isCompleted: false, archivedAt: null, reminderGeneration: card.reminderGeneration ?? null, list: { archivedAt: null, board: { userId: "u1" } } };
      },
      update: async ({ where, data }: any) => Object.assign(s.cards.find((c: any) => c.id === where.id), data),
      create: async ({ data }: any) => {
        if (s.cards.some((c: any) => c.id === data.id)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const { userStates, ...card } = data;
        s.cards.push({ ...card, boardId: "b1", userId: "u1" });
        if (userStates) s.userStates.push({ cardId: data.id, ...userStates.create });
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
    webPushSubscription: { findMany: async () => subs },
    reminderDelivery: {
      updateMany: async () => ({ count: 0 }),
      createMany: async ({ data }: any) => {
        if (opts.failReminder) throw new Error("reminder boom");
        s.deliveries.push(...data);
      },
    },
  });
  // Transactions run one at a time: Postgres makes a second insert of the same primary key wait for the first commit.
  let queue: Promise<unknown> = Promise.resolve();
  const database: any = {
    ...make(state),
    $transaction: (fn: any) => {
      const run = queue.then(async () => {
        const snap = JSON.stringify(state);
        try {
          return await fn(make(state));
        } catch (e) {
          const restored = JSON.parse(snap, (key, value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : value);
          for (const key of Object.keys(state)) state[key] = restored[key];
          throw e;
        }
      });
      queue = run.catch(() => undefined);
      return run;
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

const FULL = {
  courseId: "c1",
  deadlineOn: "2030-01-10",
  scheduledStartAt: "2030-01-09T12:00:00.000Z",
  scheduledEndAt: "2030-01-09T13:00:00.000Z",
  reminder: "60",
  isImportant: true,
  myDay: true,
};

test("rolls back card and checklist when the last item write fails", async () => {
  const { state, database } = setup({ failItems: true });
  await assert.rejects(() => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1)] }, database));
  assert.equal(state.cards.length, 1);
  assert.equal(state.checklists.length, 0);
});

test("todo or reminder failure rolls back whole creation", async () => {
  const { state, database } = setup({ failReminder: true });
  await assert.rejects(() => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database));
  assert.equal(state.cards.length, 1);
  assert.equal(state.checklists.length, 0);
  assert.equal(state.items.length, 0);
  assert.equal(state.userStates.length, 0);
  assert.equal(state.deliveries.length, 0);
});

test("all capture fields survive create and replay", async () => {
  const { state, database } = setup();
  const first = await createCapturedCardsWithStatus({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database);
  const card = state.cards.find((c: any) => c.id === ID1);
  assert.equal(card.deadlineOn.toISOString(), "2030-01-10T00:00:00.000Z");
  assert.equal(card.dueDate, null);
  assert.equal(card.startDate, undefined, "không ghi lịch mới vào startDate legacy");
  assert.equal(card.scheduledStartAt.toISOString(), "2030-01-09T12:00:00.000Z");
  assert.equal(card.reminder, "60");
  assert.equal(card.courseId, "c1");
  assert.equal(state.userStates[0].isImportant, true);
  assert.ok(state.userStates[0].myDayAt instanceof Date);
  assert.equal(state.deliveries.length, 1);
  assert.equal(state.deliveries[0].dueAt.toISOString(), "2030-01-10T01:00:00.000Z"); // 09:00 VN − 60 phút
  assert.deepEqual([...first.createdIds], [ID1]);
  assert.equal("userStates" in first.cards[0], false);

  const replay = await createCapturedCardsWithStatus({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database);
  assert.equal(replay.cards[0].id, ID1);
  assert.equal(replay.createdIds.size, 0);
  assert.equal(state.cards.length, 2);
  assert.equal(state.items.length, 4);
  assert.equal(state.deliveries.length, 1);
});

test("lost response retries exactly once", async () => {
  const { state, database } = setup();
  const first = await createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1)] }, database);
  const retry = await createCapturedCardsWithStatus({ userId: "u1", boardId: "b1", drafts: [draft(ID1)] }, database);
  assert.equal(retry.cards[0].id, first[0].id);
  assert.equal(retry.createdIds.size, 0, "effects must not run twice");
  assert.equal(state.cards.length, 2);
  assert.equal(state.items.length, 4);
  assert.deepEqual(retry.cards[0].checklistProgress, { total: 4, completed: 0 });
});

test("concurrent identical requests create one card", async () => {
  const { state, database } = setup();
  const results = await Promise.all([1, 2].map(() =>
    createCapturedCardsWithStatus({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database)));
  assert.equal(state.cards.length, 2);
  assert.equal(state.checklists.length, 1);
  assert.equal(results.reduce((n, r) => n + r.createdIds.size, 0), 1);
});

test("foreign ids rejected without leak", async () => {
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

test("same id changed schedule is conflict", async () => {
  const { database } = setup();
  await createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, FULL)] }, database);
  for (const change of [
    { scheduledStartAt: "2030-01-09T11:00:00.000Z" },
    { deadlineOn: null, dueDate: "2030-01-10T10:00:00.000Z" },
    { reminder: "1440" },
    { isImportant: false },
    { myDay: false },
  ]) {
    await assert.rejects(
      () => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, { ...FULL, ...change })] }, database),
      (e: any) => e.code === "CAPTURE_ALREADY_PROCESSED",
      JSON.stringify(change),
    );
  }
});

test("course of another board is rejected, not silently dropped", async () => {
  const { state, database } = setup();
  await assert.rejects(
    () => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID1, { courseId: "cx" })] }, database),
    (e: any) => e instanceof CapturedCardsError && e.message === "Môn không hợp lệ.",
  );
  assert.equal(state.cards.length, 1);
});

test("invalid dates and reminders are rejected before any write", async () => {
  const { state, database } = setup();
  for (const extra of [
    { deadlineOn: "2030-02-30" },
    { dueDate: "2030-01-10T10:00:00.000Z", deadlineOn: "2030-01-10" },
    { scheduledOn: "2030-01-09", scheduledStartAt: "2030-01-09T12:00:00.000Z", scheduledEndAt: "2030-01-09T13:00:00.000Z" },
    { scheduledStartAt: "2030-01-09T13:00:00.000Z", scheduledEndAt: "2030-01-09T12:00:00.000Z" },
    { reminder: "60" },
    { deadlineOn: "2020-01-10", reminder: "60" },
    { description: "[x](javascript:alert(1))" },
  ]) {
    await assert.rejects(() => createCapturedCards({ userId: "u1", boardId: "b1", drafts: [draft(ID2, extra)] }, database), CapturedCardsError, JSON.stringify(extra));
  }
  assert.equal(state.cards.length, 1);
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
