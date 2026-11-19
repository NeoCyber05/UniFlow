import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";

import type { BoardCalendarResponse, BoardCalendarUnscheduledCard } from "@/types";

import { applyCalendarPatchToCache, applyCardPatchToCalendar } from "./optimistic-card-patch";

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
const base: BoardCalendarResponse = { boardId: "b1", from: "", to: "", items: [], unscheduledCards: [] };

test("a range adds a card from the separate tray without storing a tray copy", () => {
  const next = applyCardPatchToCalendar(base, "c1", {
    scheduledOn: "2026-11-18", scheduledStartAt: null, scheduledEndAt: null,
  }, tray);

  assert.equal(next.items.length, 1);
  assert.deepEqual(next.unscheduledCards, []);
  assert.deepEqual(
    next.items.map((item) => item.type === "card" && [item.id, item.scheduledOn, item.title]),
    [["card:c1", "2026-11-18", "Tập gym"]],
  );
});

test("a card already in items is patched, not duplicated", () => {
  const withItem = applyCardPatchToCalendar(base, "c1", { scheduledOn: "2026-11-18" }, tray);
  const moved = applyCardPatchToCalendar(withItem, "c1", { scheduledOn: "2026-11-19" }, tray);

  assert.equal(moved.items.length, 1);
  assert.equal(moved.items[0].type === "card" && moved.items[0].scheduledOn, "2026-11-19");
});

test("a non-schedule patch keeps a card in the tray and updates its visible state", () => {
  const cache = new QueryClient();
  const trayKey = ["board-calendar", "b1", "unscheduled"];
  cache.setQueryData(trayKey, [tray]);
  applyCalendarPatchToCache(cache, "b1", "c1", { isCompleted: true });

  assert.deepEqual(cache.getQueryData(trayKey), [{ ...tray, isCompleted: true }]);
  cache.clear();
});

test("scheduling a card updates the shared tray and range caches together", () => {
  const cache = new QueryClient();
  const trayKey = ["board-calendar", "b1", "unscheduled"];
  const rangeKey = ["board-calendar", "b1", "range", "day", "from", "to"];
  const otherTrayKey = ["board-calendar", "b2", "unscheduled"];
  cache.setQueryData(trayKey, [tray]);
  cache.setQueryData(otherTrayKey, [{ ...tray, boardId: "b2" }]);
  cache.setQueryData(rangeKey, base);

  applyCalendarPatchToCache(cache, "b1", "c1", { scheduledOn: "2026-11-18" });

  assert.deepEqual(cache.getQueryData(trayKey), []);
  assert.equal(cache.getQueryData<BoardCalendarUnscheduledCard[]>(otherTrayKey)?.length, 1);
  assert.deepEqual(cache.getQueryData<BoardCalendarResponse>(rangeKey)?.items.map(({ id }) => id), ["card:c1"]);
  cache.clear();
});
