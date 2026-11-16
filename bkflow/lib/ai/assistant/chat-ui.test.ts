import assert from "node:assert/strict";
import test from "node:test";

import { answerDurationMs, collectSources, matchMentionApps, sourceIndexOf, splitFollowUps, splitMentions } from "./chat-ui";

test("collectSources reads workspace, page and Gmail outputs and skips failures and duplicates", () => {
  const sources = collectSources([
    { type: "tool-searchWorkspace", toolCallId: "1", state: "output-available", output: { ok: true, items: [
      { type: "card", id: "c1", title: "Bài tập 3", subtitle: "IT3011 · Cần làm", href: "/board/b1?cardId=c1" },
      { type: "note", id: "n1", title: "Ghi chú", href: "/pages/n1" },
    ] } },
    { type: "tool-getPage", toolCallId: "2", state: "output-available", output: { ok: true, page: { id: "n1", title: "Ghi chú", href: "/pages/n1" } } },
    { type: "tool-listRecentEmails", toolCallId: "3", state: "output-available", output: { emails: [{ id: "m1", subject: "Hạn nộp", from: "Thầy A", href: "https://mail.google.com/mail/u/0/#all/t1" }] } },
    { type: "tool-searchSlackMessages", toolCallId: "4", state: "output-available", output: { ok: false, error: "x" } },
    { type: "tool-searchNotionPages", toolCallId: "5", state: "output-available", output: { result: "[]" } },
    { type: "tool-findCards", toolCallId: "6", state: "input-available" },
  ]);
  assert.deepEqual(sources.map((source) => [source.app, source.title]), [
    ["uniflow", "Bài tập 3"], ["uniflow", "Ghi chú"], ["gmail", "Hạn nộp"], ["notion", "Notion"],
  ]);
});

test("collectSources turns Slack search matches into linked sources and falls back when the JSON is cut", () => {
  const raw = JSON.stringify({ data: { messages: { matches: [
    { permalink: "https://x.slack.com/archives/C1/p1", text: "<!channel>\nMVP URL", username: "Ryo Kimura", channel: { name: "itss" } },
    { text: "no link" },
  ] } } });
  const [slack] = collectSources([{ type: "tool-searchSlackMessages", toolCallId: "1", state: "output-available", output: { result: raw } }]);
  assert.deepEqual(slack, { id: "https://x.slack.com/archives/C1/p1", href: "https://x.slack.com/archives/C1/p1", title: "@channel MVP URL", subtitle: "Ryo Kimura · #itss", app: "slack" });
  const cut = collectSources([{ type: "tool-searchSlackMessages", toolCallId: "2", state: "output-available", output: { result: raw.slice(0, 40), truncated: true } }]);
  assert.deepEqual(cut.map((source) => source.title), ["Slack"]);
});

test("sourceIndexOf matches relative and absolute links", () => {
  const sources = collectSources([{ type: "tool-searchWorkspace", toolCallId: "1", state: "output-available", output: { ok: true, items: [{ type: "note", title: "A", href: "/pages/n%201" }] } }]);
  assert.equal(sourceIndexOf(sources, "https://app.test/pages/n 1"), 0);
  assert.equal(sourceIndexOf(sources, "/pages/other"), -1);
  assert.equal(sourceIndexOf(sources, undefined), -1);
});

test("splitFollowUps pulls >> lines out and hides a half-typed one while streaming", () => {
  assert.deepEqual(splitFollowUps("Trả lời.\n\n>> Câu 1\n>> Câu 2"), { body: "Trả lời.", followUps: ["Câu 1", "Câu 2"] });
  assert.deepEqual(splitFollowUps("Trả lời.\n> trích", false), { body: "Trả lời.\n> trích", followUps: [] });
  assert.equal(splitFollowUps("Trả lời.\n>", true).body, "Trả lời.");
});

test("splitMentions turns known @handles into apps and keeps the rest as text", () => {
  const parts = splitMentions("@gmail xem mail của @ai và @Calendar");
  assert.deepEqual(parts.map((part) => (typeof part === "string" ? part : part.slug)), ["gmail", " xem mail của ", "@ai", " và ", "googlecalendar"]);
  assert.deepEqual(matchMentionApps("goo").map((app) => app.slug), ["googlecalendar", "google_classroom", "googletasks"]);
});

test("answerDurationMs reads the saved timing part", () => {
  assert.equal(answerDurationMs([{ type: "text" }, { type: "data-timing", data: { ms: 4200 } } as { type: string }]), 4200);
  assert.equal(answerDurationMs([{ type: "text" }]), undefined);
});
