/* eslint-disable @typescript-eslint/no-explicit-any -- fake tx */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getCardReminder,
  syncCardReminder,
  syncCardReminders,
  syncSubscriptionReminders,
} from "./reminder-deliveries";

const NOW = new Date("2026-10-18T03:00:00.000Z");
const T1 = new Date("2026-10-20T10:30:00.000Z"); // 17:30 VN

const makeCard = (over: any = {}) => ({
  id: "c1",
  dueDate: T1 as Date | null,
  deadlineOn: null as Date | null,
  reminder: "60" as string | null,
  isCompleted: false,
  archivedAt: null as Date | null,
  reminderGeneration: null as string | null,
  scheduledStartAt: null as Date | null,
  updatedAt: new Date("2026-10-18T02:00:00.000Z"),
  list: { archivedAt: null as Date | null, board: { userId: "u1" } },
  ...over,
});

const setup = (card = makeCard(), subs: any[] = [{ id: "s1", userId: "u1", active: true }]) => {
  const state = { card, subs, deliveries: [] as any[], cardWrites: [] as any[] };
  const matchStatus = (row: any, cond: any) => !cond || (cond.in ? cond.in.includes(row.status) : row.status === cond);
  const tx: any = {
    card: {
      findUnique: async ({ where }: any) => (where.id === state.card.id ? { ...state.card } : null),
      update: async ({ data }: any) => {
        state.cardWrites.push(data);
        Object.assign(state.card, data);
        return state.card;
      },
      findMany: async () => [{ ...state.card }],
    },
    webPushSubscription: {
      findMany: async ({ where }: any) => state.subs.filter((s) => s.userId === where.userId && s.active),
      findUnique: async ({ where }: any) => state.subs.find((s) => s.id === where.id) ?? null,
    },
    reminderDelivery: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const row of state.deliveries) {
          if (row.cardId !== where.cardId || !matchStatus(row, where.status)) continue;
          if (where.generation?.not !== undefined && row.generation === where.generation.not) continue;
          if (typeof where.generation === "string" && row.generation !== where.generation) continue;
          if (where.subscription && !state.subs.find((s) => s.id === row.subscriptionId && s.active)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
      createMany: async ({ data }: any) => {
        for (const d of data) {
          const dup = state.deliveries.some((r) =>
            r.cardId === d.cardId && r.generation === d.generation && r.subscriptionId === d.subscriptionId);
          if (!dup) state.deliveries.push({ status: "pending", ...d });
        }
        return { count: data.length };
      },
    },
  };
  return { state, tx };
};

const sync = (ctx: ReturnType<typeof setup>, now = NOW) => syncCardReminder(ctx.tx, { cardId: "c1", now });
const live = (ctx: ReturnType<typeof setup>) => ctx.state.deliveries.filter((d) => d.status === "pending");

test("computes reminder time from deadline and offset", () => {
  assert.equal(getCardReminder(makeCard(), NOW)?.at.toISOString(), "2026-10-20T09:30:00.000Z"); // 16:30 VN
  const dateOnly = makeCard({ dueDate: null, deadlineOn: new Date("2026-10-20T00:00:00.000Z"), reminder: "0" });
  assert.equal(getCardReminder(dateOnly, NOW)?.at.toISOString(), "2026-10-20T02:00:00.000Z"); // 09:00 VN, deadline untouched
});

test("no reminder when no deadline, past time, finished, archived or invalid offset", () => {
  const cases = [
    { dueDate: null }, { dueDate: new Date("2026-10-18T03:30:00.000Z") }, { isCompleted: true },
    { archivedAt: NOW }, { list: { archivedAt: NOW, board: { userId: "u1" } } }, { reminder: "none" },
    { reminder: null }, { reminder: "1h_before" },
  ];
  for (const over of cases) assert.equal(getCardReminder(makeCard(over), NOW), null, JSON.stringify(over));
});

