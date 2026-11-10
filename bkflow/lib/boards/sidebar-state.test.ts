import assert from "node:assert/strict";
import { test } from "node:test";
import { useBoardSidebar } from "@/hooks/use-board-sidebar";

test("calendar rail expands independently of the saved sidebar preference", () => {
  const initial = useBoardSidebar.getState();
  assert.equal(initial.calendarExpanded, false);
  try {
    initial.toggleCalendar();
    assert.equal(useBoardSidebar.getState().calendarExpanded, true);
    assert.equal(useBoardSidebar.getState().isOpen, initial.isOpen);
    useBoardSidebar.getState().toggleCalendar();
    assert.equal(useBoardSidebar.getState().calendarExpanded, false);
  } finally {
    useBoardSidebar.setState({ calendarExpanded: false });
  }
});
