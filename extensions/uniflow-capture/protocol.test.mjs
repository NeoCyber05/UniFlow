import { test } from "node:test";
import assert from "node:assert/strict";

import { CHANNEL, REQUEST_TTL_MS, createHandler, createStore, popupBounds } from "./protocol.js";

const EXT = "ext-id";
const UNIFLOW = "https://uniflow.example";
const SLACK_TAB = { id: 7 };
const T0 = Date.parse("2026-10-18T03:00:00Z");

const memoryArea = () => {
  const data = new Map();
  return {
    data,
    get: async (key) => (key === null ? Object.fromEntries(data) : data.has(key) ? { [key]: data.get(key) } : {}),
    set: async (items) => Object.entries(items).forEach(([k, v]) => data.set(k, structuredClone(v))),
    remove: async (key) => void data.delete(key),
  };
};

const setup = ({ area = memoryArea(), uniflowOrigin = UNIFLOW, granted = ["https://app.slack.com/*"] } = {}) => {
  const clock = { now: T0 };
  const opened = [];
  let ids = 0;
  let options = 0;
  const handler = createHandler({
    store: createStore(area),
    extensionId: EXT,
    clock: () => clock.now,
    timeZone: "Asia/Ho_Chi_Minh",
    randomId: () => `00000000-0000-4000-8000-00000000000${++ids}`,
    getConfig: async () => ({ uniflowOrigin, sourcePatterns: granted }),
    openPopup: async (url, bounds) => {
      opened.push({ url, bounds });
      return 99;
    },
    openOptions: () => options++,
  });
  return { handler, area, clock, opened, options: () => options };
};

const slackSender = { id: EXT, tab: SLACK_TAB, frameId: 0, url: "https://app.slack.com/client/T1/C2" };
const popupSender = { id: EXT, tab: { id: 99 }, frameId: 0, url: `${UNIFLOW}/capture` };

const request = (payload = {}) => ({
  channel: CHANNEL,
  v: 1,
  type: "CAPTURE_REQUEST",
  payload: {
    selectedText: "Các em nộp bài trước 17h30 chiều nay nhé",
    pageUrl: "https://app.slack.com/client/T1/C2?secret=1#x",
    pageTitle: "Slack | lop-it",
    messageSentAt: "2026-10-12T03:00:00.000Z",
    anchor: { x: 500, y: 300, availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080 },
    ...payload,
  },
});
const bridge = (type, requestId) => ({ channel: CHANNEL, v: 1, type, requestId });

const openRequest = async (ctx) => {
  assert.deepEqual(await ctx.handler.handle(request(), slackSender), { ok: true });
  return ctx.opened.at(-1).url.split("#request=")[1];
};

test("request stores pending draft and opens popup with only an id in the URL", async () => {
  const ctx = setup();
  const id = await openRequest(ctx);
  const { url } = ctx.opened[0];
  assert.equal(url, `${UNIFLOW}/capture#request=${id}`);
  assert.doesNotMatch(url, /nộp|n%E1/i);
  const ready = await ctx.handler.handle(bridge("CAPTURE_READY", id), popupSender);
  assert.equal(ready.ok, true);
  assert.deepEqual(ready.source, {
    selectedText: "Các em nộp bài trước 17h30 chiều nay nhé",
    pageUrl: "https://app.slack.com/client/T1/C2",
    pageTitle: "Slack | lop-it",
    messageSentAt: "2026-10-12T03:00:00.000Z",
    adapter: "uniflow-capture-dom",
    capturedAt: "2026-10-18T03:00:00.000Z",
    timeZone: "Asia/Ho_Chi_Minh",
  });
});

test("host without grant or foreign extension is rejected", async () => {
  const ctx = setup({ granted: [] });
  assert.equal((await ctx.handler.handle(request(), slackSender)).ok, false);
  const other = setup();
  assert.equal((await other.handler.handle(request(), { ...slackSender, id: "evil" })).ok, false);
  assert.equal(ctx.opened.length + other.opened.length, 0);
});

