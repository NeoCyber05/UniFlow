import assert from "node:assert/strict";
import { test } from "node:test";
import { buildNoteSave, shouldResaveNote } from "./save-state";

test("autosave retries only edits that arrived during a successful save", () => {
  assert.equal(shouldResaveNote("sent", "sent", "new draft"), true);
  assert.equal(shouldResaveNote("sent", "previous version", "new draft"), false);
  assert.equal(shouldResaveNote("sent", "previous version", "sent"), false);
  assert.equal(shouldResaveNote("sent", "sent", "sent"), false);
});

test("preserved pages never autosave a fallback over the original", () => {
  const draft = { title: "Trang", blocks: [{ id: "fallback", type: "paragraph" as const, text: '{"version":9}' }], style: null };
  assert.equal(buildNoteSave(draft, "2026-10-17T00:00:00.000Z", true), null);
  const body = buildNoteSave({ ...draft, blocks: [{ id: "a", type: "paragraph", text: "" }] }, "2026-10-17T00:00:00.000Z", false);
  assert.deepEqual(body && JSON.parse(body.content), { version: 1, blocks: [{ id: "a", type: "paragraph", text: "" }] });
  assert.equal(body?.expectedUpdatedAt, "2026-10-17T00:00:00.000Z");
});
