import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GRID_COLS,
  MIN_GRID_COL_WEIGHT,
  getGridStyle,
  parseGridSize,
  resizeGridColumns,
} from "./calendar-grid-size";

test("resizeGridColumns moves only the two neighbours and clamps", () => {
  const next = resizeGridColumns(DEFAULT_GRID_COLS, 3, 0.5);
  assert.deepEqual(next, [1, 1, 1.5, 0.5, 1, 1, 1]);

  const clamped = resizeGridColumns(DEFAULT_GRID_COLS, 1, 5);
  assert.ok(Math.abs(clamped[1] - MIN_GRID_COL_WEIGHT) < 1e-9);
  assert.equal(clamped[0] + clamped[1], 2);
});

test("parseGridSize falls back on bad data", () => {
  assert.deepEqual(parseGridSize(null), { cols: DEFAULT_GRID_COLS, rows: {} });
  assert.deepEqual(parseGridSize("{oops"), { cols: DEFAULT_GRID_COLS, rows: {} });
  assert.deepEqual(parseGridSize(JSON.stringify({ cols: [1, 2], rows: { 0: 10, 1: "x" } })), {
    cols: DEFAULT_GRID_COLS,
    rows: { 0: 80 },
  });
});

test("getGridStyle edges are cumulative percentages", () => {
  const style = getGridStyle([2, 1, 1, 1, 1, 1, 0.999999]) as Record<string, string>;
  assert.equal(style["--cal-x0"], "0%");
  assert.ok(style["--cal-x1"].startsWith("25"));
  assert.ok(Math.abs(parseFloat(style["--cal-x7"]) - 100) < 1e-9);
});
