import { test } from "node:test";
import assert from "node:assert/strict";

import { auth, runWithAuth } from "./clerk";

test("auth() returns the auth bound to the current request", async () => {
  const result = await runWithAuth(
    { userId: "user_1", orgId: "org_1", sessionClaims: null },
    () => auth(),
  );
  assert.equal(result.userId, "user_1");
  assert.equal(result.orgId, "org_1");
});

test("auth() outside a request is signed out", async () => {
  const result = await auth();
  assert.equal(result.userId, null);
  assert.equal(result.orgId, null);
});
