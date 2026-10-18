import assert from "node:assert/strict";
import test from "node:test";

import { commandAfterEnter, convertBlock, matchMarkdownShortcut, numberedIndex, shouldExitListOnEnter } from "./block-editing";
import type { NoteBlock } from "./blocks";

test("markdown shortcuts map prefixes to block types", () => {
  assert.deepEqual(matchMarkdownShortcut("# Hello"), { command: "h1", rest: "Hello" });
  assert.deepEqual(matchMarkdownShortcut("### "), { command: "h3", rest: "" });
  assert.deepEqual(matchMarkdownShortcut("- item"), { command: "bullet", rest: "item" });
  assert.deepEqual(matchMarkdownShortcut("1. a"), { command: "numbered", rest: "a" });
  assert.deepEqual(matchMarkdownShortcut("[] x"), { command: "todo", rest: "x" });
  assert.deepEqual(matchMarkdownShortcut("> q"), { command: "quote", rest: "q" });
  assert.deepEqual(matchMarkdownShortcut("---"), { command: "divider", rest: "" });
  assert.equal(matchMarkdownShortcut("#hashtag"), null);
  assert.equal(matchMarkdownShortcut("plain"), null);
});

test("convertBlock keeps id and text", () => {
  const converted = convertBlock({ id: "a", type: "paragraph", text: "hi" }, "h2");
  assert.deepEqual(converted, { id: "a", type: "heading", level: 2, text: "hi" });
  assert.deepEqual(convertBlock({ id: "b", type: "todo", checked: true, text: "x" }, "paragraph"), { id: "b", type: "paragraph", text: "x" });
});

test("enter continues lists and exits them when empty", () => {
  assert.equal(commandAfterEnter({ id: "a", type: "bullet", text: "x" }), "bullet");
  assert.equal(commandAfterEnter({ id: "a", type: "heading", level: 1, text: "x" }), "paragraph");
  assert.equal(shouldExitListOnEnter({ id: "a", type: "todo", checked: false, text: "" }), true);
  assert.equal(shouldExitListOnEnter({ id: "a", type: "paragraph", text: "" }), false);
});

test("numberedIndex restarts after a non-numbered block", () => {
  const blocks: NoteBlock[] = [
    { id: "1", type: "numbered", text: "" }, { id: "2", type: "numbered", text: "" },
    { id: "3", type: "paragraph", text: "" }, { id: "4", type: "numbered", text: "" },
  ];
  assert.deepEqual([0, 1, 3].map(index => numberedIndex(blocks, index)), [1, 2, 1]);
});
