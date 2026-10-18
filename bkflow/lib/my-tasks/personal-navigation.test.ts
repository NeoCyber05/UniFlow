import assert from "node:assert/strict";
import { it } from "node:test";
import { getPersonalBoardDestination } from "./personal-navigation";

it("keeps current and legacy personal board destinations", () => {
  assert.equal(getPersonalBoardDestination("tasks", "board-1"), "/board/board-1/list?group=agenda");
  assert.equal(getPersonalBoardDestination("calendar", "board-1"), "/board/board-1/calendar");
  assert.equal(getPersonalBoardDestination("important", "board-1"), "/board/board-1/list?group=agenda&important=1");
  assert.equal(getPersonalBoardDestination("upcoming", "board-1"), "/board/board-1/list?group=agenda");
  assert.equal(getPersonalBoardDestination("today", "board-1"), null);
  assert.equal(getPersonalBoardDestination("courses", "board-1"), null);
  assert.equal(getPersonalBoardDestination("unknown", "board-1"), null);
});
