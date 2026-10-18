import assert from "node:assert/strict";
import { test } from "node:test";
import { getMonthGridRange, getWeekGridRange, getDayKey, copyDateToDay, copyRangeEndToDay, parseGmt7DateTimeInput } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_lib/date-utils";
import { getRanges, getOccurrences } from "@/app/(platform)/(dashboard)/board/[boardId]/calendar/_lib/range-layout";
import type { BoardCalendarCardItem } from "@/types";
import { calendarItemMatchesBoardFilters, unscheduledCardMatchesBoardFilters } from "@/lib/boards/board-filters";
import { emptyBoardFilters } from "@/hooks/use-board-filters";
import { toCalendarDisplayItems } from "./schedule-adapter";

test("month/week cells and day movement use Vietnam dates in every browser timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = zone;
      const anchor = new Date("2026-10-18T18:00:00Z"); // Monday in Vietnam
      const week = getWeekGridRange(anchor);
      assert.equal(getDayKey(week.days[0]), "2026-10-19", zone);
      assert.equal(getDayKey(week.days[6]), "2026-10-25", zone);
      const month = getMonthGridRange(anchor);
      assert.equal(getDayKey(month.days[0]), "2026-09-28", zone);
      assert.equal(getDayKey(month.days.at(-1)!), "2026-11-01", zone);
      assert.equal(copyDateToDay(new Date("2026-10-18T18:30:00Z"), new Date("2026-10-20T17:00:00Z")).toISOString(), "2026-10-20T18:30:00.000Z", zone);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("month/week range ending at midnight does not occupy the following day", () => {
  const item = { type: "card", id: "work", cardId: "c1", title: "Work", startDate: "2026-10-18T16:30:00Z", dueDate: "2026-10-18T17:00:00Z" } as BoardCalendarCardItem;
  assert.equal(getRanges([item]).length, 0);
  assert.equal(getOccurrences([item]).length, 1);
  assert.equal(getDayKey(getOccurrences([item])[0].date), "2026-10-18");
});

test("invalid datetime does not roll into another date", () => {
  assert.equal(parseGmt7DateTimeInput("2026-02-30T10:00"), null);
  assert.equal(parseGmt7DateTimeInput("2026-10-19T25:00"), null);
});

test("resizing a range ending at exclusive midnight includes the selected end day", () => {
  const end = new Date("2026-10-20T17:00:00Z"); // Oct21 00:00, occupies through Oct20
  const target = new Date("2026-10-21T05:00:00Z"); // selected Oct21
  assert.equal(copyRangeEndToDay(end, target).toISOString(), "2026-10-21T17:00:00.000Z");
  assert.equal(copyRangeEndToDay(new Date("2026-10-20T17:30:00Z"), target).toISOString(), "2026-10-20T17:30:00.000Z");
});

test("deadline filters inspect the deadline, not the work session or tray membership", () => {
  const filters = { ...emptyBoardFilters, selectedDueDateFilters: ["no-due"] };
  const card = { type: "card", id: "c1", cardId: "c1", boardId: "b", listTitle: "L", scheduledOn: null, updatedAt: "2026-10-19T00:00:00Z", reminder: null, commentCount: 0, listId: "l", title: "Work", dueDate: null, deadlineOn: null, startDate: null, scheduledStartAt: "2026-10-19T02:00:00Z", scheduledEndAt: "2026-10-19T03:00:00Z", labels: [], assignees: [], isCompleted: false } as BoardCalendarCardItem;
  assert.equal(calendarItemMatchesBoardFilters(toCalendarDisplayItems(card)[0], filters), true);
  assert.equal(unscheduledCardMatchesBoardFilters({ ...card, type: "unscheduled-card", dueDate: "2026-10-20T10:30:00Z" } as never, filters), false);
});
