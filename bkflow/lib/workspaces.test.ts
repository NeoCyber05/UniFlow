import assert from "node:assert/strict";
import { test } from "node:test";

import { WorkspaceIconInput, parseWorkspaceIcon, pickCurrentWorkspace } from "./workspaces";

test("pickCurrentWorkspace prefers isCurrent, then lowest order, else null", () => {
  assert.equal(pickCurrentWorkspace([{ id: "a", isCurrent: false, order: 0 }, { id: "b", isCurrent: true, order: 1 }])?.id, "b");
  assert.equal(pickCurrentWorkspace([{ id: "a", isCurrent: false, order: 2 }, { id: "b", isCurrent: false, order: 1 }])?.id, "b");
  assert.equal(pickCurrentWorkspace([]), null);
});

test("parseWorkspaceIcon reads emoji and whitelisted lucide names", () => {
  assert.equal(parseWorkspaceIcon(null), null);
  assert.deepEqual(parseWorkspaceIcon("📘"), { kind: "emoji", value: "📘" });
  assert.deepEqual(parseWorkspaceIcon("lucide:BookOpen"), { kind: "lucide", name: "BookOpen" });
  assert.equal(parseWorkspaceIcon("lucide:NotAnIcon"), null);
});

test("WorkspaceIconInput accepts null, short emoji, known lucide; rejects the rest", () => {
  assert.ok(WorkspaceIconInput.safeParse(null).success);
  assert.ok(WorkspaceIconInput.safeParse("📘").success);
  assert.ok(WorkspaceIconInput.safeParse("lucide:Rocket").success);
  assert.ok(!WorkspaceIconInput.safeParse("lucide:NotAnIcon").success);
  assert.ok(!WorkspaceIconInput.safeParse("x".repeat(17)).success);
  assert.ok(!WorkspaceIconInput.safeParse("").success);
});
