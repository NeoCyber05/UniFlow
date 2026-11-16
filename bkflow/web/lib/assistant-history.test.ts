import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { ThreadList } from "@/components/assistant/thread-list";

test("failed history requests show an error and retry instead of an empty history", () => {
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ThreadList, {
    threads: [], loading: false, error: true, onRetry: () => {}, onDeleted: () => {},
  })));
  assert.match(html, /role="alert"/);
  assert.match(html, /Thử lại/);
  assert.doesNotMatch(html, /Chưa có cuộc trò chuyện/);
});
