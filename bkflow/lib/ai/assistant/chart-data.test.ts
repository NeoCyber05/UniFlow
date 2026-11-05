import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAssistantChart, type ChartCard } from "./chart-data";

const TZ = "Asia/Ho_Chi_Minh";
// Thứ Năm 05/11/2026 10:00 giờ VN
const NOW = new Date("2026-11-05T03:00:00.000Z");

let seq = 0;
const card = (overrides: Partial<ChartCard>): ChartCard => ({
  id: `c${++seq}`,
  title: "Việc",
  listId: "l1",
  listTitle: "Cần làm",
  courseId: null,
  courseName: null,
  labels: [],
  dueDate: null,
  isCompleted: false,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  ...overrides,
});

const courses = [
  { id: "gt", name: "Giải tích", color: "sky" },
  { id: "csdl", name: "Cơ sở dữ liệu", color: "rose" },
];
const lists = [{ id: "l1", title: "Cần làm" }, { id: "l2", title: "Xong" }];

test("course workload splits completed/open/overdue and sorts by remaining work", () => {
  const cards = [
    card({ courseId: "gt", dueDate: new Date("2026-11-06T10:00:00.000Z") }),
    card({ courseId: "csdl", dueDate: new Date("2026-11-04T10:00:00.000Z") }),
    card({ courseId: "csdl", dueDate: new Date("2026-11-07T10:00:00.000Z") }),
    card({ courseId: "csdl", isCompleted: true }),
    card({}),
  ];
  const chart = buildAssistantChart({ kind: "course_workload" }, { cards, courses, lists }, NOW, TZ);
  assert.equal(chart.kind, "course_workload");
  if (chart.kind !== "course_workload") return;
  assert.deepEqual(chart.items.map((item) => [item.id, item.completed, item.open, item.overdue]), [
    ["csdl", 1, 1, 1],
    ["gt", 0, 1, 0],
    ["personal", 0, 1, 0],
  ]);
});

test("this_week keeps cards due this week plus overdue open ones, drops undated", () => {
  const cards = [
    card({ courseId: "gt", dueDate: new Date("2026-11-08T15:00:00.000Z") }), // CN 08/11 22:00 VN: trong tuần
    card({ courseId: "gt", dueDate: new Date("2026-11-09T03:00:00.000Z") }), // Thứ Hai tuần sau
    card({ courseId: "csdl", dueDate: new Date("2026-10-20T03:00:00.000Z") }), // quá hạn, chưa xong
    card({ courseId: "csdl" }),
  ];
  const chart = buildAssistantChart({ kind: "course_workload", period: "this_week" }, { cards, courses, lists }, NOW, TZ);
  assert.equal(chart.matchedCards, 2);
});

test("query scopes by title, course and labels without accents", () => {
  const cards = [
    card({ title: "Đồ án giai đoạn 1", isCompleted: true }),
    card({ title: "Ôn thi", labels: ["do an"] }),
    card({ title: "Đi chợ" }),
  ];
  const chart = buildAssistantChart({ kind: "status", query: "do an" }, { cards, courses, lists }, NOW, TZ);
  assert.equal(chart.matchedCards, 2);
  if (chart.kind !== "status") return;
  assert.equal(chart.completionRate, 50);
  assert.deepEqual(chart.items.map((item) => item.value), [1, 0, 0, 1]);
});

test("daily progress buckets by the user's local day and clamps the range", () => {
  const cards = [
    // 04/11 23:30 VN = 04/11 16:30 UTC
    card({ createdAt: new Date("2026-11-04T16:30:00.000Z") }),
    // 04/11 17:30 UTC = 05/11 00:30 VN
    card({ createdAt: new Date("2026-11-04T17:30:00.000Z"), isCompleted: true, updatedAt: new Date("2026-11-05T01:00:00.000Z") }),
  ];
  const chart = buildAssistantChart({ kind: "daily_progress", days: 2 }, { cards, courses, lists }, NOW, TZ);
  if (chart.kind !== "daily_progress") return assert.fail("wrong kind");
  assert.equal(chart.days, 3);
  assert.deepEqual(chart.points, [
    { date: "2026-11-03", created: 0, completed: 0 },
    { date: "2026-11-04", created: 1, completed: 0 },
    { date: "2026-11-05", created: 1, completed: 1 },
  ]);
  assert.deepEqual(chart.totals, { created: 2, completed: 1 });
});

test("deadline load counts upcoming days and reports overdue separately", () => {
  const cards = [
    card({ dueDate: new Date("2026-11-05T10:00:00.000Z") }),
    card({ dueDate: new Date("2026-11-06T10:00:00.000Z"), isCompleted: true }),
    card({ dueDate: new Date("2026-11-01T10:00:00.000Z") }),
    card({ dueDate: new Date("2026-12-01T10:00:00.000Z") }),
  ];
  const chart = buildAssistantChart({ kind: "deadline_load", days: 3 }, { cards, courses, lists }, NOW, TZ);
  if (chart.kind !== "deadline_load") return assert.fail("wrong kind");
  assert.equal(chart.overdue, 1);
  assert.deepEqual(chart.points, [
    { date: "2026-11-05", open: 1, completed: 0 },
    { date: "2026-11-06", open: 0, completed: 1 },
    { date: "2026-11-07", open: 0, completed: 0 },
  ]);
});

test("list distribution follows board list order", () => {
  const cards = [card({ listId: "l2" }), card({ listId: "l2" }), card({ listId: "l1" })];
  const chart = buildAssistantChart({ kind: "list_distribution" }, { cards, courses, lists }, NOW, TZ);
  if (chart.kind !== "list_distribution") return assert.fail("wrong kind");
  assert.deepEqual(chart.items.map((item) => [item.name, item.count]), [["Cần làm", 1], ["Xong", 2]]);
});
