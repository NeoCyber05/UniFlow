/* eslint-disable @typescript-eslint/no-explicit-any -- Transactional database double; no live DB or AI calls. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { applySchedulePreview, generateSchedulePreview } from "./ai-schedule-server";

const now = new Date("2030-01-10T00:00:00Z");
const input = { boardId: "b", cardIds: ["a", "b"], prompt: "Ưu tiên buổi sáng", fromDay: "2030-01-10", toDay: "2030-01-16", dayStart: "08:00", dayEnd: "18:00" };
const makeCard = (id: string) => ({ id, title: id, description: "Task context", updatedAt: new Date("2030-01-09T00:00:00Z"), dueDate: null, deadlineOn: null, scheduledOn: null, scheduledStartAt: null, scheduledEndAt: null });
const slots = ["a", "b"].map((cardId, i) => ({ cardId, startsAt: `2030-01-10T0${i + 1}:00:00Z`, endsAt: `2030-01-10T0${i + 2}:00:00Z`, expectedUpdatedAt: "2030-01-09T00:00:00Z" }));

const fakeDb = ({ owner = true, stale = false, conflict = false, busy = [] as any[] } = {}) => {
  let cards = [makeCard("a"), makeCard("b")];
  const writes: any[] = [];
  let reads = 0;
  const database = {
    board: { findFirst: async (query: any) => { assert.equal(query.where.userId, "u"); return owner ? { id: "b", userId: "u" } : null; } },
    card: {
      findMany: async ({ where }: any) => {
        reads++;
        assert.equal(where.list.board.userId, "u");
        if (!where.id) {
          assert.equal(where.isCompleted, undefined, "existing sessions keep their time even when the task is complete");
          return busy;
        }
        assert.equal(where.list.board.id, "b");
        assert.equal(where.isCompleted, false);
        if (where.scheduledStartAt === null) assert.equal(where.scheduledOn, null);
        return cards.filter(card => where.id.in.includes(card.id)).map(card => ({ ...card, updatedAt: stale ? now : card.updatedAt }));
      },
      updateMany: async ({ where, data }: any) => {
        assert.equal(where.list.board.userId, "u");
        assert.ok(where.updatedAt instanceof Date);
        writes.push(data);
        if (conflict && where.id === "b") return { count: 0 };
        cards = cards.map(card => card.id === where.id ? { ...card, ...data } : card);
        return { count: 1 };
      },
    },
    $transaction: async (run: any, options: any) => {
      assert.equal(options.isolationLevel, "Serializable");
      const before = structuredClone(cards);
      try { return await run(database); } catch (error) { cards = before; throw error; }
    },
  };
  return { database: database as unknown as PrismaClient, writes, get cards() { return cards; }, get reads() { return reads; } };
};

test("generation is read-only, scopes IDs and busy sessions, and stamps server revisions", async () => {
  const fake = fakeDb();
  const preview = await generateSchedulePreview(input, "u", fake.database, async request => {
    const payload = JSON.parse(request.user);
    assert.equal(payload.timeZone, "Asia/Ho_Chi_Minh");
    assert.equal(payload.prompt, input.prompt);
    return JSON.stringify({ summary: "Xếp buổi sáng", slots: [{ ...slots[0], reason: "Ưu tiên buổi sáng" }] });
  }, now);
  assert.equal(preview.slots[0].title, "a");
  assert.equal(Date.parse(preview.slots[0].expectedUpdatedAt), Date.parse(slots[0].expectedUpdatedAt));
  assert.equal(fake.writes.length, 0);
});

test("drops slots outside free hours but keeps the valid ones", async () => {
  const fake = fakeDb();
  const preview = await generateSchedulePreview(input, "u", fake.database, async () => JSON.stringify({ summary: "Xếp", slots: [
    { ...slots[0], reason: "" },
    { cardId: "b", startsAt: "2030-01-10T20:00:00+07:00", endsAt: "2030-01-10T21:00:00+07:00", reason: "" },
  ] }), now);
  assert.deepEqual(preview.slots.map(slot => slot.cardId), ["a"]);
  assert.match(preview.summary, /bỏ 1 buổi/);
});

test("rejects non-owners before reading tasks or calling AI", async () => {
  const fake = fakeDb({ owner: false });
  await assert.rejects(() => generateSchedulePreview(input, "u", fake.database, async () => { assert.fail("AI must not be called"); }, now));
  await assert.rejects(() => applySchedulePreview({ ...input, slots }, "u", fake.database, async () => {}, now));
  assert.equal(fake.reads, 0);
  assert.equal(fake.writes.length, 0);
});

test("applies only schedule fields and emits updates after success", async () => {
  const fake = fakeDb();
  const events: string[] = [];
  await applySchedulePreview({ ...input, slots }, "u", fake.database, async event => { events.push(event.cardId); }, now);
  assert.deepEqual(events, ["a", "b"]);
  assert.deepEqual(Object.keys(fake.writes[0]).sort(), ["scheduledEndAt", "scheduledOn", "scheduledStartAt"]);
  assert.ok(fake.cards.every(card => card.scheduledStartAt));
});

test("stale previews and newly occupied slots are refused before writing", async () => {
  for (const fake of [fakeDb({ stale: true }), fakeDb({ busy: [{ ...makeCard("other"), scheduledStartAt: new Date(slots[0].startsAt), scheduledEndAt: new Date(slots[0].endsAt) }] })]) {
    await assert.rejects(() => applySchedulePreview({ ...input, slots }, "u", fake.database, async () => { assert.fail("no event on failure"); }, now));
    assert.equal(fake.writes.length, 0);
  }
});

test("a concurrent change rolls back the whole group and emits no event", async () => {
  const fake = fakeDb({ conflict: true });
  await assert.rejects(() => applySchedulePreview({ ...input, slots }, "u", fake.database, async () => { assert.fail("no event on rollback"); }, now));
  assert.equal(fake.writes.length, 2);
  assert.ok(fake.cards.every(card => card.scheduledStartAt === null));
});

test("date-only sessions block the whole Vietnam day across boards", async () => {
  const fake = fakeDb({ busy: [{ scheduledOn: new Date("2030-01-10T00:00:00Z"), scheduledStartAt: null, scheduledEndAt: null }] });
  await assert.rejects(() => generateSchedulePreview(input, "u", fake.database, async request => {
    const payload = JSON.parse(request.user);
    assert.deepEqual(payload.busy, [{ startsAt: "2030-01-09T17:00:00.000Z", endsAt: "2030-01-10T17:00:00.000Z" }]);
    return JSON.stringify({ summary: "Invalid occupied day", slots: [{ ...slots[0], reason: "" }] });
  }, now), /trùng/);
});

test("rejects missing, archived or already scheduled candidates and invented model IDs", async () => {
  const fake = fakeDb();
  await assert.rejects(() => generateSchedulePreview({ ...input, cardIds: ["missing"] }, "u", fake.database, async () => { assert.fail("no AI for missing tasks"); }, now), /không còn/);
  await assert.rejects(() => generateSchedulePreview(input, "u", fake.database, async () => JSON.stringify({ summary: "Invalid ID", slots: [{ ...slots[0], cardId: "foreign", reason: "" }] }), now), /thẻ/);
  assert.equal(fake.writes.length, 0);
});
