/* eslint-disable @typescript-eslint/no-explicit-any -- fake DB/sender */
import { test } from "node:test";
import assert from "node:assert/strict";

import { runReminderBatch } from "./push-delivery";

const NOW = new Date("2026-10-20T09:30:30.000Z");
const AT = new Date("2026-10-20T09:30:00.000Z"); // reminder instant
const GEN = String(AT.getTime());

const matches = (row: any, where: any): boolean =>
  Object.entries(where).every(([key, cond]: [string, any]) => {
    if (key === "OR") return cond.some((c: any) => matches(row, c));
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) return cond.in.includes(value);
      if ("lte" in cond) return value != null && value <= cond.lte;
      if ("lt" in cond) return value != null && value < cond.lt;
      return false;
    }
    return value === cond;
  });

const apply = (row: any, data: any) => {
  for (const [key, value] of Object.entries(data) as [string, any][]) {
    row[key] = value && typeof value === "object" && "increment" in value ? row[key] + value.increment : value;
  }
};

const setup = (overrides: { delivery?: any; card?: any; sub?: any } = {}) => {
  const state: any = {
    deliveries: [{
      id: "d1", cardId: "c1", recipientUserId: "u1", subscriptionId: "s1", generation: GEN,
      dueAt: AT, nextAttemptAt: AT, expiresAt: new Date(AT.getTime() + 600_000),
      status: "pending", attempts: 0, claimToken: null, leaseUntil: null, ...overrides.delivery,
    }],
    sub: { id: "s1", userId: "u1", active: true, endpoint: "https://fcm.googleapis.com/x", p256dh: "k", auth: "a", bindingId: "b1", ...overrides.sub },
    card: {
      id: "c1", title: "Nộp báo cáo", dueDate: new Date("2026-10-20T10:30:00.000Z"), deadlineOn: null,
      reminder: "60", isCompleted: false, archivedAt: null,
      list: { title: "L", archivedAt: null, board: { id: "b", title: "B", userId: "u1" } }, ...overrides.card,
    },
    sent: [] as any[], notified: [] as any[], subWrites: [] as any[],
  };
  const database: any = {
    reminderDelivery: {
      findMany: async ({ where, take }: any) => state.deliveries.filter((r: any) => matches(r, where)).slice(0, take).map((r: any) => ({ ...r })),
      findUnique: async ({ where }: any) => {
        const row = state.deliveries.find((r: any) => r.id === where.id);
        return row ? { ...row, card: state.card, subscription: state.sub } : null;
      },
      updateMany: async ({ where, data }: any) => {
        const rows = state.deliveries.filter((r: any) => matches(r, where));
        rows.forEach((r: any) => apply(r, data));
        return { count: rows.length };
      },
    },
    webPushSubscription: {
      update: async ({ data }: any) => { state.subWrites.push(data); Object.assign(state.sub, data); },
    },
  };
  const result = (status = 201, extra: any = {}) => async (_s: any, payload: any) => {
    state.sent.push(payload);
    return { statusCode: status, ...extra };
  };
  const deps = (send: any = result()) => ({
    db: database,
    send,
    notifyInApp: async (input: any) => { state.notified.push(input.dedupeKey); },
    newToken: () => "tok",
    log: () => {},
  });
  return { state, database, deps };
};

const row = (s: any) => s.deliveries[0];

test("accepted delivery sends a generic payload with delivery id, binding and display token only", async () => {
  const { state, deps } = setup();
  const out = await runReminderBatch({ now: NOW }, deps());
  assert.deepEqual(out, { claimed: 1, accepted: 1, cancelled: 0, failed: 0, unknown: 0, retried: 0 });
  assert.deepEqual(Object.keys(state.sent[0]).sort(), ["bindingId", "deliveryId", "displayToken"]);
  assert.equal(row(state).status, "accepted");
  assert.notEqual(row(state).displayTokenHash, "tok"); // only the hash is stored
  assert.deepEqual(state.notified, [`card-reminder:u1:c1:${GEN}`]);
});

test("two workers racing claim the row once", async () => {
  const { state, deps } = setup();
  const [a, b] = await Promise.all([runReminderBatch({ now: NOW }, deps()), runReminderBatch({ now: NOW }, deps())]);
  assert.equal(a.claimed + b.claimed, 1);
  assert.equal(state.sent.length, 1);
});

