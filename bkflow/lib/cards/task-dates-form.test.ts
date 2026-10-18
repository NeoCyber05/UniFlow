import assert from "node:assert/strict";
import test from "node:test";

import { buildTaskDatesPatch, taskDatesToForm, type TaskDatesForm } from "./task-dates-form";

const empty: TaskDatesForm = {
  deadlineDate: "", deadlineTime: "", scheduleStartDate: "", scheduleStartTime: "",
  scheduleEndDate: "", scheduleEndTime: "", reminder: "none",
};

test("deadline with time vs date-only are exclusive", () => {
  const timed = buildTaskDatesPatch({ ...empty, deadlineDate: "2026-10-20", deadlineTime: "17:30" });
  assert.ok("patch" in timed);
  assert.equal(timed.patch.dueDate?.toISOString(), "2026-10-20T10:30:00.000Z");
  assert.equal(timed.patch.deadlineOn, null);

  const dateOnly = buildTaskDatesPatch({ ...empty, deadlineDate: "2026-10-20" });
  assert.ok("patch" in dateOnly);
  assert.equal(dateOnly.patch.dueDate, null);
  assert.equal(dateOnly.patch.deadlineOn, "2026-10-20");
});

test("schedule: date only, range, midnight crossing, invalid", () => {
  const day = buildTaskDatesPatch({ ...empty, scheduleStartDate: "2026-10-19" });
  assert.ok("patch" in day);
  assert.deepEqual([day.patch.scheduledOn, day.patch.scheduledStartAt], ["2026-10-19", null]);

  const range = buildTaskDatesPatch({ ...empty, scheduleStartDate: "2026-10-19", scheduleStartTime: "19:00", scheduleEndTime: "20:00" });
  assert.ok("patch" in range);
  assert.equal(range.patch.scheduledStartAt, "2026-10-19T12:00:00.000Z");
  assert.equal(range.patch.scheduledEndAt, "2026-10-19T13:00:00.000Z");

  const overnight = buildTaskDatesPatch({ ...empty, scheduleStartDate: "2026-10-19", scheduleStartTime: "23:00", scheduleEndDate: "2026-10-20", scheduleEndTime: "01:00" });
  assert.ok("patch" in overnight);
  assert.equal(overnight.patch.scheduledEndAt, "2026-10-19T18:00:00.000Z");

  assert.ok("error" in buildTaskDatesPatch({ ...empty, scheduleStartDate: "2026-10-19", scheduleStartTime: "19:00" }));
  assert.ok("error" in buildTaskDatesPatch({ ...empty, scheduleStartDate: "2026-10-19", scheduleStartTime: "20:00", scheduleEndTime: "19:00" }));
  assert.ok("error" in buildTaskDatesPatch({ ...empty, scheduleStartTime: "19:00", scheduleEndTime: "20:00" }));
});

test("moving the session never touches deadline; session after deadline warns but saves", () => {
  const result = buildTaskDatesPatch({
    ...empty, deadlineDate: "2026-10-20", deadlineTime: "17:30",
    scheduleStartDate: "2026-10-21", scheduleStartTime: "09:00", scheduleEndTime: "10:00",
  });
  assert.ok("patch" in result);
  assert.ok(result.warning);
  assert.equal(result.patch.dueDate?.toISOString(), "2026-10-20T10:30:00.000Z");
});

test("round trip stored values to form in VN time", () => {
  const form = taskDatesToForm({
    dueDate: "2026-10-20T10:30:00.000Z", deadlineOn: null, scheduledOn: null,
    scheduledStartAt: "2026-10-19T12:00:00.000Z", scheduledEndAt: "2026-10-19T13:00:00.000Z", reminder: null,
  });
  assert.equal(form.deadlineDate, "2026-10-20");
  assert.equal(form.deadlineTime, "17:30");
  assert.equal(form.scheduleStartTime, "19:00");
  assert.equal(form.scheduleEndTime, "20:00");
  assert.equal(form.scheduleEndDate, "2026-10-19");
});
