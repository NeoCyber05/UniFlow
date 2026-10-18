/* eslint-disable @typescript-eslint/no-explicit-any -- fake DB */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getPushSubscriptionStatus,
  parsePushSubscriptionInput,
  revokePushSubscription,
  upsertPushSubscription,
} from "./push-subscriptions";

const P256DH = Buffer.alloc(65, 4).toString("base64url");
const AUTH = Buffer.alloc(16, 7).toString("base64url");
const valid = (endpoint = "https://wns2-par02p.notify.windows.com/w/?token=abc") => ({
  endpoint,
  keys: { p256dh: P256DH, auth: AUTH },
});

const setup = () => {
  const state = { subs: [] as any[], cancelled: [] as any[], synced: [] as string[], seq: 0 };
  const table = {
    findUnique: async ({ where }: any) => state.subs.find((s) => s.endpoint === where.endpoint) ?? null,
    findFirst: async ({ where }: any) =>
      state.subs.find((s) => s.id === where.id && s.userId === where.userId) ?? null,
    create: async ({ data }: any) => {
      const row = { id: `s${++state.seq}`, active: true, ...data };
      state.subs.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = state.subs.find((s) => s.id === where.id);
      Object.assign(row, data);
      return row;
    },
  };
  const database: any = {
    webPushSubscription: table,
    reminderDelivery: {
      updateMany: async (args: any) => {
        state.cancelled.push(args.where.subscriptionId);
        return { count: 1 };
      },
    },
    $transaction: async (fn: any) => fn(database),
  };
  const deps = { syncSubscriptionReminders: async (_tx: any, { subscriptionId }: any) => { state.synced.push(subscriptionId); } };
  return { state, database, deps };
};

test("rejects oversized payload, private urls and malformed keys", () => {
  const bad = [
    valid("http://fcm.googleapis.com/fcm/send/x"),
    valid("https://localhost/push"),
    valid("https://127.0.0.1/push"),
    valid("https://evil.example.com/push"),
    valid("https://user:pw@fcm.googleapis.com/x"),
    valid(`https://fcm.googleapis.com/${"a".repeat(2100)}`),
    { endpoint: valid().endpoint, keys: { p256dh: "short", auth: AUTH } },
    { endpoint: valid().endpoint, keys: { p256dh: P256DH, auth: "!!" } },
    { endpoint: 5, keys: {} },
  ];
  for (const input of bad) assert.ok("error" in parsePushSubscriptionInput(input), JSON.stringify(input).slice(0, 80));
  assert.ok(!("error" in parsePushSubscriptionInput(valid())));
});

test("deduplicates tabs and prevents cross-account subscription access", async () => {
  const { state, database, deps } = setup();
  const first: any = await upsertPushSubscription("u1", valid(), database, deps);
  const second: any = await upsertPushSubscription("u1", valid(), database, deps);
  assert.equal(state.subs.length, 1);
  assert.equal(second.data.subscriptionId, first.data.subscriptionId);
  assert.equal(second.data.bindingId, first.data.bindingId);

  // Another account cannot read or revoke it.
  assert.equal(await revokePushSubscription("u2", first.data.subscriptionId, database), false);
  assert.equal(state.subs[0].active, true);
  assert.deepEqual(await getPushSubscriptionStatus("u2", first.data.subscriptionId, database), { active: false });

  // Same browser endpoint re-registered by another account moves ownership, new binding, old deliveries cancelled.
  const moved: any = await upsertPushSubscription("u2", valid(), database, deps);
  assert.equal(state.subs[0].userId, "u2");
  assert.notEqual(moved.data.bindingId, first.data.bindingId);
  assert.deepEqual(state.cancelled, [first.data.subscriptionId]);
  assert.equal(await revokePushSubscription("u1", first.data.subscriptionId, database), false);
});

test("revoke deactivates and cancels open deliveries", async () => {
  const { state, database, deps } = setup();
  const { data }: any = await upsertPushSubscription("u1", valid(), database, deps);
  assert.equal(await revokePushSubscription("u1", data.subscriptionId, database), true);
  assert.equal(state.subs[0].active, false);
  assert.deepEqual(state.cancelled, [data.subscriptionId]);
  assert.deepEqual(await getPushSubscriptionStatus("u1", data.subscriptionId, database), { active: false });
});

test("subscribing schedules future reminders only through sync", async () => {
  const { state, database, deps } = setup();
  const { data }: any = await upsertPushSubscription("u1", valid(), database, deps);
  assert.deepEqual(state.synced, [data.subscriptionId]);
});