test("keeps generation when only work time changes", async () => {
  const ctx = setup();
  await sync(ctx);
  const before = ctx.state.card.reminderGeneration;
  assert.ok(before);
  ctx.state.card.scheduledStartAt = new Date("2026-10-19T12:00:00.000Z");
  await sync(ctx);
  assert.equal(ctx.state.card.reminderGeneration, before);
  assert.equal(ctx.state.cardWrites.length, 1);
  assert.equal(live(ctx).length, 1);
  // The generation write must not bump the revision other clients compare against.
  assert.equal(ctx.state.cardWrites[0].updatedAt.getTime(), new Date("2026-10-18T02:00:00.000Z").getTime());
});

test("two syncs of the same generation and subscription keep one row", async () => {
  const ctx = setup();
  await sync(ctx);
  await sync(ctx);
  assert.equal(ctx.state.deliveries.length, 1);
  assert.equal(ctx.state.deliveries[0].dueAt.toISOString(), "2026-10-20T09:30:00.000Z");
  assert.equal(ctx.state.deliveries[0].recipientUserId, "u1");
});

test("changing deadline or offset cancels the old session and queues a new one", async () => {
  const ctx = setup();
  await sync(ctx);
  const first = ctx.state.card.reminderGeneration;
  ctx.state.card.dueDate = new Date("2026-10-21T10:30:00.000Z");
  await sync(ctx);
  assert.notEqual(ctx.state.card.reminderGeneration, first);
  assert.deepEqual(ctx.state.deliveries.map((d) => d.status), ["cancelled", "pending"]);
  ctx.state.card.reminder = "1440";
  await sync(ctx);
  assert.deepEqual(ctx.state.deliveries.map((d) => d.status), ["cancelled", "cancelled", "pending"]);
});

test("complete, archive and cleared deadline cancel; reopening only queues the future", async () => {
  for (const patch of [{ isCompleted: true }, { archivedAt: NOW }, { dueDate: null }]) {
    const ctx = setup();
    await sync(ctx);
    Object.assign(ctx.state.card, patch);
    await sync(ctx);
    assert.equal(ctx.state.card.reminderGeneration, null);
    assert.equal(live(ctx).length, 0, JSON.stringify(patch));
    // Reopen before the reminder time: queued again (same instant, row revived, still one row).
    Object.assign(ctx.state.card, { isCompleted: false, archivedAt: null, dueDate: T1 });
    await sync(ctx);
    assert.equal(live(ctx).length, 1);
    assert.equal(ctx.state.deliveries.length, 1);
    // Reopen after the reminder time passed: nothing new.
    Object.assign(ctx.state.card, { isCompleted: true });
    await sync(ctx);
    Object.assign(ctx.state.card, { isCompleted: false });
    await sync(ctx, new Date("2026-10-20T09:31:00.000Z"));
    assert.equal(live(ctx).length, 0);
  }
});

test("archived list or removed card never enqueues", async () => {
  const ctx = setup(makeCard({ list: { archivedAt: NOW, board: { userId: "u1" } } }));
  await sync(ctx);
  assert.equal(ctx.state.deliveries.length, 0);
  await syncCardReminder(ctx.tx, { cardId: "gone", now: NOW });
  assert.equal(ctx.state.cardWrites.length, 0);
});

test("syncCardReminders handles a batch of ids", async () => {
  const ctx = setup();
  await syncCardReminders(ctx.tx, { cardIds: ["c1", "c1"], now: NOW });
  assert.equal(ctx.state.deliveries.length, 1);
});

test("new subscription gets future reminders only", async () => {
  const ctx = setup(makeCard(), [{ id: "s2", userId: "u1", active: true }]);
  await syncSubscriptionReminders(ctx.tx, { subscriptionId: "s2", now: NOW });
  assert.deepEqual(ctx.state.deliveries.map((d) => d.subscriptionId), ["s2"]);

  const past = setup(makeCard({ dueDate: new Date("2026-10-17T10:30:00.000Z") }), [{ id: "s2", userId: "u1", active: true }]);
  await syncSubscriptionReminders(past.tx, { subscriptionId: "s2", now: NOW });
  assert.equal(past.state.deliveries.length, 0);

  const off = setup(makeCard(), [{ id: "s2", userId: "u1", active: false }]);
  await syncSubscriptionReminders(off.tx, { subscriptionId: "s2", now: NOW });
  assert.equal(off.state.deliveries.length, 0);
});
