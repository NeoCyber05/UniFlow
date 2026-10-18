import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { groupAgendaTasks, type BucketTask } from "./buckets";
import { getStartOfVNDay, getVNDay } from "./vn-day";

const NOW = new Date("2026-10-06T03:00:00Z"); // Thứ Ba 6/10/2026, 10:00 VN
const YESTERDAY = new Date("2026-10-05T03:00:00Z");

const task = (id: string, patch: Partial<BucketTask> = {}): BucketTask => ({
  id,
  dueDate: null,
  isCompleted: false,
  updatedAt: YESTERDAY,
  myDayAt: null,
  ...patch,
});

const byKey = (groups: { key: string; tasks: { id: string }[] }[]) =>
  Object.fromEntries(groups.map((group) => [group.key, group.tasks.map((item) => item.id)]));

describe("groupAgendaTasks", () => {
  it("trả đủ 7 nhóm theo thứ tự, nhóm xa thu gọn", () => {
    const groups = groupAgendaTasks([], NOW);

    assert.deepEqual(
      groups.map((group) => [group.key, group.label, group.collapsed ?? false]),
      [
        ["overdue", "Quá hạn", false],
        ["today", "Hôm nay", false],
        ["tomorrow", "Ngày mai", false],
        ["week", "Tuần này", true],
        ["later", "Sau đó", true],
        ["nodue", "Không hạn", true],
        ["done", "Đã xong hôm nay", true],
      ],
    );
  });

  it("chia việc theo trục thời gian VN", () => {
    const tasks = [
      task("overdue", { dueDate: new Date("2026-10-05T10:00:00Z") }),
      task("pinned-overdue", { dueDate: new Date("2026-10-04T10:00:00Z"), myDayAt: NOW }),
      task("overdue-today-past", { dueDate: new Date("2026-10-06T01:00:00Z") }),
      task("due-later-today", { dueDate: new Date("2026-10-06T15:00:00Z") }),
      task("late-today", { dueDate: new Date("2026-10-06T16:30:00Z") }),
      task("pinned-tomorrow", { dueDate: new Date("2026-10-07T05:00:00Z"), myDayAt: NOW }),
      task("pinned-no-due", { myDayAt: new Date("2026-10-06T01:00:00Z") }),
      task("pinned-yesterday-no-due", { myDayAt: YESTERDAY }),
      task("early-tomorrow", { dueDate: new Date("2026-10-06T17:30:00Z") }),
      task("thu", { dueDate: new Date("2026-10-08T02:00:00Z") }),
      task("sun-late", { dueDate: new Date("2026-10-11T16:30:00Z") }),
      task("mon-next", { dueDate: new Date("2026-10-11T17:30:00Z") }),
      task("no-due"),
      task("done-today", { isCompleted: true, updatedAt: new Date("2026-10-06T02:00:00Z") }),
      task("done-yesterday", { isCompleted: true, updatedAt: YESTERDAY }),
    ];

    assert.deepEqual(byKey(groupAgendaTasks(tasks, NOW)), {
      overdue: ["pinned-overdue", "overdue", "overdue-today-past"],
      today: ["due-later-today", "late-today", "pinned-tomorrow", "pinned-no-due"],
      tomorrow: ["early-tomorrow"],
      week: ["thu", "sun-late"],
      later: ["mon-next"],
      nodue: ["pinned-yesterday-no-due", "no-due"],
      done: ["done-today"],
    });
  });

  it("Chủ nhật: Tuần này rỗng, sau ngày mai là Sau đó", () => {
    const sunday = new Date("2026-10-11T03:00:00Z"); // Chủ nhật 11/10, 10:00 VN
    const tasks = [
      task("mon", { dueDate: new Date("2026-10-12T05:00:00Z") }),
      task("tue", { dueDate: new Date("2026-10-13T05:00:00Z") }),
    ];
    const groups = byKey(groupAgendaTasks(tasks, sunday));

    assert.deepEqual(groups.tomorrow, ["mon"]);
    assert.deepEqual(groups.week, []);
    assert.deepEqual(groups.later, ["tue"]);
  });
});

describe("getStartOfVNDay", () => {
  it("00:00 VN = 17:00Z hôm trước", () => {
    assert.deepEqual(
      getStartOfVNDay(getVNDay(new Date("2026-10-06T03:00:00Z"))),
      new Date("2026-10-05T17:00:00.000Z"),
    );
  });

  it("hạn chỉ-ngày: hôm nay chưa quá hạn, hôm qua quá hạn", () => {
    const groups = byKey(groupAgendaTasks([
      task("d-today", { deadlineOn: "2026-10-06" }),
      task("d-yesterday", { deadlineOn: "2026-10-05" }),
    ], NOW));

    assert.deepEqual(groups.today, ["d-today"]);
    assert.deepEqual(groups.overdue, ["d-yesterday"]);
  });
});
