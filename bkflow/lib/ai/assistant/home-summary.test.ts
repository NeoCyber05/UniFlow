import assert from "node:assert/strict";
import { test } from "node:test";

import { summarizeAssistantHome } from "./home-summary";

test("summarizeAssistantHome splits remaining-today and overdue, earliest first", () => {
  const now = new Date("2026-11-05T03:00:00.000Z"); // 10:00 giờ VN
  const endOfToday = new Date("2026-11-05T17:00:00.000Z");
  const summary = summarizeAssistantHome({
    now,
    endOfToday,
    doneThisWeek: 8,
    doneLastWeek: 5,
    openCards: [
      { id: "a", title: "Nộp slide CSDL", boardId: "b", dueDate: "2026-11-05T07:00:00.000Z", deadlineOn: null },
      { id: "b", title: "Quiz", boardId: "b", dueDate: "2026-11-05T05:00:00.000Z", deadlineOn: null },
      { id: "c", title: "Bài tập nhóm 2", boardId: "b", dueDate: "2026-11-04T16:59:00.000Z", deadlineOn: null },
      { id: "d", title: "Cũ hơn", boardId: "b", dueDate: "2026-11-01T16:59:00.000Z", deadlineOn: null },
      { id: "e", title: "Tuần sau", boardId: "b", dueDate: "2026-11-10T10:00:00.000Z", deadlineOn: null },
      { id: "f", title: "Không hạn", boardId: "b", dueDate: null, deadlineOn: null },
    ],
  });
  assert.equal(summary.dueToday.count, 2);
  assert.equal(summary.dueToday.first?.id, "b");
  assert.equal(summary.overdue.count, 2);
  assert.equal(summary.overdue.first?.id, "d");
  assert.deepEqual(summary.done, { thisWeek: 8, lastWeek: 5 });
});
