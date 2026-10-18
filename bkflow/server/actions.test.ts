import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import superjson from "superjson";

import { createActionsRoute } from "./actions";

const app = new Hono().route(
  "/api/actions",
  createActionsRoute({
    "demo/echo": async (input) => ({ data: { got: input, at: new Date("2026-01-01T00:00:00Z") } }),
    "demo/invalid": async () => ({ fieldErrors: { title: ["Required"] } }),
    "demo/boom": async () => {
      throw new Error("boom");
    },
  }),
);

const post = (path: string, body: string) => app.request(path, { method: "POST", body });

test("runs a registered action and keeps Date types", async () => {
  const res = await post("/api/actions/demo/echo", superjson.stringify({ id: "b1" }));
  assert.equal(res.status, 200);
  const body = superjson.parse<{ data: { got: { id: string }; at: Date } }>(await res.text());
  assert.deepEqual(body.data.got, { id: "b1" });
  assert.ok(body.data.at instanceof Date);
});

test("validation error results pass through unchanged", async () => {
  const res = await post("/api/actions/demo/invalid", superjson.stringify({}));
  assert.equal(res.status, 200);
  assert.deepEqual(superjson.parse(await res.text()), { fieldErrors: { title: ["Required"] } });
});

test("unknown action is 404", async () => {
  assert.equal((await post("/api/actions/demo/missing", "{}")).status, 404);
});

test("malformed body is 400, thrown action is 500", async () => {
  assert.equal((await post("/api/actions/demo/echo", "not json")).status, 400);
  assert.equal((await post("/api/actions/demo/boom", superjson.stringify({}))).status, 500);
});
