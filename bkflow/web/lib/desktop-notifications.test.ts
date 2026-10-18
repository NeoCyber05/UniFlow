/* eslint-disable @typescript-eslint/no-explicit-any -- fake browser env */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  disableDesktopReminders,
  enableDesktopReminders,
  getDesktopReminderState,
  reconcileDesktopReminders,
  urlBase64ToUint8Array,
} from "./desktop-notifications";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const setup = (opts: { supported?: boolean; permission?: string; asked?: string; apiFail?: string; userId?: string | null } = {}) => {
  const state: any = {
    store: new Map<string, unknown>(),
    calls: [] as string[],
    asked: 0,
    closed: 0,
    unsubscribed: 0,
    sub: null as any,
    permission: opts.permission ?? "default",
  };
  const makeSub = () => ({
    toJSON: () => ({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: async () => { state.unsubscribed += 1; state.sub = null; return true; },
  });
  const registration = {
    pushManager: {
      getSubscription: async () => state.sub,
      subscribe: async () => { state.calls.push("subscribe"); state.sub = makeSub(); return state.sub; },
    },
    getNotifications: async () => [{ close: () => { state.closed += 1; } }, { close: () => { state.closed += 1; } }],
  };
  const env: any = {
    supported: () => opts.supported !== false,
    permission: () => state.permission,
    requestPermission: async () => {
      state.asked += 1;
      state.permission = opts.asked ?? "granted";
      return state.permission;
    },
    getUserId: async () => (opts.userId === undefined ? "u1" : opts.userId),
    api: async (path: string, init?: any) => {
      state.calls.push(`${init?.method ?? "GET"} ${path}`);
      if (opts.apiFail && path.startsWith(opts.apiFail)) return new Response("no", { status: 500 });
      if (path === "/api/push/config") return json({ publicKey: "BEl62iUYgUivxIkv69yViEuiBIa-ib37J8xQmrMfSWoc" });
      if (path === "/api/push/subscriptions" && init?.method === "POST") return json({ subscriptionId: "s1", bindingId: "b1" });
      return new Response(null, { status: 204 });
    },
    registerWorker: async () => registration,
    store: {
      get: async (k: string) => state.store.get(k) ?? null,
      set: async (k: string, v: unknown) => { state.store.set(k, v); },
      delete: async (k: string) => { state.store.delete(k); },
    },
  };
  return { state, env };
};

test("unsupported browsers report unsupported without asking", async () => {
  const { state, env } = setup({ supported: false });
  assert.deepEqual(await enableDesktopReminders(env), { state: "unsupported" });
  assert.equal(state.asked, 0);
  assert.equal(await getDesktopReminderState(env), "unsupported");
});

test("only an explicit enable asks permission; granting registers and stores the binding", async () => {
  const { state, env } = setup();
  assert.equal(state.asked, 0);
  assert.equal(await getDesktopReminderState(env), "disabled");
  assert.equal(state.asked, 0);
  assert.deepEqual(await enableDesktopReminders(env), { state: "enabled" });
  assert.equal(state.asked, 1);
  assert.deepEqual(state.store.get("binding"), { userId: "u1", subscriptionId: "s1", bindingId: "b1" });
  assert.equal(await getDesktopReminderState(env), "enabled");
});

test("denied or dismissed permission stores nothing and never calls the API", async () => {
  for (const [permission, asked] of [["denied", undefined], ["default", "denied"], ["default", "default"]] as const) {
    const { state, env } = setup({ permission, asked });
    assert.deepEqual(await enableDesktopReminders(env), { state: "denied" });
    assert.equal(state.store.size, 0);
    assert.deepEqual(state.calls, []);
  }
});

test("permission granted but registration POST fails still reads as not registered", async () => {
  const { state, env } = setup({ permission: "granted", apiFail: "/api/push/subscriptions" });
  assert.deepEqual(await enableDesktopReminders(env), { state: "error" });
  assert.equal(state.store.size, 0);
  assert.equal(await getDesktopReminderState(env), "disabled");
});

test("push not configured on the server is an error, not enabled", async () => {
  const { state, env } = setup({ permission: "granted", apiFail: "/api/push/config" });
  assert.deepEqual(await enableDesktopReminders(env), { state: "error" });
  assert.equal(state.store.size, 0);
});

test("enabling again (another tab) reuses the browser subscription and the same binding", async () => {
  const { state, env } = setup({ permission: "granted" });
  await enableDesktopReminders(env);
  await enableDesktopReminders(env);
  assert.equal(state.calls.filter((c: string) => c === "subscribe").length, 1);
  assert.deepEqual(state.store.get("binding"), { userId: "u1", subscriptionId: "s1", bindingId: "b1" });
});

test("disable clears the local binding and closes notifications first, even when the network fails", async () => {
  const { state, env } = setup({ permission: "granted" });
  await enableDesktopReminders(env);
  const order: string[] = [];
  const api = env.api;
  env.api = async (path: string, init?: any) => {
    order.push(`api:${state.store.has("binding") ? "bound" : "cleared"}`);
    if (init?.method === "DELETE") throw new Error("offline");
    return api(path, init);
  };
  await disableDesktopReminders(env);
  assert.equal(state.store.has("binding"), false);
  assert.equal(state.closed, 2);
  assert.equal(state.unsubscribed, 1);
  assert.deepEqual(order, ["api:cleared"]); // the DELETE saw an already-cleared binding
});

test("a different or missing account disables the previous binding", async () => {
  const { state, env } = setup({ permission: "granted" });
  await enableDesktopReminders(env);
  await reconcileDesktopReminders("u1", env);
  assert.equal(state.store.has("binding"), true);
  await reconcileDesktopReminders("u2", env);
  assert.equal(state.store.has("binding"), false);

  const again = setup({ permission: "granted" });
  await enableDesktopReminders(again.env);
  await reconcileDesktopReminders(null, again.env);
  assert.equal(again.state.store.has("binding"), false);
});

test("revoked browser permission reads as denied", async () => {
  const { state, env } = setup({ permission: "granted" });
  await enableDesktopReminders(env);
  state.permission = "denied";
  assert.equal(await getDesktopReminderState(env), "denied");
});

test("VAPID key conversion", () => {
  assert.equal(urlBase64ToUint8Array("AQID").length, 3);
});
