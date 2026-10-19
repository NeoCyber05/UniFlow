import assert from "node:assert/strict";
import test from "node:test";
import { useAssistantTask } from "@/hooks/use-assistant-task";

test("assistant follows the task actually displayed by a guarded detail panel", () => {
  const store = useAssistantTask.getState();
  store.show({ id: "old", title: "Shown", boardId: "b", updatedAt: "2026-10-19T00:00:00Z" });
  assert.equal(useAssistantTask.getState().task?.id, "old");
  store.show({ id: "new", title: "Next", boardId: "b", updatedAt: "2026-10-20T00:00:00Z" });
  store.clear("old");
  assert.equal(useAssistantTask.getState().task?.id, "new");
  store.clear("new"); assert.equal(useAssistantTask.getState().task, null);
});

