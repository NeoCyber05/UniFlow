import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PAGE_STYLE, PageStyleSchema, pageStyleCss, readPageStyle } from "./page-style";
import { SaveNotePage } from "./contract";

test("page styles have safe defaults and reject arbitrary CSS or external URLs", () => {
  assert.deepEqual(readPageStyle(null), DEFAULT_PAGE_STYLE);
  assert.deepEqual(readPageStyle({ fontSize: 1000 }), DEFAULT_PAGE_STYLE);
  for (const patch of [{ paperColor: "url(https://evil.test)" }, { background: "https://evil.test" }, { textColor: "red;display:none" }]) {
    assert.equal(PageStyleSchema.safeParse({ ...DEFAULT_PAGE_STYLE, ...patch }).success, false);
  }
});

test("custom solid color overrides a pattern and typography stays within presets", () => {
  const css = pageStyleCss({ ...DEFAULT_PAGE_STYLE, background: "grid", paperColor: "#123456", fontSize: 20, width: "compact" });
  assert.equal(css.backgroundImage, "none");
  assert.equal(css.backgroundColor, "#123456");
  assert.equal(css.fontSize, "20px");
  assert.equal(css.maxWidth, "640px");
});

test("default page style follows the app theme instead of forcing white paper", () => {
  const css = pageStyleCss(DEFAULT_PAGE_STYLE);
  assert.equal(css.backgroundColor, undefined);
  assert.equal(css.color, undefined);
  assert.equal(pageStyleCss({ ...DEFAULT_PAGE_STYLE, paperColor: "#fef3c7" }).color, "#1f2937");
});

test("saving notes requires a version and bounds title and content", () => {
  const note = { title: "Ghi chú", content: "Nội dung", style: null, expectedUpdatedAt: "2026-10-17T00:00:00.000Z" };
  assert.equal(SaveNotePage.safeParse(note).success, true);
  for (const patch of [{ title: " " }, { content: "a".repeat(100001) }, { expectedUpdatedAt: "" }]) {
    assert.equal(SaveNotePage.safeParse({ ...note, ...patch }).success, false);
  }
});
