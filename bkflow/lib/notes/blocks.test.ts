import assert from "node:assert/strict";
import { test } from "node:test";

import { haveSameNoteContent, parseNoteBlocks, serializeNoteBlocks } from "./blocks";

test("parses valid blocks and keeps task references as IDs", () => {
  const blocks = [
    { id: "p1", type: "paragraph", text: "Ôn IT3011" },
    { id: "t1", type: "task", taskId: "task-1" },
  ] as const;

  assert.deepEqual(parseNoteBlocks(serializeNoteBlocks(blocks)), blocks);
});

test("shows malformed or unsupported stored content as editable text", () => {
  assert.deepEqual(parseNoteBlocks("not-json"), [{ id: "fallback", type: "paragraph", text: "not-json" }]);
  assert.deepEqual(parseNoteBlocks('{"version":9,"blocks":[]}'), [{ id: "fallback", type: "paragraph", text: '{"version":9,"blocks":[]}' }]);
});

test("empty pages start with an editable paragraph and reject oversized documents", () => {
  assert.deepEqual(parseNoteBlocks(""), [{ id: "empty", type: "paragraph", text: "" }]);
  assert.throws(() => serializeNoteBlocks([{ id: "x", type: "paragraph", text: "a".repeat(10001) }]));
  assert.throws(() => serializeNoteBlocks([{ id: "same", type: "paragraph", text: "a" }, { id: "same", type: "todo", text: "b", checked: false }]));
});

test("recognizes AI output that only regenerated block IDs as a no-op", () => {
  assert.equal(haveSameNoteContent([{ id: "old", type: "paragraph", text: "Ghi chú" }], [{ id: "new", type: "paragraph", text: "Ghi chú" }]), true);
  assert.equal(haveSameNoteContent([{ id: "old", type: "paragraph", text: "Ghi chú" }], [{ id: "new", type: "heading", level: 2, text: "Ghi chú" }]), false);
});
