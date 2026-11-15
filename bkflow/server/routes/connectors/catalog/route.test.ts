import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { runWithAuth } from "@/server/auth";
import { GET } from "./route";

afterEach(() => mock.restoreAll());

test("catalog yêu cầu đăng nhập", async () => {
  assert.equal((await GET()).status, 401);
});

test("catalog trả metadata, không có trạng thái kết nối/token", async () => {
  delete process.env.COMPOSIO_API_KEY;
  const response = await runWithAuth({ userId: "u1", user: null }, () => GET());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, "fallback");
  assert.ok(Array.isArray(body.items) && body.items.length > 0);
  const text = JSON.stringify(body);
  for (const key of ["connected", "account", "token", "apps"]) assert.equal(text.includes(`"${key}`), false, key);
});
