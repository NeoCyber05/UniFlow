/* eslint-disable @typescript-eslint/no-explicit-any -- DB double for the read-only home loader. */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { loadAssistantHome } from "./assistant-home";

const previousDb = globalThis.prisma;
afterEach(() => { globalThis.prisma = previousDb; });

test("loadAssistantHome chỉ đọc việc mở của chủ sở hữu, không đếm thống kê tuần", async () => {
  const calls: any[] = [];
  const past = new Date(Date.now() - 3 * 86_400_000);
  globalThis.prisma = {
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    card: {
      count: async () => { throw new Error("card.count must not be called"); },
      findMany: async (args: any) => {
        calls.push(args);
        return [
          { id: "late", title: "Quá hạn", dueDate: past, deadlineOn: null, list: { boardId: "b1" } },
          { id: "dateOnly", title: "Theo ngày", dueDate: null, deadlineOn: new Date("2000-01-02T00:00:00.000Z"), list: { boardId: "b1" } },
        ];
      },
    },
  } as unknown as PrismaClient;

  const home = await loadAssistantHome({ timeZone: "Asia/Ho_Chi_Minh" }, "u1");
  assert.equal(calls.length, 1);
  const where = calls[0].where;
  assert.equal(where.archivedAt, null);
  assert.equal(where.kind, "TASK");
  assert.equal(where.isCompleted, false);
  assert.deepEqual(where.list.board, { userId: "u1" });
  assert.equal(where.list.archivedAt, null);
  assert.deepEqual(Object.keys(home).sort(), ["dueToday", "now", "overdue", "timeZone"]);
  assert.equal(home.overdue.count, 2);
  // deadlineOn date-only: chuỗi YYYY-MM-DD được truyền xuống, ngày 2000-01-02 là việc quá hạn cũ nhất.
  assert.equal(home.overdue.first?.id, "dateOnly");
});
