import assert from "node:assert/strict";
import { test } from "node:test";

import { canUndoAiNoteEdit } from "./ai-undo";

test("allows undo only while the page still has the revision written by AI", () => {
  const applied = new Date("2026-10-17T10:00:00.000Z");
  assert.equal(canUndoAiNoteEdit({ undoneAt: null, appliedUpdatedAt: applied, pageUpdatedAt: applied }), "ready");
  assert.equal(canUndoAiNoteEdit({ undoneAt: new Date(), appliedUpdatedAt: applied, pageUpdatedAt: applied }), "already-undone");
  assert.equal(canUndoAiNoteEdit({ undoneAt: null, appliedUpdatedAt: applied, pageUpdatedAt: new Date("2026-10-17T10:01:00.000Z") }), "conflict");
});
