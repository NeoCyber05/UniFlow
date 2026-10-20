/* eslint-disable @typescript-eslint/no-explicit-any -- Database doubles and a scripted model exercise the policy without live services. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { isStepCount, tool, ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { z } from "zod";

import { BoardMemberRole } from "@/types";
import type { AssistantSession } from "./board-data";
import { AI_OPERATIONS, applyToolPolicy, getApplyPolicy, getConfirmation, MUTATION_TOOL_OPERATIONS, READ_TOOLS } from "./policy";
import { createAssistantTools } from "./tools";
import { requiresContentConfirmation } from "./content-confirmation";

const REV = "2026-10-18T00:00:00.000Z";
const TOMORROW = "2026-10-20T08:00:00+07:00";
const board: AssistantSession = { boardId: "b1", userId: "u1", role: BoardMemberRole.ADMIN, timeZone: "Asia/Ho_Chi_Minh", context: { kind: "board", boardId: "b1" } };
const onTask = (operation?: AssistantSession["operation"]): AssistantSession => ({ ...board, context: { kind: "task", cardId: "c1", expectedUpdatedAt: REV }, operation });

const previousDb = globalThis.prisma;
let writes: string[];
let card: { id: string; title: string; dueDate: Date | null; startDate: Date | null; updatedAt: Date; descriptionUpdatedAt: Date; description: null; deadlineOn: null; scheduledOn: null; scheduledStartAt: null; scheduledEndAt: null };

beforeEach(() => {
  writes = [];
  card = { id: "c1", title: "Báo cáo", dueDate: new Date("2026-10-25T10:00:00Z"), startDate: null, updatedAt: new Date(REV), descriptionUpdatedAt: new Date(REV), description: null, deadlineOn: null, scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null };
  const models: Record<string, any> = {
    card: { findFirst: async ({ where }: any) => (where.id === card.id && where.list?.boardId === "b1" ? card : null), findMany: async () => [] },
    board: { findFirst: async () => ({ id: "b1", userId: "u1", title: "Board" }), findMany: async () => [] },
    noteDeadline: { findMany: async () => [] },
    course: { findMany: async () => [] }, workspace: {}, aiNoteEdit: {}, notePage: { findMany: async () => [], findFirst: async () => null },
  };
  // Mọi lệnh ghi đều được ghi nhận: test khẳng định chúng không xảy ra.
  globalThis.prisma = new Proxy(models, {
    get: (target, model: string) => new Proxy(target[model] ?? {}, {
      get: (methods, method: string) => /create|update|upsert|delete/i.test(method)
        ? async () => { writes.push(`${model}.${method}`); return {}; }
        : methods[method],
    }),
  }) as unknown as PrismaClient;
});
afterEach(() => { globalThis.prisma = previousDb; });

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
/** Model giả: bước 1 gọi đúng các công cụ cho trước, bước 2 trả lời văn bản. */
const scriptedModel = (calls: { toolName: string; input: unknown }[]) => {
  let step = 0;
  return new MockLanguageModelV3({
    doGenerate: async () => {
      const first = step++ === 0;
      return {
        content: first
          ? calls.map((call, index) => ({ type: "tool-call" as const, toolCallId: `t${index}`, toolName: call.toolName, input: JSON.stringify(call.input) }))
          : [{ type: "text" as const, text: "Đây là đề xuất." }],
        finishReason: { unified: first ? "tool-calls" as const : "stop" as const, raw: undefined },
        usage, warnings: [],
      };
    },
  });
};
const run = async (session: AssistantSession, prompt: string, calls: { toolName: string; input: unknown }[]) => {
  const agent = new ToolLoopAgent({ model: scriptedModel(calls), tools: createAssistantTools(session), stopWhen: isStepCount(3) });
  const result = await agent.generate({ prompt });
  return result.steps.flatMap((step) => step.toolResults.map((item: any) => item.output));
};

test("every registered tool is classified as read or mutation", () => {
  for (const name of Object.keys(createAssistantTools(board))) {
    assert.ok(READ_TOOLS.has(name) || name in MUTATION_TOOL_OPERATIONS, `${name} must be classified`);
  }
  assert.throws(() => applyToolPolicy({ sneakyWrite: tool({ inputSchema: z.object({}), execute: async () => ({ ok: true }) }) }, { loadCard: async () => null }));
});

test("question exposes read tools only", async () => {
  assert.equal(getApplyPolicy("answer"), "read");
  const [agenda] = await run(board, "ngày mai có gì?", [{ toolName: "getMyAgenda", input: { range: "tomorrow" } }]);
  assert.equal(agenda.ok, true);
  // Kể cả khi model tự gọi công cụ ghi cho một câu hỏi, server chỉ trả đề xuất.
  const [proposal] = await run(board, "ngày mai có gì?", [{ toolName: "createDeadlineCard", input: { title: "Ôn thi", dueDate: TOMORROW } }]);
  assert.equal(proposal.action, "proposal");
  assert.deepEqual(writes, []);
});

