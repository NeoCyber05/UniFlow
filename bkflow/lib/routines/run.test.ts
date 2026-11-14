/* eslint-disable @typescript-eslint/no-explicit-any -- Database double thay cho Prisma thật. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import type { AgentRoutine, PrismaClient } from "@prisma/client";

import { createRoutine, deliverAgentMessage, runDueRoutines, runRoutine, setRoutineEnabled, startRoutineTicker } from "./run";
import { logger } from "@/lib/logger";

const previousDb = globalThis.prisma;
const now = new Date("2026-11-14T00:00:30Z");
const routine: AgentRoutine = {
  id: "r1", userId: "u1", title: "Bản tin sáng", prompt: "Tóm tắt hôm nay",
  minuteOfDay: 7 * 60, weekdays: [0, 1, 2, 3, 4, 5, 6], timeZone: "Asia/Ho_Chi_Minh",
  enabled: true, nextRunAt: new Date("2026-11-14T00:00:00Z"), lastRunAt: null,
  createdAt: new Date(0), updatedAt: new Date(0),
};

let due: AgentRoutine[];
let claimCount: number;
let updates: any[];

beforeEach(() => {
  due = [routine];
  claimCount = 1;
  updates = [];
  globalThis.prisma = {
    // lib/db thay client khi thiếu các model này (kiểm tra của môi trường dev).
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    agentRoutine: {
      findMany: async () => due,
      updateMany: async (args: any) => {
        updates.push(args);
        return { count: claimCount };
      },
    },
  } as unknown as PrismaClient;
});

afterEach(() => {
  globalThis.prisma = previousDb;
  mock.restoreAll();
  mock.timers.reset();
});

test("routine lặp: claim mốc hiện tại, dời sang mốc kế tiếp rồi mới chạy", async () => {
  const ran: string[] = [];
  await runDueRoutines(now, async (item) => { ran.push(item.id); });

  assert.deepEqual(ran, ["r1"]);
  assert.deepEqual(updates[0].where, { id: "r1", enabled: true, nextRunAt: routine.nextRunAt });
  assert.equal(updates[0].data.nextRunAt.toISOString(), "2026-11-15T00:00:00.000Z");
  assert.equal(updates[0].data.enabled, true);
  assert.equal(updates[0].data.lastRunAt, now);
});

test("lời nhắc một lần: chạy xong thì tắt", async () => {
  due = [{ ...routine, weekdays: [] }];
  const ran: string[] = [];
  await runDueRoutines(now, async (item) => { ran.push(item.id); });

  assert.deepEqual(ran, ["r1"]);
  assert.equal(updates[0].data.nextRunAt, null);
  assert.equal(updates[0].data.enabled, false);
});

test("instance khác đã claim thì không chạy lại", async () => {
  claimCount = 0;
  let ran = 0;
  await runDueRoutines(now, async () => { ran++; });
  assert.equal(ran, 0);
});

test("một routine lỗi không chặn routine sau", async () => {
  due = [routine, { ...routine, id: "r2" }];
  const ran: string[] = [];
  await runDueRoutines(now, async (item) => {
    ran.push(item.id);
    if (item.id === "r1") throw new Error("boom");
  });
  assert.deepEqual(ran, ["r1", "r2"]);
});

test("tạo lịch kiểm tra quota và ghi trong cùng transaction Serializable", async () => {
  let saved: any;
  let active = 9;
  globalThis.prisma = {
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    $transaction: async (write: any, options: any) => {
      assert.equal(options.isolationLevel, "Serializable");
      return write({ agentRoutine: {
        count: async ({ where }: any) => { assert.deepEqual(where, { userId: "u1", enabled: true }); return active; },
        create: async ({ data }: any) => { saved = data; active++; return { ...routine, ...data }; },
      } });
    },
  } as unknown as PrismaClient;
  const first = await createRoutine("u1", routine);
  assert.equal(first.data?.userId, "u1");
  assert.equal(saved.title, routine.title);
  saved = undefined;
  assert.match((await createRoutine("u1", routine)).error ?? "", /Tối đa/);
  assert.equal(saved, undefined);
});

test("bật lại lịch kiểm tra quota, không chặn tắt hoặc bật lại mục đã bật", async () => {
  let item = { ...routine, enabled: false };
  let active = 10;
  globalThis.prisma = {
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    $transaction: async (write: any, options: any) => {
      assert.equal(options.isolationLevel, "Serializable");
      return write({ agentRoutine: {
        findFirst: async ({ where }: any) => { assert.deepEqual(where, { id: "r1", userId: "u1" }); return item; },
        count: async ({ where }: any) => { assert.deepEqual(where, { userId: "u1", enabled: true }); return active; },
        updateMany: async ({ where, data }: any) => {
          assert.deepEqual(where, { id: "r1", userId: "u1" });
          item = { ...item, ...data }; return { count: 1 };
        },
      } });
    },
  } as unknown as PrismaClient;
  assert.match((await setRoutineEnabled("u1", "r1", true, now)).error ?? "", /Tối đa/);
  assert.equal(item.enabled, false);
  active = 9;
  assert.equal((await setRoutineEnabled("u1", "r1", true, now)).error, undefined);
  assert.equal(item.enabled, true);
  assert.equal(item.nextRunAt?.toISOString(), "2026-11-15T00:00:00.000Z");
  active = 10;
  assert.equal((await setRoutineEnabled("u1", "r1", true, now)).error, undefined);
  assert.equal((await setRoutineEnabled("u1", "r1", false, now)).error, undefined);
  assert.equal(item.enabled, false);
});

test("lời nhắc nguyên văn bắt đầu KHONG_CO_GI vẫn được gửi", async () => {
  const texts: string[] = [];
  globalThis.prisma = {
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    webPushSubscription: { findMany: async () => [{ channel: "discord", endpoint: "https://discord.com/api/webhooks/test" }] },
    notification: { findFirst: async () => ({ id: "existing" }) },
  } as unknown as PrismaClient;
  mock.method(globalThis, "fetch", async (_url: any, init: any) => {
    texts.push(JSON.parse(init.body).content);
    return new Response(null, { status: 204 });
  });
  await runRoutine({ ...routine, weekdays: [], prompt: "KHONG_CO_GI là mã cần ghi nhớ" }, now);
  assert.deepEqual(texts, ["⏰ Lời nhắc\nKHONG_CO_GI là mã cần ghi nhớ"]);
});

test("tin Discord được giới hạn độ dài và HTTP lỗi được ghi nhận không lộ webhook", async () => {
  const texts: string[] = [];
  const errors: unknown[] = [];
  globalThis.prisma = {
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    webPushSubscription: { findMany: async ({ where }: any) => {
      assert.deepEqual(where, { userId: "u1", active: true, channel: { not: "webpush" } });
      return [{ channel: "discord", endpoint: "https://discord.com/api/webhooks/secret" }];
    } },
    notification: { findFirst: async () => ({ id: "existing" }) },
  } as unknown as PrismaClient;
  mock.method(logger, "error", (...args: unknown[]) => { errors.push(args); });
  mock.method(globalThis, "fetch", async (_url: any, init: any) => {
    texts.push(JSON.parse(init.body).content);
    return new Response(null, { status: 429 });
  });
  await deliverAgentMessage("u1", "Bản tin", "x".repeat(3000), "key");
  assert.equal(texts[0].length, 2000);
  assert.equal(errors.length, 1);
  assert.doesNotMatch(JSON.stringify(errors), /webhooks|secret/);
});

test("ticker chỉ chạy khi bật và không chồng lượt đang xử lý", async () => {
  const savedFlag = process.env.AGENT_ROUTINES;
  let queries = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  (globalThis.prisma!.agentRoutine as any).findMany = async () => {
    queries++;
    if (queries === 1) await pending;
    return [];
  };
  mock.timers.enable({ apis: ["setInterval"] });
  mock.method(console, "log", () => {});
  try {
    delete process.env.AGENT_ROUTINES;
    startRoutineTicker();
    mock.timers.tick(60_000);
    assert.equal(queries, 0);
    process.env.AGENT_ROUTINES = "on";
    startRoutineTicker();
    mock.timers.tick(60_000);
    assert.equal(queries, 1);
    mock.timers.tick(60_000);
    assert.equal(queries, 1);
    release();
    await new Promise(resolve => setImmediate(resolve));
    mock.timers.tick(60_000);
    assert.equal(queries, 2);
    await new Promise(resolve => setImmediate(resolve));
  } finally {
    if (savedFlag === undefined) delete process.env.AGENT_ROUTINES;
    else process.env.AGENT_ROUTINES = savedFlag;
  }
});

test("lời nhắc một lần tạo thông báo đầy đủ cho đúng người mà không cần AI", async () => {
  const notifications: any[] = [];
  globalThis.prisma = {
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    webPushSubscription: { findMany: async () => [] },
    notification: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        notifications.push(data);
        return { ...data, id: "n1", createdAt: now, updatedAt: now };
      },
    },
  } as unknown as PrismaClient;
  mock.method(logger, "error", () => {});
  await runRoutine({ ...routine, weekdays: [], prompt: "Uống nước" }, now);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].recipientUserId, "u1");
  assert.equal(notifications[0].type, "AGENT_BRIEF");
  assert.equal(notifications[0].title, "⏰ Lời nhắc");
  assert.equal(notifications[0].message, "Uống nước");
  assert.equal(notifications[0].dedupeKey, "routine:r1:1794614430000");
});
