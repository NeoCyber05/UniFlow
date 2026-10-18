import assert from "node:assert/strict";
import { test } from "node:test";
import { getSlashContext, filterSlashCommands, insertSlashCommand, applySelectionResult, openSlashAtCursor } from "./description-editor";
import { GenerateAiSelection } from "../ai/selection-contract";

test("slash opens only at a line start, outside code and selected text", () => {
  assert.deepEqual(getSlashContext("Nội dung\n  /tieu", 16, 16), { start: 11, end: 16, query: "tieu" });
  for (const value of ["https://", "Nội dung /", "```\n/", "~~~md\n/"]) {
    assert.equal(getSlashContext(value, value.length, value.length), null);
  }
  assert.equal(getSlashContext("/", 0, 1), null);
  const closedFence = "```\ntext\n```\n/";
  assert.notEqual(getSlashContext(closedFence, closedFence.length, closedFence.length), null);
});

test("Vietnamese slash search supports accents and aliases", () => {
  assert.equal(filterSlashCommands("tieu de")[0].id, "h1");
  assert.equal(filterSlashCommands("checklist")[0].id, "checklist");
  assert.equal(filterSlashCommands("khong co lenh").length, 0);
});

test("inserting a command keeps indentation and surrounding text", () => {
  const value = "Trước\n  /h1nội dung\nSau";
  assert.equal(insertSlashCommand(value, { start: 8, end: 11, query: "h1" }, "# ").value, "Trước\n  # nội dung\nSau");
});

test("AI only replaces its selection and explains below it", () => {
  assert.equal(applySelectionResult("A đoạn B", "A đoạn B", 2, 6, "mới", "shorten"), "A mới B");
  assert.equal(applySelectionResult("A đoạn B", "A đoạn B", 2, 6, "giải thích", "explain"), "A đoạn\n\ngiải thích\n\n B");
  assert.equal(applySelectionResult("old\nnext", "old\nnext", 0, 4, "new", "improve"), "new\nnext");
  assert.equal(applySelectionResult("  old\nnext", "  old\nnext", 0, 6, "new", "shorten"), "  new\nnext");
  assert.equal(applySelectionResult("đã sửa", "A đoạn B", 2, 6, "mới", "shorten"), null);
  assert.equal(applySelectionResult("abc", "abc", -1, 2, "mới", "improve"), null);
  assert.equal(applySelectionResult("abc", "abc", 0, 4, "mới", "improve"), null);
  assert.equal(applySelectionResult("abc", "abc", 1, 1, "mới", "improve"), null);
});

test("selection AI validates task, nonempty text and length at the boundary", () => {
  const input = { boardId: "board", cardId: "card", task: "shorten", text: "đoạn chọn" };
  assert.equal(GenerateAiSelection.safeParse(input).success, true);
  assert.equal(GenerateAiSelection.safeParse({ pageId: "page", task: "explain", text: "đoạn chọn" }).success, true);
  assert.equal(GenerateAiSelection.safeParse({ task: "explain", text: "đoạn chọn" }).success, false);
  for (const patch of [{ text: "  " }, { text: "a".repeat(8001) }, { task: "delete" }, { boardId: "" }]) {
    assert.equal(GenerateAiSelection.safeParse({ ...input, ...patch }).success, false);
  }
});

test("Thêm nội dung opens the shared command list on its own line", () => {
  assert.deepEqual(openSlashAtCursor("", 0), { value: "/", caret: 1 });
  assert.deepEqual(openSlashAtCursor("Đoạn", 4), { value: "Đoạn\n/", caret: 6 });
  assert.deepEqual(openSlashAtCursor("a\n", 2), { value: "a\n/", caret: 3 });
  const opened = openSlashAtCursor("Đoạn", 4);
  assert.equal(getSlashContext(opened.value, opened.caret, opened.caret)?.query, "");
});
