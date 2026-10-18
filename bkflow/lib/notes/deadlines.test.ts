import assert from "node:assert/strict";
import test from "node:test";

import { serializeNoteBlocks } from "./blocks";
import { extractNoteDeadlines } from "./deadlines";

test("extractNoteDeadlines keeps dated deadline blocks only", () => {
  const content = serializeNoteBlocks([
    { id: "p", type: "paragraph", text: "hi" },
    { id: "d1", type: "deadline", text: " Nộp báo cáo ", dueAt: "2026-11-01T10:00:00.000Z", reminder: "60", checked: false },
    { id: "d2", type: "deadline", text: "", dueAt: "", reminder: "none", checked: false },
    { id: "d3", type: "deadline", text: "", dueAt: "not a date", reminder: "none", checked: true },
  ]);
  const result = extractNoteDeadlines(content);
  assert.equal(result.length, 1);
  assert.deepEqual({ ...result[0], dueAt: result[0].dueAt.toISOString() }, { blockId: "d1", title: "Nộp báo cáo", dueAt: "2026-11-01T10:00:00.000Z", reminder: "60", done: false });
});

test("extractNoteDeadlines tolerates non-block content", () => {
  assert.deepEqual(extractNoteDeadlines("plain text"), []);
});
