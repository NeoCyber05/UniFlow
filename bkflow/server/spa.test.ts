import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { Hono } from "hono";

import { mountSpa } from "./spa";

// serveStatic needs a cwd-relative root, so the fixture lives inside the project.
const dist = "server/.tmp-spa-dist";
const app = new Hono();

before(() => {
  fs.mkdirSync(`${dist}/assets`, { recursive: true });
  fs.writeFileSync(`${dist}/index.html`, "<html>spa-shell</html>");
  fs.writeFileSync(`${dist}/assets/app.js`, "console.log(1)");
  fs.writeFileSync(`${dist}/sw.js`, "self.addEventListener('push',()=>{})");
  app.get("/api/ping", (c) => c.text("pong"));
  mountSpa(app, dist);
});
after(() => fs.rmSync(dist, { recursive: true, force: true }));

test("serves built assets", async () => {
  const res = await app.request("/assets/app.js");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "console.log(1)");
});

test("falls back to index.html for client routes", async () => {
  for (const p of ["/", "/board/abc"]) {
    const res = await app.request(p);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "<html>spa-shell</html>");
  }
});

test("keeps api routes and 404s unknown api paths without html", async () => {
  assert.equal(await (await app.request("/api/ping")).text(), "pong");
  const res = await app.request("/api/unknown");
  assert.equal(res.status, 404);
  assert.ok(!(await res.text()).includes("spa-shell"));
});

test("serves the service worker as javascript, not the SPA shell", async () => {
  const res = await app.request("/sw.js");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /javascript/);
  assert.ok(!(await res.text()).includes("spa-shell"));
});
