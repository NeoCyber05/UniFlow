/* eslint-disable @typescript-eslint/no-explicit-any -- fake DB */
import { test } from "node:test";
import assert from "node:assert/strict";

import { PUBLIC_API } from "../../server/app";
import { hashDisplayToken } from "./push-delivery";
import { createRateLimiter, handleDisplayRequest, resolveDeliveryTarget, verifyPushDisplay } from "./push-display";

const NOW = new Date("2026-10-20T09:31:00.000Z");
const AT = new Date("2026-10-20T09:30:00.000Z");
const ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "A".repeat(43);

const makeDb = (over: { delivery?: any; card?: any; sub?: any } = {}) => {
  const delivery = {
    id: ID, cardId: "c1", recipientUserId: "u1", generation: String(AT.getTime()), status: "accepted",
    expiresAt: new Date(AT.getTime() + 600_000), displayTokenHash: hashDisplayToken(TOKEN),
    subscription: { active: true, userId: "u1", ...over.sub },
    card: {
      id: "c1", dueDate: new Date("2026-10-20T10:30:00.000Z"), deadlineOn: null, reminder: "60",
      isCompleted: false, archivedAt: null,
      list: { archivedAt: null, board: { id: "b1", userId: "u1" } }, ...over.card,
    },
    ...over.delivery,
  };
  return { reminderDelivery: { findUnique: async ({ where }: any) => (where.id === ID ? delivery : null), findFirst: async ({ where }: any) => (where.id === ID && where.recipientUserId === delivery.recipientUserId ? delivery : null) } } as any;
};

test("valid capability is allowed", async () => {
  assert.deepEqual(await verifyPushDisplay({ deliveryId: ID, displayToken: TOKEN }, makeDb(), NOW), { allowed: true });
  // Delivery accepted late or left unknown by the worker is still shown if the provider delivered it.
  assert.deepEqual(await verifyPushDisplay({ deliveryId: ID, displayToken: TOKEN }, makeDb({ delivery: { status: "unknown" } }), NOW), { allowed: true });
});

test("wrong token, expired, old generation, revoked subscription and finished task are all denied", async () => {
  const denied = [
    [{ deliveryId: ID, displayToken: "B".repeat(43) }, makeDb()],
    [{ deliveryId: ID, displayToken: TOKEN }, makeDb({ delivery: { expiresAt: new Date(NOW.getTime() - 1) } })],
    [{ deliveryId: ID, displayToken: TOKEN }, makeDb({ delivery: { generation: "1" } })],
    [{ deliveryId: ID, displayToken: TOKEN }, makeDb({ sub: { active: false } })],
    [{ deliveryId: ID, displayToken: TOKEN }, makeDb({ sub: { userId: "u2" } })],
    [{ deliveryId: ID, displayToken: TOKEN }, makeDb({ card: { isCompleted: true } })],
    [{ deliveryId: ID, displayToken: TOKEN }, makeDb({ delivery: { status: "cancelled" } })],
    [{ deliveryId: ID, displayToken: TOKEN }, makeDb({ delivery: { status: "retry" } })],
    [{ deliveryId: "22222222-2222-4222-8222-222222222222", displayToken: TOKEN }, makeDb()],
  ] as const;
  for (const [input, database] of denied) {
    assert.deepEqual(await verifyPushDisplay(input, database, NOW), { allowed: false });
  }
});

const post = (body: unknown, ip = "1.2.3.4") =>
  new Request("http://x/api/push/display", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

test("handler answers only {allowed}, rejects bad bodies and rate limits", async () => {
  const deps = { db: makeDb(), now: () => NOW, limiter: createRateLimiter({ limit: 2, windowMs: 60_000 }) };
  const ok = await handleDisplayRequest(post({ deliveryId: ID, displayToken: TOKEN }), deps);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { allowed: true });

  assert.equal((await handleDisplayRequest(post("{nope"), deps)).status, 400);
  // third request from the same address inside the window
  assert.equal((await handleDisplayRequest(post({ deliveryId: ID, displayToken: TOKEN }), deps)).status, 429);
  // another address is unaffected, and an oversized body is rejected
  const big = await handleDisplayRequest(post({ deliveryId: ID, displayToken: "A".repeat(5000) }, "9.9.9.9"), deps);
  assert.equal(big.status, 400);
});

test("only the exact display path is public", () => {
  const isPublic = (path: string) => PUBLIC_API.some((re) => re.test(path));
  assert.equal(isPublic("/api/push/display"), true);
  for (const path of ["/api/push/config", "/api/push/subscriptions", `/api/push/deliveries/${ID}`, "/api/push/display/x", "/api/push/displayx"]) {
    assert.equal(isPublic(path), false, path);
  }
});

test("delivery lookup returns the board and card only to the recipient", async () => {
  const database = makeDb();
  assert.deepEqual(await resolveDeliveryTarget("u1", ID, database), { boardId: "b1", cardId: "c1" });
  assert.equal(await resolveDeliveryTarget("u2", ID, database), null);
  assert.equal(await resolveDeliveryTarget("u1", "not-a-uuid", database), null);
  assert.equal(await resolveDeliveryTarget("u1", ID, makeDb({ card: { archivedAt: NOW } })), null);
  assert.equal(await resolveDeliveryTarget("u1", ID, makeDb({ card: { list: { archivedAt: null, board: { id: "b1", userId: "u9" } } } })), null);
});
