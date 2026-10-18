/* eslint-disable @typescript-eslint/no-explicit-any -- fake DB/effects */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CARD_CONFLICT_ERROR_CODE,
  DESCRIPTION_CONFLICT_ERROR_CODE,
  updateCardService,
  type CardUpdateEffects,
} from "./card-update-service";
import { UpdateCard } from "./update-card-contract";

const T0 = new Date("2026-10-18T03:00:00.000Z");
const baseCard = {
  id: "c1",
  title: "Đọc bài A",
  description: null,
  descriptionUpdatedAt: T0,
  startDate: null,
  dueDate: new Date("2026-10-20T10:30:00.000Z"),
  deadlineOn: null as Date | null,
  scheduledOn: null,
  scheduledStartAt: new Date("2026-10-19T12:00:00.000Z"),
  scheduledEndAt: new Date("2026-10-19T13:00:00.000Z"),
  isCompleted: false,
  reminder: "1h_before",
  reminderSetAt: new Date("2026-10-18T02:00:00.000Z") as Date | null,
  updatedAt: T0,
};

const setup = (opts: { owner?: boolean } = {}) => {
  const state = { card: { ...baseCard }, writes: [] as any[], effects: [] as string[] };
  const database: any = {
    board: {
      findFirst: async () => (opts.owner === false ? null : { id: "b1", title: "B", userId: "u1" }),
    },
    card: {
      findFirst: async () => ({ ...state.card }),
      updateMany: async ({ where, data }: any) => {
        if (where.updatedAt && where.updatedAt.getTime() !== state.card.updatedAt.getTime()) return { count: 0 };
        if (
          where.descriptionUpdatedAt &&
          where.descriptionUpdatedAt.getTime() !== state.card.descriptionUpdatedAt.getTime()
        ) {
          return { count: 0 };
        }
        state.writes.push(data);
        state.card = { ...state.card, ...data, updatedAt: new Date(T0.getTime() + 1000) };
        return { count: 1 };
      },
    },
    cardDependency: { findMany: async () => [] },
    $transaction: async (fn: any) => fn(database),
  };
  const effects: CardUpdateEffects = {
    createAuditLog: (async (input: any) => { state.effects.push(`audit:${input.entityTitle}`); }) as any,
    triggerCardUpdated: (async () => { state.effects.push("realtime"); }) as any,
    triggerRelatedDependencyCardsUpdated: (async () => { state.effects.push("related"); }) as any,
    deleteCardReminderNotifications: (async () => { state.effects.push("delete-reminders"); }) as any,
    syncCardReminder: (async (_tx: any, input: any) => { state.effects.push(`sync:${input.cardId}`); }) as any,
  };
  return { state, database, effects };
};

const run = async (data: any, ctx = setup()) => {
  const result = await updateCardService(
    { data: { id: "c1", boardId: "b1", ...data }, userId: "u1" },
    ctx.database,
    ctx.effects,
  );
  return { result, state: ctx.state };
};

test("rejects stale metadata without changing deadline", async () => {
  const { result, state } = await run({
    title: "Mới",
    expectedUpdatedAt: new Date(T0.getTime() - 5000).toISOString(),
  });
  assert.equal(result.errorCode, CARD_CONFLICT_ERROR_CODE);
  assert.equal(state.card.dueDate?.toISOString(), baseCard.dueDate.toISOString());
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.effects, []);
});

test("rejects metadata change without expectedUpdatedAt", async () => {
  const { result, state } = await run({ isCompleted: true });
  assert.equal(result.errorCode, CARD_CONFLICT_ERROR_CODE);
  assert.deepEqual(state.writes, []);
});

test("description base must equal current revision, future timestamp rejected", async () => {
  const future = await run({
    description: "x",
    descriptionBaseUpdatedAt: new Date(T0.getTime() + 60_000).toISOString(),
  });
  assert.equal(future.result.errorCode, DESCRIPTION_CONFLICT_ERROR_CODE);
  const old = await run({
    description: "x",
    descriptionBaseUpdatedAt: new Date(T0.getTime() - 60_000).toISOString(),
  });
  assert.equal(old.result.errorCode, DESCRIPTION_CONFLICT_ERROR_CODE);
  const ok = await run({ description: "x", descriptionBaseUpdatedAt: T0.toISOString() });
  assert.equal(ok.result.error ?? null, null);
  assert.equal(ok.state.card.description, "x");
});

test("rejects write without board permission", async () => {
  const { result, state } = await run(
    { title: "Mới", expectedUpdatedAt: T0.toISOString() },
    setup({ owner: false }),
  );
  assert.ok(result.error);
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.effects, []);
});

