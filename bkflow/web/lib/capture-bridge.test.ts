import assert from "node:assert/strict";
import { test } from "node:test";

import { CAPTURE_CHANNEL, notifyCapture, readCaptureRequestId, requestCaptureSource, type BridgeWindow } from "./capture-bridge";

const ORIGIN = "https://uniflow.example";
const ID = "11111111-1111-4111-8111-111111111111";

const fakeWindow = () => {
  const listeners = new Set<(event: MessageEvent) => void>();
  const posted: Array<{ data: Record<string, unknown>; targetOrigin: string }> = [];
  const win = {
    location: { origin: ORIGIN },
    postMessage: (data: Record<string, unknown>, targetOrigin: string) => void posted.push({ data, targetOrigin }),
    addEventListener: (_type: string, fn: (event: MessageEvent) => void) => void listeners.add(fn),
    removeEventListener: (_type: string, fn: (event: MessageEvent) => void) => void listeners.delete(fn),
  };
  const deliver = (data: object, { source = win as unknown, origin = ORIGIN } = {}) =>
    listeners.forEach((fn) => fn({ data, source, origin } as MessageEvent));
  return { win: win as unknown as BridgeWindow, posted, deliver, listeners };
};

const draft = (extra: object = {}) => ({ channel: CAPTURE_CHANNEL, v: 1, from: "bridge", type: "CAPTURE_DRAFT", requestId: ID, source: { selectedText: "x" }, ...extra });

test("reads only a well-formed request id from the hash", () => {
  assert.equal(readCaptureRequestId(`#request=${ID}`), ID);
  assert.equal(readCaptureRequestId("#request=../x"), null);
  assert.equal(readCaptureRequestId(""), null);
});

test("resolves with the draft and ignores forged or stray messages", async () => {
  const { win, deliver, posted, listeners } = fakeWindow();
  const result = requestCaptureSource(ID, { win, timeoutMs: 1_000, intervalMs: 10 });
  deliver(draft({ source: "forged" }), { source: {} });
  deliver(draft({ source: "forged" }), { origin: "https://evil.example" });
  deliver(draft({ source: "forged", requestId: "other" }));
  deliver(draft({ source: "forged", v: 2 }));
  deliver(draft({ source: "forged", from: "app" }));
  deliver(draft());
  assert.deepEqual(await result, { ok: true, source: { selectedText: "x" } });
  assert.equal(posted[0].targetOrigin, ORIGIN);
  assert.deepEqual(posted[0].data, { channel: CAPTURE_CHANNEL, v: 1, from: "app", type: "CAPTURE_READY", requestId: ID });
  assert.equal(listeners.size, 0);
});

test("keeps asking while the popup tab is not bound yet", async () => {
  const { win, deliver, posted } = fakeWindow();
  const result = requestCaptureSource(ID, { win, timeoutMs: 1_000, intervalMs: 5 });
  deliver(draft({ type: "CAPTURE_UNAVAILABLE", reason: "wrong-tab", source: undefined }));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(posted.length > 1);
  deliver(draft());
  assert.equal((await result).ok, true);
});

test("final unavailable reason is reported", async () => {
  const { win, deliver } = fakeWindow();
  const result = requestCaptureSource(ID, { win, timeoutMs: 1_000, intervalMs: 5 });
  deliver(draft({ type: "CAPTURE_UNAVAILABLE", reason: "missing", source: undefined }));
  assert.deepEqual(await result, { ok: false, reason: "missing" });
});

test("no bridge times out as no-extension", async () => {
  const { win } = fakeWindow();
  assert.deepEqual(await requestCaptureSource(ID, { win, timeoutMs: 20, intervalMs: 5 }), { ok: false, reason: "no-extension" });
});

test("notify posts to the exact origin", () => {
  const { win, posted } = fakeWindow();
  notifyCapture(ID, "CAPTURE_SAVED", win);
  assert.deepEqual(posted, [{ data: { channel: CAPTURE_CHANNEL, v: 1, from: "app", type: "CAPTURE_SAVED", requestId: ID }, targetOrigin: ORIGIN }]);
});
