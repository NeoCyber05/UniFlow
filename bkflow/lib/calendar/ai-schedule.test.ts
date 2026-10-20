import assert from "node:assert/strict";
import { test } from "node:test";
import { ApplyAiSchedule, GenerateAiSchedule, SchedulePreferences, validateScheduleSlots, type ScheduleCandidate } from "./ai-schedule";

const preferences = { fromDay: "2030-01-10", toDay: "2030-01-16", dayStart: "08:00", dayEnd: "18:00" };
const now = new Date("2030-01-10T00:00:00Z");
const candidate: ScheduleCandidate = { id: "a", title: "Task", updatedAt: "2030-01-09T00:00:00Z", dueDate: null, deadlineOn: null };
const slot = { cardId: "a", startsAt: "2030-01-10T01:00:00Z", endsAt: "2030-01-10T02:00:00Z" };
const validate = (slots = [slot], candidates = [candidate], busy = [] as { startsAt: string; endsAt: string }[]) => validateScheduleSlots({ slots, candidates, busy, preferences, now });

test("accepts adjacent work sessions in Vietnam time and partial proposals", () => {
  assert.equal(validate([slot], [candidate, { ...candidate, id: "b" }], [{ startsAt: slot.endsAt, endsAt: "2030-01-10T03:00:00Z" }]), null);
  assert.equal(validate([]), null);
});

test("rejects invented and duplicate IDs and both kinds of overlap", () => {
  assert.match(validate([{ ...slot, cardId: "foreign" }])!, /thẻ/);
  assert.match(validate([slot, slot])!, /lặp/);
  assert.match(validate([slot], [candidate], [{ startsAt: "2030-01-10T01:30:00Z", endsAt: "2030-01-10T03:00:00Z" }])!, /trùng/);
  assert.match(validate([slot, { ...slot, cardId: "b" }], [candidate, { ...candidate, id: "b" }])!, /trùng/);
});

test("rejects past, reversed, out-of-range and outside daily availability slots", () => {
  for (const bad of [
    { startsAt: "2030-01-09T01:00:00Z", endsAt: "2030-01-09T02:00:00Z" },
    { startsAt: slot.endsAt, endsAt: slot.startsAt },
    { startsAt: "2030-01-17T01:00:00Z", endsAt: "2030-01-17T02:00:00Z" },
    { startsAt: "2030-01-10T00:00:00Z", endsAt: slot.endsAt },
    { startsAt: "2030-01-10T10:00:00Z", endsAt: "2030-01-10T12:00:00Z" },
  ]) assert.ok(validate([{ ...slot, ...bad }]));
});

test("honors timed and date-only future deadlines but can plan overdue work", () => {
  assert.match(validate([slot], [{ ...candidate, dueDate: "2030-01-10T01:30:00Z" }])!, /hạn/);
  assert.equal(validate([slot], [{ ...candidate, deadlineOn: "2030-01-10" }]), null);
  assert.match(validate([{ ...slot, startsAt: "2030-01-11T01:00:00Z", endsAt: "2030-01-11T02:00:00Z" }], [{ ...candidate, deadlineOn: "2030-01-10" }])!, /hạn/);
  assert.equal(validate([slot], [{ ...candidate, dueDate: "2030-01-09T01:30:00Z" }]), null);
});

test("validates real dates, date order, 31-day cap and daily time order", () => {
  assert.ok(SchedulePreferences.safeParse(preferences).success);
  for (const change of [{ fromDay: "2030-02-30" }, { toDay: "2030-01-09" }, { toDay: "2030-02-10" }, { dayEnd: "07:00" }, { dayStart: "25:00" }]) {
    assert.equal(SchedulePreferences.safeParse({ ...preferences, ...change }).success, false);
  }
  const request = { boardId: "b", cardIds: ["a"], prompt: "", ...preferences, toDay: "2030-01-09" };
  assert.equal(GenerateAiSchedule.safeParse(request).success, false);
  assert.equal(ApplyAiSchedule.safeParse({ ...request, slots: [{ ...slot, expectedUpdatedAt: now.toISOString() }] }).success, false);
  assert.equal(GenerateAiSchedule.safeParse({ ...request, toDay: preferences.toDay, cardIds: Array.from({ length: 21 }, (_, i) => String(i)) }).success, false);
});
