import assert from "node:assert/strict";
import { test } from "node:test";

import type { BoardCalendarResponse, BoardCalendarUnscheduledCard } from "@/types";

import { applyCardPatchToCalendar } from "./optimistic-card-patch";

const tray: BoardCalendarUnscheduledCard = {
  type: "unscheduled-card",
  id: "unscheduled-card:c1",
  cardId: "c1",
  boardId: "b1",
  listId: "l1",
  listTitle: "Cần làm",
  title: "Tập gym",
  updatedAt: "2026-11-17T00:00:00.000Z",
  isCompleted: false,
  labels: [],
  assignees: [],
  commentCount: 0,
  order: 1,
  listOrder: 1,
};
const base: BoardCalendarResponse = { boardId: "b1", from: "", to: "", items: [], unscheduledCards: [tray] };

test("scheduling an unscheduled card moves it from the tray into items", () => {
  const next = applyCardPatchToCalendar(base, "c1", { scheduledOn: "2026-11-18", scheduledStartAt: null, scheduledEndAt: null });

  assert.equal(next.unscheduledCards.length, 0);
  assert.equal(next.items.length, 1);
  assert.deepEqual(
    next.items.map((item) => item.type === "card" && [item.id, item.scheduledOn, item.title]),
    [["card:c1", "2026-11-18", "Tập gym"]],
  );
});

test("a card already in items is patched, not duplicated", () => {
  const withItem = applyCardPatchToCalendar(base, "c1", { scheduledOn: "2026-11-18" });
  const moved = applyCardPatchToCalendar({ ...withItem, unscheduledCards: [tray] }, "c1", { scheduledOn: "2026-11-19" });

  assert.equal(moved.items.length, 1);
  assert.equal(moved.unscheduledCards.length, 0);
});

test("a non-schedule patch leaves the tray alone", () => {
  const next = applyCardPatchToCalendar(base, "c1", { isCompleted: true });

  assert.equal(next.unscheduledCards.length, 1);
  assert.equal(next.items.length, 0);
});
