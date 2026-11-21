import assert from "node:assert/strict";
import test from "node:test";

import { splitCaptureKeywords } from "./text-keywords";

test("highlights the course and full deadline in Vietnamese capture text", () => {
  assert.deepEqual(splitCaptureKeywords("Nộp bài tập DSA trước 9h tối nay"), [
    { text: "Nộp bài tập " },
    { text: "DSA", kind: "course" },
    { text: " trước " },
    { text: "9h tối nay", kind: "due" },
  ]);
});

test("uses configured course names and preserves punctuation and spacing", () => {
  assert.deepEqual(splitCaptureKeywords("Ôn (Toán 2),  @mai", [
    { id: "math", code: "MA2", name: "Toán 2" },
  ]), [
    { text: "Ôn (" },
    { text: "Toán 2", kind: "course" },
    { text: "),  " },
    { text: "@mai", kind: "due" },
  ]);
});

test("skips partial keyword matches and an invalid clock time", () => {
  assert.deepEqual(splitCaptureKeywords("DSA123 29h"), [{ text: "DSA123 29h" }]);
});