test("missing UniFlow origin opens options instead of a popup", async () => {
  const ctx = setup({ uniflowOrigin: null });
  assert.deepEqual(await ctx.handler.handle(request(), slackSender), { ok: false, error: "not-configured" });
  assert.equal(ctx.options(), 1);
});

test("oversized or empty selection rejected", async () => {
  const ctx = setup();
  assert.equal((await ctx.handler.handle(request({ selectedText: "x".repeat(4_001) }), slackSender)).ok, false);
  assert.equal((await ctx.handler.handle(request({ selectedText: "  " }), slackSender)).ok, false);
  assert.equal(ctx.opened.length, 0);
});

test("unparseable message time is dropped, not guessed", async () => {
  const ctx = setup();
  await ctx.handler.handle(request({ messageSentAt: "hôm qua" }), slackSender);
  const id = ctx.opened[0].url.split("#request=")[1];
  const ready = await ctx.handler.handle(bridge("CAPTURE_READY", id), popupSender);
  assert.equal(ready.source.messageSentAt, undefined);
  assert.equal(ready.source.adapter, undefined);
});

test("wrong tab frame origin nonce rejected", async () => {
  const ctx = setup();
  const id = await openRequest(ctx);
  const cases = [
    [bridge("CAPTURE_READY", id), { ...popupSender, tab: { id: 98 } }, "wrong-tab"],
    [bridge("CAPTURE_READY", id), { ...popupSender, frameId: 3 }, "wrong-frame"],
    [bridge("CAPTURE_READY", id), { ...popupSender, url: "https://evil.example/capture" }, "wrong-origin"],
    [bridge("CAPTURE_READY", "00000000-0000-4000-8000-999999999999"), popupSender, "missing"],
    [{ ...bridge("CAPTURE_READY", id), v: 2 }, popupSender, "bad-message"],
  ];
  for (const [message, sender, error] of cases) {
    assert.deepEqual(await ctx.handler.handle(message, sender), { ok: false, error });
  }
});

test("expired draft not delivered and is purged", async () => {
  const ctx = setup();
  const id = await openRequest(ctx);
  ctx.clock.now += REQUEST_TTL_MS + 1;
  assert.deepEqual(await ctx.handler.handle(bridge("CAPTURE_READY", id), popupSender), { ok: false, error: "missing" });
  assert.equal(ctx.area.data.size, 0);
});

test("worker restart retains pending draft", async () => {
  const area = memoryArea();
  const first = setup({ area });
  const id = await openRequest(first);
  const restarted = setup({ area });
  assert.equal((await restarted.handler.handle(bridge("CAPTURE_READY", id), popupSender)).ok, true);
});

test("saved or cancelled removes the draft", async () => {
  const ctx = setup();
  const id = await openRequest(ctx);
  assert.deepEqual(await ctx.handler.handle(bridge("CAPTURE_SAVED", id), popupSender), { ok: true });
  assert.equal((await ctx.handler.handle(bridge("CAPTURE_READY", id), popupSender)).ok, false);
});

test("reopen sends the latest pending draft to a new popup", async () => {
  const ctx = setup();
  const id = await openRequest(ctx);
  assert.equal(await ctx.handler.reopenLatest(), true);
  assert.equal(ctx.opened.length, 2);
  assert.equal(ctx.opened[1].url, `${UNIFLOW}/capture#request=${id}`);
  ctx.clock.now += REQUEST_TTL_MS + 1;
  assert.equal(await ctx.handler.reopenLatest(), false);
});

test("popup is placed near the selection and kept on screen", () => {
  assert.deepEqual(popupBounds({ x: 500, y: 300, availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080 }), { left: 500, top: 308, width: 440, height: 640 });
  assert.deepEqual(popupBounds({ x: 1900, y: 1000, availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080 }), { left: 1480, top: 440, width: 440, height: 640 });
  assert.deepEqual(popupBounds(undefined), { width: 440, height: 640 });
});
