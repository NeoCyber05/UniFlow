import assert from "node:assert/strict";
import test from "node:test";

import { buildPageTree, getPagePath, getSubtreeIds, type PageSummary } from "./page-tree";

const page = (id: string, parentId: string | null = null): PageSummary => ({ id, title: id, parentId, updatedAt: "" });

test("buildPageTree nests children and keeps orphans at the root", () => {
  const tree = buildPageTree([page("a"), page("b", "a"), page("c", "b"), page("d", "missing")]);
  assert.deepEqual(tree.map(node => node.id), ["a", "d"]);
  assert.equal(tree[0].children[0].children[0].id, "c");
});

test("getPagePath returns root-first ancestors and survives cycles", () => {
  assert.deepEqual(getPagePath([page("a"), page("b", "a"), page("c", "b")], "c").map(item => item.id), ["a", "b", "c"]);
  assert.deepEqual(getPagePath([page("x", "y"), page("y", "x")], "x").map(item => item.id), ["y", "x"]);
  assert.deepEqual(getPagePath([], "nope"), []);
});

test("getSubtreeIds collects descendants without looping", () => {
  const pages = [page("a"), page("b", "a"), page("c", "b"), page("d"), page("x", "y"), page("y", "x")];
  assert.deepEqual(getSubtreeIds(pages, "a"), ["a", "b", "c"]);
  assert.deepEqual(getSubtreeIds(pages, "d"), ["d"]);
  assert.deepEqual(getSubtreeIds(pages, "x").sort(), ["x", "y"]);
});
