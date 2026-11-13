import assert from "node:assert/strict";
import { test } from "node:test";

import { loadWorkspace } from "./workspace";

test("old workspace links open the personal task list without switching workspaces", async () => {
  assert.deepEqual(await loadWorkspace({ workspaceId: "old-mock-workspace" }, "u1"), { redirect: "/my/today" });
});

test("old workspace links still require sign-in", async () => {
  assert.deepEqual(await loadWorkspace({ workspaceId: "old-mock-workspace" }, null), { redirect: "/sign-in" });
});
