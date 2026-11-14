/* eslint-disable @typescript-eslint/no-explicit-any -- Database double thay cho Prisma thật. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { containsLink, createReminderTool } from "./reminder-tool";

const previousDb = globalThis.prisma;
let created: any[];
let activeCount: number;

beforeEach(() => {
  created = [];
  activeCount = 0;
  const database = {
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    agentRoutine: {
      count: async () => activeCount,
      create: async (args: any) => {
        created.push(args.data);
        return { id: "r1", ...args.data };
      },
    },
  };
  globalThis.prisma = { ...database, $transaction: async (write: any) => write(database) } as unknown as PrismaClient;
});

afterEach(() => {
  globalThis.prisma = previousDb;
});

const run = (input: { message: string; at: string }) =>
  (createReminderTool({ userId: "u1", timeZone: "Asia/Ho_Chi_Minh" }) as unknown as { execute: (input: unknown, options: unknown) => Promise<{ ok: boolean; error?: string }> })
    .execute(input, { toolCallId: "t1", messages: [] });

test("tạo lời nhắc một lần ở đúng thời điểm", async () => {
  const result = await run({ message: "Gọi cho nhóm đồ án", at: "2099-01-02T20:00:00+07:00" });

  assert.equal(result.ok, true);
  assert.equal(created.length, 1);
  assert.equal(created[0].userId, "u1");
  assert.equal(created[0].prompt, "Gọi cho nhóm đồ án");
  assert.deepEqual(created[0].weekdays, []);
  assert.equal(created[0].nextRunAt.toISOString(), "2099-01-02T13:00:00.000Z");
});

test("từ chối thời điểm đã qua hoặc sai định dạng", async () => {
  assert.equal((await run({ message: "x", at: "2020-01-01T08:00:00+07:00" })).ok, false);
  assert.equal((await run({ message: "x", at: "ngày mai" })).ok, false);
  assert.equal(created.length, 0);
});

test("schema từ chối giờ thiếu múi giờ và ngày không tồn tại", () => {
  const schema = createReminderTool({ userId: "u1", timeZone: "Asia/Ho_Chi_Minh" }).inputSchema as { safeParse: (input: unknown) => { success: boolean } };
  for (const at of ["2099-01-02", "2099-01-02T20:00:00", "2099-02-30T20:00:00+07:00"]) {
    assert.equal(schema.safeParse({ message: "Gọi nhóm", at }).success, false, at);
  }
  for (const at of ["2099-01-02T20:00:00+07:00", "2099-01-02T13:00:00Z"]) {
    assert.equal(schema.safeParse({ message: "Gọi nhóm", at }).success, true, at);
  }
});

test("đã quá số lời nhắc đang bật thì báo lỗi, không tạo", async () => {
  activeCount = 10;
  const result = await run({ message: "x", at: "2099-01-02T20:00:00+07:00" });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /Tối đa/);
  assert.equal(created.length, 0);
});

test("containsLink nhận ra liên kết, bỏ qua văn bản thường", () => {
  const cases: [string, boolean][] = [
    ["http://x.vn/a", true],
    ["https://evil.example", true],
    ["www.evil.vn", true],
    ["evil.com", true],
    ["bit.ly/abc", true],
    ["t.me/someone", true],
    ["truy cập EVIL.COM ngay", true],
    ["Gọi cho nhóm đồ án", false],
    ["Nộp report.pdf trước 8h", false],
    ["Họp lúc 20.30 ở D3-301", false],
    ["Ôn chương 3.2 v.v.", false],
    ["Mang slide.pptx và bao-cao.docx", false],
  ];
  for (const [text, expected] of cases) assert.equal(containsLink(text), expected, text);
});

test("lời nhắc chứa liên kết thì bị từ chối, không tạo", async () => {
  const result = await run({ message: "Tài khoản bị khóa, đăng nhập lại tại evil.example/login", at: "2099-01-02T20:00:00+07:00" });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /liên kết/);
  assert.equal(created.length, 0);
});