test("moving the work schedule keeps deadline and reminder untouched", async () => {
  const { result, state } = await run({
    scheduledStartAt: "2026-10-20T12:00:00.000Z",
    scheduledEndAt: "2026-10-20T13:00:00.000Z",
    expectedUpdatedAt: T0.toISOString(),
  });
  assert.equal(result.error ?? null, null);
  const data = state.writes[0];
  assert.equal("dueDate" in data, false);
  assert.equal("deadlineOn" in data, false);
  assert.equal("reminderSetAt" in data, false);
  assert.equal(state.card.dueDate?.toISOString(), baseCard.dueDate.toISOString());
  assert.equal(state.card.scheduledStartAt?.toISOString(), "2026-10-20T12:00:00.000Z");
  assert.equal(state.effects.includes("delete-reminders"), false);
  assert.ok(state.effects.some((e) => e.startsWith("audit:") && e.includes("lịch làm")));
});

test("schedule after the deadline is saved, not blocked", async () => {
  const { result } = await run({
    scheduledOn: "2026-12-01",
    expectedUpdatedAt: T0.toISOString(),
  });
  assert.equal(result.error ?? null, null);
});

test("invalid schedule is rejected without write", async () => {
  const { result, state } = await run({
    scheduledStartAt: "2026-10-20T13:00:00.000Z",
    scheduledEndAt: "2026-10-20T12:00:00.000Z",
    expectedUpdatedAt: T0.toISOString(),
  });
  assert.ok(result.error);
  assert.deepEqual(state.writes, []);
});

test("clearing deadline does not reopen the card and drops pending reminders", async () => {
  const ctx = setup();
  ctx.state.card.isCompleted = true;
  const { result, state } = await run({ dueDate: null, expectedUpdatedAt: T0.toISOString() }, ctx);
  assert.equal(result.error ?? null, null);
  assert.equal("isCompleted" in state.writes[0], false);
  assert.equal(state.card.isCompleted, true);
  assert.equal(state.card.reminderSetAt, null);
  assert.ok(state.effects.includes("delete-reminders"));
});

test("date-only deadline replaces timed deadline and is exclusive", async () => {
  const { result, state } = await run({ deadlineOn: "2099-01-01", expectedUpdatedAt: T0.toISOString() });
  assert.equal(result.error ?? null, null);
  assert.equal(state.card.dueDate, null);
  assert.equal(state.card.deadlineOn?.toISOString(), "2099-01-01T00:00:00.000Z");
  const both = await run({
    deadlineOn: "2099-01-01",
    dueDate: new Date("2099-01-02T00:00:00.000Z"),
    expectedUpdatedAt: T0.toISOString(),
  });
  assert.ok(both.result.error);
});

test("complete does not touch checklists (db has no checklist access)", async () => {
  const { result } = await run({ isCompleted: true, expectedUpdatedAt: T0.toISOString() });
  assert.equal(result.error ?? null, null);
});

test("contract requires expectedUpdatedAt for metadata but not description-only", () => {
  const base = { id: "c1", boardId: "b1" };
  assert.equal(UpdateCard.safeParse({ ...base, title: "x" }).success, false);
  assert.equal(UpdateCard.safeParse({ ...base, title: "x", expectedUpdatedAt: T0.toISOString() }).success, true);
  assert.equal(
    UpdateCard.safeParse({ ...base, description: "x", descriptionBaseUpdatedAt: T0.toISOString() }).success,
    true,
  );
});

test("changing the deadline is not blocked by an old legacy start date", async () => {
  const ctx = setup();
  ctx.state.card.startDate = new Date("2026-11-30T00:00:00.000Z") as any;
  const { result } = await run({ dueDate: new Date("2026-10-25T00:00:00.000Z"), expectedUpdatedAt: T0.toISOString() }, ctx);
  assert.equal(result.error ?? null, null);
});

test("reminder for a date-only deadline is validated against 09:00 VN of that day", async () => {
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const ok = await run({ deadlineOn: future, reminder: "60", expectedUpdatedAt: T0.toISOString() });
  assert.equal(ok.result.error ?? null, null);
  const past = await run({ deadlineOn: "2020-01-01", reminder: "60", expectedUpdatedAt: T0.toISOString() });
  assert.ok(past.result.error);
});

test("syncs reminder deliveries in the write transaction only when deadline, offset or completion change", async () => {
  const deadline = await run({ dueDate: new Date("2026-10-22T10:30:00.000Z"), reminder: "60", expectedUpdatedAt: T0.toISOString() });
  assert.equal(deadline.result.error, undefined);
  assert.ok(deadline.state.effects.includes("sync:c1"));
  const done = await run({ isCompleted: true, expectedUpdatedAt: T0.toISOString() });
  assert.ok(done.state.effects.includes("sync:c1"));
  const rename = await run({ title: "Tên mới", expectedUpdatedAt: T0.toISOString() });
  assert.ok(!rename.state.effects.includes("sync:c1"));
  const moveWork = await run({
    scheduledStartAt: "2026-10-19T14:00:00.000Z",
    scheduledEndAt: "2026-10-19T15:00:00.000Z",
    expectedUpdatedAt: T0.toISOString(),
  });
  assert.ok(!moveWork.state.effects.includes("sync:c1"));
});
