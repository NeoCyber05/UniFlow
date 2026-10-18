import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { BoardFilterState } from "@/hooks/use-board-filters";

import {
  boardFiltersAreActive,
  filterableCardMatchesBoardFilters,
  importantMatchesFilters,
} from "./board-filters";

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

const card = (patch: { isImportant?: boolean; courseId?: string | null } = {}) => ({
  listId: "l1",
  dueDate: null,
  isCompleted: false,
  assignees: [],
  labels: [],
  courseId: null,
  ...patch,
});

describe("importantOnly", () => {
  it("tắt → mọi thẻ khớp", () => {
    assert.equal(filterableCardMatchesBoardFilters(card(), filters()), true);
    assert.equal(importantMatchesFilters(undefined, filters()), true);
  });

  it("bật → chỉ thẻ isImportant", () => {
    const on = filters({ importantOnly: true });

    assert.equal(filterableCardMatchesBoardFilters(card({ isImportant: true }), on), true);
    assert.equal(filterableCardMatchesBoardFilters(card({ isImportant: false }), on), false);
    assert.equal(filterableCardMatchesBoardFilters(card(), on), false);
  });

  it("kết hợp với lọc môn", () => {
    const on = filters({ importantOnly: true, selectedCourseIds: ["c1"] });

    assert.equal(filterableCardMatchesBoardFilters(card({ isImportant: true, courseId: "c1" }), on), true);
    assert.equal(filterableCardMatchesBoardFilters(card({ isImportant: true, courseId: "c2" }), on), false);
  });

  it("boardFiltersAreActive tính cả importantOnly", () => {
    assert.equal(boardFiltersAreActive(filters()), false);
    assert.equal(boardFiltersAreActive(filters({ importantOnly: true })), true);
  });
});