test("a stale claim cannot finalize over another worker", async () => {
  const { state, deps } = setup();
  const send = async () => {
    // While we are "sending", the lease is lost and another claim takes over.
    row(state).claimToken = "someone-else";
    return { statusCode: 201 };
  };
  const out = await runReminderBatch({ now: NOW }, deps(send));
  assert.equal(out.accepted, 0);
  assert.equal(row(state).status, "sending");
  assert.equal(row(state).claimToken, "someone-else");
});

test("generation changed before send cancels without pushing", async () => {
  const { state, deps } = setup({ delivery: { generation: "1" } });
  const out = await runReminderBatch({ now: NOW }, deps());
  assert.equal(out.cancelled, 1);
  assert.equal(row(state).status, "cancelled");
  assert.equal(state.sent.length, 0);
});

test("completed, archived or revoked cancels without pushing", async () => {
  for (const o of [{ card: { isCompleted: true } }, { card: { archivedAt: NOW } }, { sub: { active: false } }, { sub: { userId: "u2" } }]) {
    const { state, deps } = setup(o as any);
    await runReminderBatch({ now: NOW }, deps());
    assert.equal(row(state).status, "cancelled", JSON.stringify(o));
    assert.equal(state.sent.length, 0);
  }
});

test("a delivery past its TTL expires instead of waking the user late", async () => {
  const { state, deps } = setup();
  const out = await runReminderBatch({ now: new Date(AT.getTime() + 11 * 60_000) }, deps());
  assert.equal(out.failed, 1);
  assert.equal(row(state).status, "failed");
  assert.equal(row(state).errorCode, "expired");
  assert.equal(state.sent.length, 0);
});

test("410 deactivates the subscription", async () => {
  const { state, deps } = setup();
  const out = await runReminderBatch({ now: NOW }, deps(async () => ({ statusCode: 410 })));
  assert.equal(out.failed, 1);
  assert.equal(row(state).status, "failed");
  assert.deepEqual(state.subWrites, [{ active: false }]);
});

test("429/503 retry with backoff, at most 3 attempts in total", async () => {
  const { state, deps } = setup();
  const send = async () => ({ statusCode: 503 });
  let now = NOW;
  const statuses: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    await runReminderBatch({ now }, deps(send));
    statuses.push(row(state).status);
    now = new Date(row(state).nextAttemptAt.getTime());
  }
  assert.deepEqual(statuses.slice(0, 3), ["retry", "retry", "failed"]);
  assert.equal(row(state).attempts, 3);
  assert.equal(row(state).errorCode, "http_503");
});

test("retry backs off 30s then 120s and honours Retry-After", async () => {
  const { state, deps } = setup();
  await runReminderBatch({ now: NOW }, deps(async () => ({ statusCode: 429 })));
  assert.equal(row(state).nextAttemptAt.getTime(), NOW.getTime() + 30_000);
  const t2 = new Date(NOW.getTime() + 30_000);
  await runReminderBatch({ now: t2 }, deps(async () => ({ statusCode: 429, retryAfterMs: 200_000 })));
  assert.equal(row(state).nextAttemptAt.getTime(), t2.getTime() + 200_000);
});

test("retry that would land after the TTL fails instead", async () => {
  const { state, deps } = setup();
  const near = new Date(AT.getTime() + 9.9 * 60_000);
  await runReminderBatch({ now: near }, deps(async () => ({ statusCode: 503 })));
  assert.equal(row(state).status, "failed");
});

test("timeout becomes unknown and is never resent", async () => {
  const { state, deps } = setup();
  const timeoutResult = await runReminderBatch({ now: NOW }, deps(async () => { throw new Error("timeout"); }));
  assert.equal(timeoutResult.unknown, 1);
  assert.equal(row(state).status, "unknown");
  const sentBefore = state.sent.length;
  await runReminderBatch({ now: new Date(NOW.getTime() + 3_600_000) }, deps());
  assert.equal(row(state).status, "unknown");
  assert.equal(state.sent.length, sentBefore);
});

test("crash after send: expired sending lease becomes unknown, not resent", async () => {
  const { state, deps } = setup({ delivery: { status: "sending", claimToken: "dead", leaseUntil: new Date(NOW.getTime() - 1000), attempts: 1 } });
  const out = await runReminderBatch({ now: NOW }, deps());
  assert.equal(out.unknown, 1);
  assert.equal(row(state).status, "unknown");
  assert.equal(state.sent.length, 0);
});

test("a live lease is left alone", async () => {
  const { state, deps } = setup({ delivery: { status: "sending", claimToken: "other", leaseUntil: new Date(NOW.getTime() + 30_000) } });
  const out = await runReminderBatch({ now: NOW }, deps());
  assert.equal(out.claimed, 0);
  assert.equal(row(state).status, "sending");
});
