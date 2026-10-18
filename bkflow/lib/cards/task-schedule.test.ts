import assert from "node:assert/strict";
import test from "node:test";

import { CreateCard } from "@/actions/cards/create-card/schema";
import { QuickAddCard } from "@/actions/cards/quick-add-card/schema";
import { UpdateCard } from "@/lib/cards/update-card-contract";
import {
  TaskDeadlineSchema,
  TaskScheduleSchema,
  validateTaskSchedule,
} from "@/lib/cards/task-schedule";

const empty = { scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null };
const dueDate = "2026-10-20T10:30:00.000Z";
const slot = {
  scheduledOn: null,
  scheduledStartAt: "2026-10-19T12:00:00.000Z",
  scheduledEndAt: "2026-10-19T13:00:00.000Z",
};

test("changing the work slot does not change the deadline", () => {
  const deadline = { dueDate, deadlineOn: null };
  const moved = {
    ...slot,
    scheduledStartAt: "2026-10-20T12:00:00.000Z",
    scheduledEndAt: "2026-10-20T13:00:00.000Z",
  };
  assert.equal(validateTaskSchedule(slot), null);
  assert.equal(validateTaskSchedule(moved), null);
  assert.equal(TaskDeadlineSchema.safeParse(deadline).data?.dueDate, dueDate);
});

test("accepts empty and date-only schedule", () => {
  assert.equal(validateTaskSchedule(empty), null);
  assert.equal(
    validateTaskSchedule({ ...empty, scheduledOn: "2026-10-19" }),
    null,
  );
});

test("rejects invalid schedules", () => {
  assert.notEqual(validateTaskSchedule({ ...slot, scheduledEndAt: null }), null);
  assert.notEqual(validateTaskSchedule({ ...slot, scheduledStartAt: null }), null);
  assert.notEqual(
    validateTaskSchedule({ ...slot, scheduledEndAt: slot.scheduledStartAt }),
    null,
  );
  assert.notEqual(
    validateTaskSchedule({ ...slot, scheduledEndAt: "2026-10-19T11:00:00.000Z" }),
    null,
  );
  assert.notEqual(validateTaskSchedule({ ...slot, scheduledOn: "2026-10-19" }), null);
  assert.equal(
    TaskScheduleSchema.safeParse({ ...empty, scheduledOn: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    TaskScheduleSchema.safeParse({ ...empty, scheduledStartAt: "2026-10-19T12:00:00" })
      .success,
    false,
  );
});

test("deadline schema rejects both forms and invalid dates", () => {
  assert.equal(
    TaskDeadlineSchema.safeParse({ dueDate, deadlineOn: "2026-10-20" }).success,
    false,
  );
  assert.equal(
    TaskDeadlineSchema.safeParse({ dueDate: null, deadlineOn: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    TaskDeadlineSchema.safeParse({ dueDate: null, deadlineOn: "2026-10-18" }).success,
    true,
  );
  assert.equal(TaskDeadlineSchema.safeParse({ dueDate: null, deadlineOn: null }).success, true);
});

test("rejects whitespace-only task title", () => {
  assert.equal(CreateCard.safeParse({ title: "   ", boardId: "b1", listId: "l1" }).success, false);
  assert.equal(UpdateCard.safeParse({ title: "   ", boardId: "b1", id: "c1" }).success, false);
  assert.equal(QuickAddCard.safeParse({ title: "   " }).success, false);
});

test("trims task title on create and update", () => {
  const c = CreateCard.safeParse({ title: " Đọc bài A ", boardId: "b1", listId: "l1" });
  assert.equal(c.data?.title, "Đọc bài A");
  const u = UpdateCard.safeParse({ title: " Đọc bài A ", boardId: "b1", id: "c1", expectedUpdatedAt: "2026-10-18T03:00:00.000Z" });
  assert.equal(u.data?.title, "Đọc bài A");
  assert.equal(QuickAddCard.safeParse({ title: " Đọc bài A " }).data?.title, "Đọc bài A");
});
