import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { DEFAULT_GLASS_TRANSPARENCY, MAX_GLASS_TRANSPARENCY, getGlassTransparency, setGlassTransparency } from "./local-prefs";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("glass defaults to the approved appearance and survives reloads", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } } });
  assert.equal(DEFAULT_GLASS_TRANSPARENCY, 56);
  assert.equal(getGlassTransparency(), 56);
  assert.equal(setGlassTransparency(30), 30);
  assert.equal(getGlassTransparency(), 30);
  setGlassTransparency(56);
  assert.equal(getGlassTransparency(), 56);
});

test("glass preference validates malformed storage and keeps values in the readable range", () => {
  let stored: string | null = "broken";
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; },
  } } });
  for (const value of [null, "", " ", "broken", "NaN", "Infinity"]) {
    stored = value;
    assert.equal(getGlassTransparency(), 56);
  }
  assert.equal(setGlassTransparency(-10), 0);
  assert.equal(getGlassTransparency(), 0);
  assert.equal(setGlassTransparency(999), MAX_GLASS_TRANSPARENCY);
  assert.equal(getGlassTransparency(), MAX_GLASS_TRANSPARENCY);
  assert.equal(setGlassTransparency(35.4), 35);
  assert.equal(setGlassTransparency(NaN), 56);
});

test("blocked storage still allows the slider to apply a valid session value", () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); },
  } } });
  assert.equal(getGlassTransparency(), 56);
  assert.equal(setGlassTransparency(40), 40);
});
