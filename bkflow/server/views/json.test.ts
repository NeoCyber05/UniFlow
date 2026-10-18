import assert from "node:assert/strict";
import { test } from "node:test";

import superjson from "superjson";

import { json } from "./json";

test("json() serialises with superjson so Dates survive", async () => {
  const date = new Date("2026-01-02T03:04:05.000Z");
  const res = json({ date, redirect: "/x" });
  assert.equal(res.headers.get("content-type"), "application/json");
  const parsed = superjson.parse<{ date: Date; redirect: string }>(await res.text());
  assert.ok(parsed.date instanceof Date);
  assert.equal(parsed.date.getTime(), date.getTime());
  assert.equal(parsed.redirect, "/x");
});
