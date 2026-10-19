import assert from "node:assert/strict";
import { test } from "node:test";

import { checkAiBlockEdit, haveSameNoteContent, isUnsupportedNoteDocument, parseNoteBlocks, serializeNoteBlocks } from "./blocks";
import { SaveNotePage } from "./contract";

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

test("unknown document preserved until explicit replacement", () => {
  // A JSON document we cannot read opens in preservation mode; legacy plain text stays editable.
  assert.equal(isUnsupportedNoteDocument('{"version":9,"blocks":[]}'), true);
  assert.equal(isUnsupportedNoteDocument('{"version":1,"blocks":[{"id":"a","type":"table"}]}'), true);
  assert.equal(isUnsupportedNoteDocument("Ghi chú cũ dạng văn bản"), false);
  assert.equal(isUnsupportedNoteDocument(""), false);
  assert.equal(isUnsupportedNoteDocument("42"), false);
  assert.equal(isUnsupportedNoteDocument(serializeNoteBlocks([{ id: "a", type: "paragraph", text: "x" }])), false);
});

test("save validates structured blocks", () => {
  const note = { title: "Trang", style: null, expectedUpdatedAt: "2026-10-17T00:00:00.000Z" };
  assert.equal(SaveNotePage.safeParse({ ...note, content: serializeNoteBlocks([{ id: "t", type: "task", taskId: "c1" }]) }).success, true);
  for (const content of ["văn bản thuần", "", '{"version":9,"blocks":[]}', '{"version":1,"blocks":[{"id":"a","type":"table"}]}', JSON.stringify({ version: 1, blocks: [{ id: "a", type: "paragraph", text: "a" }, { id: "a", type: "paragraph", text: "b" }] })]) {
    assert.equal(SaveNotePage.safeParse({ ...note, content }).success, false, content);
  }
});

test("AI rewrite of a short page is a normal edit; of most of a long page needs confirmation", () => {
  const short = parseNoteBlocks("Ghi chú cũ");
  assert.deepEqual(checkAiBlockEdit(short, [{ id: "a", type: "heading", level: 2, text: "Mục tiêu" }, { id: "b", type: "paragraph", text: "Ghi chú cũ" }]), { ok: true, noop: false, large: false });
  const long = ["a", "b", "c", "d"].map(id => ({ id, type: "paragraph" as const, text: id }));
  assert.equal((checkAiBlockEdit(long, long.map((block, index) => index < 2 ? { ...block, text: "x" } : block)) as { large: boolean }).large, false, "exactly half");
  assert.equal((checkAiBlockEdit(long, long.slice(1).map(block => ({ ...block, text: "x" }))) as { large: boolean }).large, true);
});
