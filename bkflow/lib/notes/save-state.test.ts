import assert from "node:assert/strict";
import { test } from "node:test";
import { buildNoteSave, saveBeforeNoteNavigation, shouldResaveNote } from "./save-state";

test("autosave retries only edits that arrived during a successful save", () => {
  assert.equal(shouldResaveNote("sent", "sent", "new draft"), true);
  assert.equal(shouldResaveNote("sent", "previous version", "new draft"), false);
  assert.equal(shouldResaveNote("sent", "previous version", "sent"), false);
  assert.equal(shouldResaveNote("sent", "sent", "sent"), false);
});

test("navigation waits for a running autosave and saves the newest draft", async () => {
  let finishRequest!: () => void;
  const request = new Promise<void>(resolve => { finishRequest = resolve; });
  let saved = "original";
  let draft = "first edit";
  const inFlight = request.then(() => { saved = "first edit"; return true; });
  let saving = true;
  const navigation = saveBeforeNoteNavigation(async () => {
    if (saving) {
      const success = await inFlight;
      saving = false;
      return success;
    }
    saved = draft;
    return true;
  }, () => saving || draft !== saved);

  draft = "second edit";
  assert.equal(saved, "original");
  finishRequest();
  assert.equal(await navigation, true);
  assert.equal(saved, "second edit");
});

test("navigation remains blocked when the latest edit fails to save", async () => {
  let saved = "original";
  const draft = "latest edit";
  let attempts = 0;
  const success = await saveBeforeNoteNavigation(async () => {
    if (attempts++ > 0) return false;
    saved = "first edit";
    return true;
  }, () => draft !== saved);

  assert.equal(success, false);
  assert.equal(saved, "first edit");
  assert.equal(attempts, 2);
});

test("preserved pages never autosave a fallback over the original", () => {
  const draft = { title: "Trang", blocks: [{ id: "fallback", type: "paragraph" as const, text: '{"version":9}' }], style: null };
  assert.equal(buildNoteSave(draft, "2026-10-17T00:00:00.000Z", true), null);
  const body = buildNoteSave({ ...draft, blocks: [{ id: "a", type: "paragraph", text: "" }] }, "2026-10-17T00:00:00.000Z", false);
  assert.deepEqual(body && JSON.parse(body.content), { version: 1, blocks: [{ id: "a", type: "paragraph", text: "" }] });
  assert.equal(body?.expectedUpdatedAt, "2026-10-17T00:00:00.000Z");
});
