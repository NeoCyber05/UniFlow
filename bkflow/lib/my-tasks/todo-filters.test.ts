import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { BoardFilterState } from "@/hooks/use-board-filters";

import { todoTaskMatchesFilters, type TodoFilterableTask } from "./todo-filters";

const filters = (patch: Partial<BoardFilterState> = {}): BoardFilterState => ({
  selectedListIds: [],
  selectedMemberIds: [],
  myWorkEnabled: false,
  noMembersEnabled: false,
  completedEnabled: false,
  notCompletedEnabled: false,
  selectedDueDateFilters: [],
  selectedLabelIds: [],
  noLabelsEnabled: false,
  selectedCourseIds: [],
  importantOnly: false,
  ...patch,
});

const course = { id: "c1", name: "Giải tích", code: null, color: "violet" };

const task = (patch: Partial<TodoFilterableTask> = {}): TodoFilterableTask => ({
  isImportant: false,
  boardType: "SEMESTER",
  course: null,
  ...patch,
});

describe("todoTaskMatchesFilters", () => {
  it("không lọc → hiện cả việc nhóm", () => {
    assert.equal(todoTaskMatchesFilters(task({ boardType: "TEAM_PROJECT" }), filters()), true);
  });

  it("lọc môn → đúng môn, ẩn việc nhóm", () => {
    const byCourse = filters({ selectedCourseIds: ["c1"] });

    assert.equal(todoTaskMatchesFilters(task({ course }), byCourse), true);
    assert.equal(todoTaskMatchesFilters(task(), byCourse), false);
    assert.equal(todoTaskMatchesFilters(task({ boardType: "TEAM_PROJECT" }), filters({ selectedCourseIds: ["none"] })), false);
    assert.equal(todoTaskMatchesFilters(task(), filters({ selectedCourseIds: ["none"] })), true);
  });

  it("⭐ → chỉ việc quan trọng, kể cả việc nhóm", () => {
    const on = filters({ importantOnly: true });

    assert.equal(todoTaskMatchesFilters(task({ isImportant: true, boardType: "TEAM_PROJECT" }), on), true);
    assert.equal(todoTaskMatchesFilters(task(), on), false);
  });
});
