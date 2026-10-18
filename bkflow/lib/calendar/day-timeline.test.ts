import assert from "node:assert/strict";
import test from "node:test";

import type { CalendarEntry } from "./calendar-entries";
import { buildDayTimeline } from "./day-timeline";

// Giờ VN = UTC+7. 18/10 VN 09:00 = 02:00Z.
const vn = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);

  return new Date(Date.UTC(2026, 9, day, h - 7, m)).toISOString();
};
const work = (key: string, start: string, end: string, cardId = key): CalendarEntry => ({
  key, cardId, kind: "work", startsAt: start, endsAt: end, day: null,
});
const marker = (key: string, at: string, kind: CalendarEntry["kind"] = "deadline"): CalendarEntry => ({
  key, cardId: key, kind, startsAt: at, endsAt: null, day: null,
});

test("merges occupied intervals before finding gaps", () => {
  const result = buildDayTimeline(
    [
      work("a", vn(18, "09:00"), vn(18, "10:00")),
      work("b", vn(18, "09:30"), vn(18, "11:00")),
      work("c", vn(18, "13:00"), vn(18, "14:00")),
      marker("d", vn(18, "12:00")),
    ],
    "2026-10-18",
  );

  assert.deepEqual(result.gaps.map((g) => g.minutes), [120]);
  assert.equal(result.gaps[0].startsAt, vn(18, "11:00"));
  assert.equal(result.gaps[0].endsAt, vn(18, "13:00"));
  assert.equal(result.markers.length, 1);
  // a và b cùng cụm chồng lấn, c cụm riêng.
  const group = Object.fromEntries(result.work.map((w) => [w.key, w.overlapGroup]));
  assert.equal(group.a, group.b);
  assert.notEqual(group.a, group.c);
});

test("containment, same start, touching, none and one session produce no bogus gaps", () => {
  const day = "2026-10-18";

  // Buổi chứa buổi khác + cùng giờ đầu.
  assert.deepEqual(
    buildDayTimeline([
      work("a", vn(18, "09:00"), vn(18, "12:00")),
      work("b", vn(18, "10:00"), vn(18, "11:00")),
      work("c", vn(18, "09:00"), vn(18, "09:30")),
    ], day).gaps,
    [],
  );
  // Tiếp giáp: không gap 0 phút.
  assert.deepEqual(
    buildDayTimeline([work("a", vn(18, "09:00"), vn(18, "10:00")), work("b", vn(18, "10:00"), vn(18, "11:00"))], day).gaps,
    [],
  );
  assert.deepEqual(buildDayTimeline([], day).gaps, []);
  assert.deepEqual(buildDayTimeline([work("a", vn(18, "09:00"), vn(18, "10:00"))], day).gaps, []);
  // Chỉ marker: không gap đầu/cuối ngày.
  const markerOnly = buildDayTimeline([marker("m", vn(18, "17:30"))], day);
  assert.deepEqual(markerOnly.gaps, []);
  assert.equal(markerOnly.work.length, 0);
});

test("same start time sorts stably by key", () => {
  const result = buildDayTimeline(
    [work("b", vn(18, "09:00"), vn(18, "10:00")), work("a", vn(18, "09:00"), vn(18, "10:00"))],
    "2026-10-18",
  );

  assert.deepEqual(result.work.map((w) => w.key), ["a", "b"]);
});

test("clips sessions across midnight per day without altering the source", () => {
  const entries = [work("x", vn(18, "23:30"), vn(19, "00:30"), "card-1")];
  const first = buildDayTimeline(entries, "2026-10-18");
  const second = buildDayTimeline(entries, "2026-10-19");

  assert.equal(first.work.length, 1);
  assert.equal(second.work.length, 1);
  for (const [segment] of [first.work, second.work]) {
    assert.equal(segment.cardId, "card-1");
    assert.equal(segment.durationMinutes, 60);
    assert.equal((Date.parse(segment.clippedEnd) - Date.parse(segment.clippedStart)) / 60_000, 30);
  }
  assert.equal(entries[0].endsAt, vn(19, "00:30"));

  // Kết thúc đúng 00:00 thì không xuất hiện ở ngày kế.
  const endsAtMidnight = [work("y", vn(18, "23:00"), vn(19, "00:00"))];
  assert.equal(buildDayTimeline(endsAtMidnight, "2026-10-19").work.length, 0);
  assert.equal(buildDayTimeline(endsAtMidnight, "2026-10-18").work.length, 1);
});

test("deadlines never take duration or overlap lanes; date-only entries go to allDay", () => {
  const result = buildDayTimeline(
    [
      work("a", vn(18, "09:00"), vn(18, "10:00")),
      marker("d", vn(18, "09:30")),
      { key: "w", cardId: "w", kind: "work-day", startsAt: null, endsAt: null, day: "2026-10-18" },
      { key: "dd", cardId: "dd", kind: "deadline-day", startsAt: null, endsAt: null, day: "2026-10-19" },
    ],
    "2026-10-18",
  );

  assert.equal(result.work.length, 1);
  assert.equal(result.work[0].durationMinutes, 60);
  assert.deepEqual(result.markers.map((m) => m.key), ["d"]);
  assert.deepEqual(result.allDay.map((m) => m.key), ["w"]);
});

test("ignores invalid work intervals", () => {
  const result = buildDayTimeline([work("a", vn(18, "10:00"), vn(18, "09:00"))], "2026-10-18");

  assert.equal(result.work.length, 0);
});
