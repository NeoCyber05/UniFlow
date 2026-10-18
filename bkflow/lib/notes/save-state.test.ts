import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldResaveNote } from "./save-state";

test("autosave retries only edits that arrived during a successful save", () => {
  assert.equal(shouldResaveNote("sent", "sent", "new draft"), true);
  assert.equal(shouldResaveNote("sent", "previous version", "new draft"), false);
  assert.equal(shouldResaveNote("sent", "previous version", "sent"), false);
  assert.equal(shouldResaveNote("sent", "sent", "sent"), false);
});
