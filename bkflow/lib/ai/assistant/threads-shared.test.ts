import assert from "node:assert/strict";
import { test } from "node:test";

import { appliedChanges, collectProposals, deriveThreadTitle, groupThreads, parseThreadDecisions } from "./threads-shared";

test("deriveThreadTitle keeps short questions and cuts long ones on a word boundary", () => {
  assert.equal(deriveThreadTitle("  Tuần này   có hạn nào? "), "Tuần này có hạn nào?");
  const long = "Lên kế hoạch ôn thi Xác suất thống kê trong 2 tuần tới, mỗi chương một thẻ và nhắc trước 1 ngày";
  const title = deriveThreadTitle(long);
  assert.ok(title.length <= 60, title);
  assert.ok(title.endsWith("…"));
  assert.ok(long.startsWith(title.slice(0, -1)));
  assert.ok(!/\s…$/.test(title));
});

test("parseThreadDecisions drops malformed entries", () => {
  assert.deepEqual(parseThreadDecisions(null), {});
  assert.deepEqual(parseThreadDecisions([1, 2]), {});
  assert.deepEqual(
    parseThreadDecisions({ a: { status: "applied", at: "2026-11-05T01:00:00.000Z" }, b: { status: "maybe", at: "x" }, c: "nope" }),
    { a: { status: "applied", at: "2026-11-05T01:00:00.000Z" } },
  );
});

test("groupThreads splits pinned, today, last 7 days and older", () => {
  const now = new Date(2026, 10, 5, 15, 0);
  const at = (day: number, hour = 9) => new Date(2026, 10, day, hour).toISOString();
  const groups = groupThreads([
    { id: "old", pinnedAt: null, updatedAt: new Date(2026, 9, 20, 9).toISOString() },
    { id: "today", pinnedAt: null, updatedAt: at(5, 8) },
    { id: "week", pinnedAt: null, updatedAt: at(1) },
    { id: "pin", pinnedAt: at(2), updatedAt: at(5, 10) },
    // 30/10 là mốc đầu của 7 ngày tính cả hôm nay; 29/10 đã sang "Cũ hơn"
    { id: "edge", pinnedAt: null, updatedAt: new Date(2026, 9, 29, 23).toISOString() },
  ], now);
  assert.deepEqual(groups.pinned.map((t) => t.id), ["pin"]);
  assert.deepEqual(groups.today.map((t) => t.id), ["today"]);
  assert.deepEqual(groups.week.map((t) => t.id), ["week"]);
  assert.deepEqual(groups.older.map((t) => t.id).sort(), ["edge", "old"]);
});

test("collectProposals finds proposal outputs and attaches saved decisions", () => {
  const messages = [
    { id: "u1", role: "user", parts: [{ type: "text" }] },
    { id: "a1", role: "assistant", parts: [
      { type: "tool-findCards", toolCallId: "t0", state: "output-available", output: { ok: true } },
      { type: "tool-moveCard", toolCallId: "t1", state: "output-available", output: { ok: true, action: "proposal", tool: "moveCard" } },
      { type: "tool-batchCreateCards", toolCallId: "t2", state: "input-available" },
    ] },
    { id: "a2", role: "assistant", parts: [
      { type: "tool-createDeadlineCard", toolCallId: "t3", state: "output-available", output: { ok: true, action: "proposal" } },
    ] },
  ];
  const proposals = collectProposals(messages, {
    t1: { status: "applied", at: "2026-11-05T02:00:00.000Z", output: { ok: true, action: "moved" } },
    t3: { status: "applied", at: "2026-11-05T03:00:00.000Z" },
  });
  assert.deepEqual(proposals.map((p) => [p.toolCallId, p.tool, p.messageId]), [["t1", "moveCard", "a1"], ["t3", "createDeadlineCard", "a2"]]);
  assert.equal(proposals[0].decision?.status, "applied");
  assert.deepEqual(appliedChanges(proposals).map((p) => p.toolCallId), ["t3", "t1"]);
});
