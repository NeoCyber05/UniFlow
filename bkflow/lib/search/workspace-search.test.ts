import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecentItems, rememberSearchItem, getNavigationItems, workspaceBoardScope, type SearchReference } from "./workspace-search";

test("recent items accept only bounded typed resource IDs, never stored URLs or labels", () => {
  assert.deepEqual(parseRecentItems('[{"type":"card","id":"a","title":"secret","href":"https://evil.test"}]'), [{ type: "card", id: "a" }]);
  for (const input of ["invalid", "null", '[{"type":"admin","id":"a"}]', '[{"type":"card","id":""}]']) {
    assert.deepEqual(parseRecentItems(input), []);
  }
  assert.deepEqual(parseRecentItems("x".repeat(3001)), []);
  assert.deepEqual(parseRecentItems('[{"type":"card","id":"a"},{"type":"card","id":"a"}]'), [{ type: "card", id: "a" }]);
});

test("recent items are deduplicated, newest first, and limited to eight", () => {
  let items: SearchReference[] = [{ type: "card", id: "old" }];
  for (let i = 0; i < 10; i++) items = rememberSearchItem(items, { type: "card", id: String(i) });
  items = rememberSearchItem(items, { type: "card", id: "7" });
  assert.equal(items.length, 8);
  assert.deepEqual(items.slice(0, 2).map(item => item.id), ["7", "9"]);
});

test("navigation matches Vietnamese with or without accents", () => {
  assert.equal(getNavigationItems("lich")[0].href, "/my/calendar");
  assert.equal(getNavigationItems("zzzz").length, 0);
});

test("workspace search requires user scope", () => {
  assert.deepEqual(workspaceBoardScope("user", "org"), { userId: "user" });
});
