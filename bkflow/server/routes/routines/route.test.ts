/* eslint-disable @typescript-eslint/no-explicit-any -- In-memory database exercises authenticated route boundaries. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { runWithAuth } from "@/server/auth";
import { DELETE, GET, PATCH, POST } from "./route";

const previousDb = globalThis.prisma;
let rows: any[];
const request = (method: string, body: unknown) => new Request("http://local/api/routines", {
  method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const signedIn = (fn: () => Promise<Response>) => runWithAuth({ userId: "u1", user: null }, fn);
const input = { title: " Sáng ", prompt: " Tóm tắt ", time: "07:30", weekdays: [6, 1, 6], timeZone: "Asia/Ho_Chi_Minh", userId: "other" };
beforeEach(() => {
  rows = [{ id: "foreign", userId: "other", enabled: true, weekdays: [1], nextRunAt: new Date("2099-01-01T00:00:00Z") }];
  const matches = (row: any, where: any) => Object.entries(where).every(([key, value]) => row[key] === value);
  const database = {
    course: {}, workspace: {}, notePage: {}, aiNoteEdit: {},
    agentRoutine: {
      findMany: async ({ where }: any) => rows.filter(row => matches(row, where)),
      findFirst: async ({ where }: any) => rows.find(row => matches(row, where)) ?? null,
      count: async ({ where }: any) => rows.filter(row => matches(row, where)).length,
      create: async ({ data }: any) => { const row = { id: "new", enabled: true, ...data }; rows.push(row); return row; },
      updateMany: async ({ where, data }: any) => {
        const found = rows.filter(row => matches(row, where));
        found.forEach(row => Object.assign(row, data));
        return { count: found.length };
      },
      deleteMany: async ({ where }: any) => { const count = rows.length; rows = rows.filter(row => !matches(row, where)); return { count: count - rows.length }; },
    },
  };
  globalThis.prisma = { ...database, $transaction: async (write: any) => write(database) } as unknown as PrismaClient;
});
afterEach(() => { globalThis.prisma = previousDb; });

test("mọi routine endpoint yêu cầu đăng nhập", async () => {
  for (const response of [await GET(), await POST(request("POST", input)), await PATCH(request("PATCH", { id: "foreign", enabled: false })), await DELETE(request("DELETE", { id: "foreign" }))]) {
    assert.equal(response.status, 401);
  }
  assert.equal(rows.length, 1);
});

test("tạo lịch chuẩn hóa dữ liệu và chỉ ghi cho user đăng nhập", async () => {
  const response = await signedIn(() => POST(request("POST", input)));
  assert.equal(response.status, 200);
  assert.equal(rows[1].userId, "u1");
  assert.equal(rows[1].title, "Sáng");
  assert.equal(rows[1].minuteOfDay, 450);
  assert.deepEqual(rows[1].weekdays, [1, 6]);
  const listed = await (await signedIn(GET)).json();
  assert.deepEqual(listed.routines.map((r: any) => r.id), ["new"]);
});

test("không đọc, bật tắt hoặc xóa được lịch của người khác", async () => {
  assert.deepEqual(await (await signedIn(GET)).json(), { routines: [] });
  assert.equal((await signedIn(() => PATCH(request("PATCH", { id: "foreign", enabled: false })))).status, 404);
  assert.equal((await signedIn(() => DELETE(request("DELETE", { id: "foreign" })))).status, 200);
  assert.equal(rows[0].enabled, true);
  assert.equal(rows.length, 1);
});

test("không bật lại lời nhắc đã qua; vẫn tắt và xóa được lịch của mình", async () => {
  rows.push({ id: "past", userId: "u1", enabled: false, weekdays: [], nextRunAt: new Date(0) });
  assert.equal((await signedIn(() => PATCH(request("PATCH", { id: "past", enabled: true })))).status, 400);
  assert.equal(rows[1].enabled, false);
  assert.equal((await signedIn(() => PATCH(request("PATCH", { id: "past", enabled: false })))).status, 200);
  await signedIn(() => DELETE(request("DELETE", { id: "past" })));
  assert.deepEqual(rows.map(row => row.id), ["foreign"]);
});

test("từ chối giờ, thứ hoặc nội dung lịch không hợp lệ trước khi ghi", async () => {
  for (const change of [{ time: "24:00" }, { weekdays: [] }, { weekdays: [7] }, { title: " " }]) {
    assert.equal((await signedIn(() => POST(request("POST", { ...input, ...change })))).status, 400);
  }
  assert.equal(rows.length, 1);
});
