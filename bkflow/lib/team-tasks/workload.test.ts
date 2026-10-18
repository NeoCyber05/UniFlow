import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  computeTeamStats,
  computeWorkload,
  filterTeamTasks,
  getEndOfVNWeek,
  groupAllTeamTasks,
  groupMineTasks,
  UNASSIGNED_KEY,
  type TeamTaskLike,
} from "./workload";

const NOW = new Date("2026-10-06T03:00:00Z"); // Thứ Ba 6/10/2026, 10:00 VN
const DAY = 24 * 60 * 60 * 1000;

const task = (id: string, patch: Partial<TeamTaskLike> = {}): TeamTaskLike => ({
  id,
  dueDate: null,
  isCompleted: false,
  updatedAt: new Date(NOW.getTime() - 30 * DAY),
  boardId: "b-erd",
  boardTitle: "Đồ án CNPM",
  assigneeUserIds: [],
  ...patch,
});

const MEMBERS = [
  { userId: "u-an", name: "An", imageUrl: "a.png" },
  { userId: "u-binh", name: "Bình", imageUrl: "b.png" },
];

const ids = (tasks: { id: string }[]) => tasks.map((item) => item.id);

describe("getEndOfVNWeek", () => {
  it("thứ Ba → hết Chủ nhật cùng tuần (giờ VN)", () => {
    assert.deepEqual(getEndOfVNWeek(NOW), new Date("2026-10-11T16:59:59.999Z"));
  });

  it("Chủ nhật → chính ngày đó", () => {
    assert.deepEqual(
      getEndOfVNWeek(new Date("2026-10-11T03:00:00Z")),
      new Date("2026-10-11T16:59:59.999Z"),
    );
  });
});

describe("groupMineTasks", () => {
  it("quá hạn / tuần này / sau đó / không hạn / đã xong", () => {
    const groups = groupMineTasks(
      [
        task("overdue", { dueDate: new Date("2026-10-05T00:00:00Z") }),
        task("sat", { dueDate: new Date("2026-10-10T00:00:00Z") }),
        task("next-week", { dueDate: new Date("2026-10-13T00:00:00Z") }),
        task("no-due"),
        task("done", { isCompleted: true, dueDate: new Date("2026-10-05T00:00:00Z") }),
      ],
      NOW,
    );

    assert.deepEqual(
      groups.map((group) => [group.key, ids(group.tasks)]),
      [
        ["overdue", ["overdue"]],
        ["this-week", ["sat"]],
        ["later", ["next-week"]],
        ["no-due", ["no-due"]],
        ["done", ["done"]],
      ],
    );
    assert.equal(groups[4].collapsed, true);
  });
});

describe("filterTeamTasks", () => {
  const tasks = [
    task("a", { assigneeUserIds: ["u-an"], boardId: "b1" }),
    task("b", { assigneeUserIds: ["u-binh"], boardId: "b2", isCompleted: true }),
    task("c", { boardId: "b1", dueDate: new Date("2026-10-01T00:00:00Z") }),
  ];

  it("lọc theo bảng", () => {
    assert.deepEqual(ids(filterTeamTasks(tasks, { boardId: "b1" }, NOW)), ["a", "c"]);
  });

  it("lọc theo người và chưa giao", () => {
    assert.deepEqual(ids(filterTeamTasks(tasks, { memberId: "u-an" }, NOW)), ["a"]);
    assert.deepEqual(ids(filterTeamTasks(tasks, { memberId: UNASSIGNED_KEY }, NOW)), ["c"]);
  });

  it("lọc theo trạng thái", () => {
    assert.deepEqual(ids(filterTeamTasks(tasks, { status: "open" }, NOW)), ["a", "c"]);
    assert.deepEqual(ids(filterTeamTasks(tasks, { status: "done" }, NOW)), ["b"]);
    assert.deepEqual(ids(filterTeamTasks(tasks, { status: "overdue" }, NOW)), ["c"]);
  });
});

describe("groupAllTeamTasks", () => {
  const tasks = [
    task("x", { boardId: "b2", boardTitle: "CLB Media", assigneeUserIds: ["u-an", "u-binh"] }),
    task("y", { boardId: "b1", boardTitle: "Đồ án CNPM", assigneeUserIds: ["u-an"] }),
    task("z", { boardId: "b1", boardTitle: "Đồ án CNPM" }),
  ];

  it("theo bảng, sắp theo tên", () => {
    assert.deepEqual(
      groupAllTeamTasks(tasks, "board", MEMBERS, NOW).map((group) => [group.label, ids(group.tasks)]),
      [
        ["CLB Media", ["x"]],
        ["Đồ án CNPM", ["y", "z"]],
      ],
    );
  });

  it("theo người: việc nhiều người nằm ở mỗi người, Chưa giao cuối", () => {
    assert.deepEqual(
      groupAllTeamTasks(tasks, "member", MEMBERS, NOW).map((group) => [group.key, ids(group.tasks)]),
      [
        ["u-an", ["x", "y"]],
        ["u-binh", ["x"]],
        [UNASSIGNED_KEY, ["z"]],
      ],
    );
  });

  it("theo trạng thái, bỏ nhóm rỗng", () => {
    const groups = groupAllTeamTasks(
      [task("o"), task("d", { isCompleted: true })],
      "status",
      MEMBERS,
      NOW,
    );
    assert.deepEqual(groups.map((group) => [group.key, ids(group.tasks)]), [
      ["open", ["o"]],
      ["done", ["d"]],
    ]);
  });
});

describe("computeWorkload", () => {
  it("đếm mở / quá hạn / xong 7 ngày, tải so với người nhiều nhất, có Chưa giao", () => {
    const rows = computeWorkload(
      [
        task("1", { assigneeUserIds: ["u-an"] }),
        task("2", { assigneeUserIds: ["u-an"], dueDate: new Date("2026-10-01T00:00:00Z") }),
        task("3", { assigneeUserIds: ["u-binh"] }),
        task("4", { assigneeUserIds: ["u-binh"], isCompleted: true, updatedAt: new Date(NOW.getTime() - 2 * DAY) }),
        task("5", { assigneeUserIds: ["u-binh"], isCompleted: true, updatedAt: new Date(NOW.getTime() - 9 * DAY) }),
        task("6"),
      ],
      MEMBERS,
      NOW,
    );

    assert.deepEqual(
      rows.map((row) => [row.userId, row.open, row.overdue, row.doneLast7Days, row.load]),
      [
        ["u-an", 2, 1, 0, 1],
        ["u-binh", 1, 0, 1, 0.5],
        [UNASSIGNED_KEY, 1, 0, 0, 0.5],
      ],
    );
  });
});

describe("computeTeamStats", () => {
  it("tổng, xong, quá hạn, hạn tuần này, không hạn", () => {
    assert.deepEqual(
      computeTeamStats(
        [
          task("a", { isCompleted: true }),
          task("b", { dueDate: new Date("2026-10-01T00:00:00Z") }),
          task("c", { dueDate: new Date("2026-10-09T00:00:00Z") }),
          task("d", { dueDate: new Date("2026-10-20T00:00:00Z") }),
          task("e"),
        ],
        NOW,
      ),
      { total: 5, completed: 1, overdue: 1, dueThisWeek: 1, unscheduled: 2 },
    );
  });
});