test("schedule requires preview", async () => {
  assert.equal(getApplyPolicy("set_schedule"), "preview");
  assert.equal(getApplyPolicy("set_deadline"), "preview");
  assert.equal(getApplyPolicy("batch_update"), "preview");
  const before = card.dueDate;
  // "ngày mai mình làm việc này" trên thẻ đang mở: chỉ đề xuất lịch, kể cả khi UI gửi set_schedule.
  const [proposal] = await run(onTask("set_schedule"), "ngày mai mình làm việc này", [{ toolName: "updateCardDeadline", input: { cardId: "c1", scheduledOn: "2026-10-20" } }]);
  assert.equal(proposal.action, "proposal");
  assert.equal(proposal.operation, "set_schedule");
  assert.equal(proposal.policy, "preview");
  assert.equal(proposal.target.id, "c1");
  assert.deepEqual(proposal.context, { kind: "task", id: "c1", expectedUpdatedAt: REV });
  assert.equal(card.dueDate, before);
  assert.deepEqual(writes, []);
});

test("missing task asks for clarification instead of guessing", async () => {
  const [output] = await run(board, "ngày mai mình làm việc này", [{ toolName: "updateCardDeadline", input: { cardId: "việc này", startDate: TOMORROW } }]);
  assert.equal(output.ok, false);
  assert.equal(output.needsClarification, true);
  assert.deepEqual(writes, []);
});

test("explicit content edit uses undo policy", async () => {
  assert.equal(getApplyPolicy("edit_task_content"), "direct-with-undo");
  assert.equal(getApplyPolicy("add_checklist"), "direct-with-undo");
  assert.equal(getApplyPolicy("edit_page"), "direct-with-undo");
  const applied: unknown[] = [];
  const stub = { updateCardDetails: tool({ inputSchema: z.object({ cardId: z.string(), description: z.string() }), execute: async (): Promise<{ ok: boolean }> => { throw new Error("Old writer must not run"); } }) };
  const call = (gate: Partial<Parameters<typeof applyToolPolicy>[1]>, cardId = "c1") =>
    (applyToolPolicy(stub, { loadCard: async (id) => ({ id, title: "Báo cáo", updatedAt: new Date(REV), descriptionUpdatedAt: new Date(REV), description: null, dueDate: null, deadlineOn: null, scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null }), applyEdit: async edit => { applied.push(edit); return { ok: true, action: "updated" }; }, ...gate }).updateCardDetails as any).execute({ cardId, description: "Mới" }, { toolCallId: "t", messages: [] });
  const task = onTask().context;
  assert.equal((await call({ context: task, operation: "edit_task_content" })).action, "updated");
  // Không có lệnh UI, hoặc lệnh nhắm thẻ khác ngữ cảnh: chỉ đề xuất.
  assert.equal((await call({ context: task })).action, "proposal");
  assert.equal((await call({ context: task, operation: "edit_task_content" }, "c2")).action, "proposal");
  assert.equal((await call({ context: { kind: "board", boardId: "b1" }, operation: "edit_task_content" })).action, "proposal");
  assert.equal(applied.length, 1);
});

test("substantial task content replacement always becomes an explicit preview", async () => {
  const target = { id: "c1", title: "Notes", description: "Important notes. ".repeat(30), descriptionUpdatedAt: new Date(REV), updatedAt: new Date(REV), dueDate: null, deadlineOn: null, scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null };
  const definition = tool({ inputSchema: z.object({ cardId: z.string(), description: z.string() }), execute: async (): Promise<{ ok: boolean }> => { throw new Error("must not write"); } });
  const tools = applyToolPolicy({ updateCardDetails: definition }, { context: onTask().context, operation: "edit_task_content", loadCard: async () => target, applyEdit: async () => { throw new Error("must preview"); } });
  const proposal = await (tools.updateCardDetails as any).execute({ cardId: "c1", description: "Short" }, { toolCallId: "large", messages: [] });
  assert.equal(proposal.operation, "replace_content"); assert.equal(proposal.confirmation, "explicit");
  assert.equal(requiresContentConfirmation("Keep ".repeat(100), "Keep ".repeat(100) + "Appended"), false);
});

test("old tools cannot bypass preview or confirmation", async () => {
  assert.equal(getConfirmation("replace_content"), "explicit");
  assert.equal(getConfirmation("edit_task_content"), null);
  const outputs = await run(onTask("edit_task_content"), "đặt hạn mục này ngày mai và lưu trữ thẻ", [
    { toolName: "updateChecklistItem", input: { cardId: "c1", itemId: "i1", change: { type: "dueDate", dueDate: TOMORROW } } },
    { toolName: "updateCardDeadline", input: { cardId: "c1", dueDate: TOMORROW } },
    { toolName: "archiveCard", input: { cardId: "c1" } },
    { toolName: "batchCreateCards", input: { cards: [{ title: "A" }, { title: "B" }] } },
  ]);
  assert.deepEqual(outputs.map((output) => [output.action, output.operation]), [
    ["proposal", "set_deadline"], ["proposal", "set_deadline"], ["proposal", "replace_content"], ["proposal", "batch_update"],
  ]);
  assert.equal(outputs[2].confirmation, "explicit");
  const archived = await run(onTask("replace_content"), "lưu trữ thẻ này", [{ toolName: "archiveCard", input: { cardId: "c1" } }]);
  assert.equal(archived[0].action, "proposal");
  assert.deepEqual(writes, []);
  assert.deepEqual([...AI_OPERATIONS].sort(), ["add_checklist", "answer", "batch_update", "edit_page", "edit_task_content", "replace_content", "set_deadline", "set_schedule"]);
});
