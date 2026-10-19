import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";

import { getBoardAnalyticsData } from "./board-report-data";

test("board reports use task state without reading activity logs", async () => {
  const prompt = readFileSync("actions/ai/generate-ai-board-report/index.ts", "utf8");
  assert.match(prompt, /completedCardsUpdatedInRange/);
  assert.doesNotMatch(prompt, /completedCardsInRange|recentActivity/);
  const previousDb = globalThis.prisma;
  const updatedAt = new Date();
  globalThis.prisma = {
    course: {}, semester: {}, notePage: {}, aiNoteEdit: {},
    board: { findFirst: async () => ({ id: "b1", title: "Board", courses: [] }) },
    list: { findMany: async () => [{
      id: "l1", title: "Done", order: 0,
      cards: [{
        id: "c1", title: "Report", listId: "l1", order: 0, courseId: null,
        startDate: null, dueDate: null, deadlineOn: null, isCompleted: true,
        createdAt: updatedAt, updatedAt, labels: [], checklists: [],
      }],
    }] },
    get auditLog() { throw new Error("Reports must not read activity logs"); },
  } as unknown as PrismaClient;

  try {
    const analytics = await getBoardAnalyticsData({ boardId: "b1", includeReportContext: true });
    assert.equal(analytics.kpis.completedCards, 1);
    assert.equal(analytics.reportContext?.completedCardsUpdatedInRange[0]?.id, "c1");
    assert.equal("recentActivity" in analytics.reportContext!, false);
    const withoutContext = await getBoardAnalyticsData({ boardId: "b1" });
    assert.equal(withoutContext.reportContext, null);
  } finally {
    globalThis.prisma = previousDb;
  }
});
