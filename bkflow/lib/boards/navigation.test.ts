import assert from "node:assert/strict";
import { test } from "node:test";
import { getBoardNavigation } from "./navigation";

test("rows and columns share one task navigation entry", () => {
  for (const pathname of ["/board/b1", "/board/b1/list", "/board/b1/todo"]) {
    const items = getBoardNavigation("b1", pathname);
    assert.deepEqual(items.map(item => item.label), ["Việc cần làm", "Lịch", "Sơ đồ", "Thống kê"]);
    assert.deepEqual(items.filter(item => item.active).map(item => item.id), ["tasks"]);
  }
});

test("diagram and statistics keep their own active state and use the current board", () => {
  for (const view of ["graph", "analytics", "calendar"]) {
    const items = getBoardNavigation("older-board", `/board/older-board/${view}`);
    assert.deepEqual(items.filter(item => item.active).map(item => item.id), [view]);
    assert.ok(items.every(item => item.href.startsWith("/board/older-board")));
  }
  assert.ok(getBoardNavigation("b1", "/board/b10/list").every(item => !item.active));
});
