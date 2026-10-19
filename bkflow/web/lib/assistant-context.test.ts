import assert from "node:assert/strict";
import test from "node:test";
import { assistantContextKey, snapshotAssistantRequest, proposalRequestId, formatEditValues } from "./assistant-context";

test("a late response remains bound to the original context and operation", () => {
  const context = { kind: "page" as const, pageId: "a", expectedUpdatedAt: "2026-10-19T00:00:00Z", selectedBlockIds: ["one"] };
  const snapshot = snapshotAssistantRequest(context, "answer");
  context.pageId = "b"; context.selectedBlockIds.push("two");
  assert.equal(snapshot.context.pageId, "a");
  assert.deepEqual(snapshot.context.selectedBlockIds, ["one"]);
  assert.equal(snapshot.operation, "answer");
  assert.notEqual(assistantContextKey(snapshot.context), assistantContextKey(context));
});
test("revision refresh does not move a task conversation, but calendar filters do", () => {
  const context = { kind: "task" as const, cardId: "a", expectedUpdatedAt: "2026-10-19T00:00:00Z" };
  assert.equal(assistantContextKey(context), assistantContextKey({ ...context, expectedUpdatedAt: "2026-10-20T00:00:00Z" }));
  assert.notEqual(assistantContextKey({ kind: "calendar", boardId: "b", date: "2026-10-19", filters: {} }), assistantContextKey({ kind: "calendar", boardId: "b", date: "2026-10-20", filters: {} }));
});

test("proposal retries reuse a stable UUID while different payloads do not", async () => {
  assert.equal(await proposalRequestId("call:a"), await proposalRequestId("call:a"));
  assert.notEqual(await proposalRequestId("call:a"), await proposalRequestId("call:b"));
  assert.match(await proposalRequestId("call:a"), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/);
});
test("previews describe domain fields rather than expose wire payloads", () => {
  assert.equal(formatEditValues({ scheduledOn: "2026-10-20", scheduledStartAt: null, scheduledEndAt: null }), "Ngày làm: 2026-10-20\nBắt đầu: Chưa đặt\nKết thúc: Chưa đặt");
  assert.equal(formatEditValues({ title: "Ôn tập", items: ["Đọc", "Ghi chú"] }), "Tên: Ôn tập\nCác bước: Đọc; Ghi chú");
});
