import assert from "node:assert/strict";
import { test } from "node:test";
import { createDescriptionSaveState, descriptionSaveReducer as reduce } from "./description-save-state";

const start = () => createDescriptionSaveState("Gốc", "2026-10-18T00:00:00.000Z");

test("keeps edits typed while an earlier snapshot is saving", () => {
  let s = reduce(start(), { type: "edit", value: "Bản sửa" });
  s = reduce(s, { type: "saveStart" });
  const seq = s.saveSeq;
  s = reduce(s, { type: "edit", value: "Bản sửa mới" });
  assert.equal(s.status, "saving");
  s = reduce(s, { type: "saveSuccess", seq, snapshot: "Bản sửa", updatedAt: "t1" });
  assert.equal(s.draft, "Bản sửa mới");
  assert.equal(s.base, "Bản sửa");
  assert.equal(s.baseUpdatedAt, "t1");
  assert.equal(s.status, "dirty");
});

test("shows saved only when the response matches the current draft", () => {
  let s = reduce(start(), { type: "edit", value: "A" });
  s = reduce(s, { type: "saveStart" });
  s = reduce(s, { type: "saveSuccess", seq: s.saveSeq, snapshot: "A", updatedAt: "t1" });
  assert.equal(s.status, "saved");
  assert.equal(s.savingSnapshot, null);
});

test("ignores a response from an older request", () => {
  let s = reduce(start(), { type: "edit", value: "A" });
  s = reduce(s, { type: "saveStart" });
  const stale = s.saveSeq - 1;
  const after = reduce(s, { type: "saveSuccess", seq: stale, snapshot: "A", updatedAt: "old" });
  assert.deepEqual(after, s);
  assert.deepEqual(reduce(s, { type: "saveFailure", seq: stale, conflict: false }), s);
});

test("failure and conflict keep the draft", () => {
  let s = reduce(start(), { type: "edit", value: "A" });
  s = reduce(s, { type: "saveStart" });
  const failed = reduce(s, { type: "saveFailure", seq: s.saveSeq, conflict: false });
  assert.deepEqual([failed.draft, failed.status, failed.savingSnapshot], ["A", "error", null]);
  const conflict = reduce(s, { type: "saveFailure", seq: s.saveSeq, conflict: true });
  assert.deepEqual([conflict.draft, conflict.status], ["A", "conflict"]);
  assert.equal(reduce(conflict, { type: "edit", value: "AB" }).status, "conflict");
  assert.equal(reduce(failed, { type: "edit", value: "AB" }).status, "dirty");
});

test("server data replaces only a clean draft", () => {
  const clean = reduce(start(), { type: "external", value: "Từ server", updatedAt: "t2" });
  assert.deepEqual([clean.draft, clean.base, clean.baseUpdatedAt], ["Từ server", "Từ server", "t2"]);
  const dirty = reduce(reduce(start(), { type: "edit", value: "Nháp" }), { type: "external", value: "Từ server", updatedAt: "t2" });
  assert.equal(dirty.draft, "Nháp");
  assert.equal(dirty.status, "dirty");
});

test("discard restores the saved text; editing back to base is saved", () => {
  const edited = reduce(start(), { type: "edit", value: "X" });
  assert.equal(reduce(edited, { type: "discard" }).draft, "Gốc");
  assert.equal(reduce(edited, { type: "edit", value: "Gốc" }).status, "saved");
});

test("legacy Markdown, JSON-like and HTML text stay verbatim", () => {
  for (const text of ['{"type":"doc","content":[]}', "<script>x</script>\n- [ ] việc", "# Tiêu đề\n\n- a"]) {
    const s = createDescriptionSaveState(text, null);
    assert.equal(s.draft, text);
    assert.equal(s.status, "saved");
  }
  assert.equal(createDescriptionSaveState(null, null).draft, "");
});
