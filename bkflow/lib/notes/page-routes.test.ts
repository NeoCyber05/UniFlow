/* eslint-disable @typescript-eslint/no-explicit-any -- Database doubles exercise the page routes without a live database. */
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { runWithAuth } from "@/server/auth";
import { POST as createPage } from "@/server/routes/pages/route";
import { DELETE as deletePage, PATCH as savePage } from "@/server/routes/pages/[pageId]/route";

type Page = { id: string; userId: string; title: string; content: string; style: unknown; icon: string | null; parentId: string | null; deletedAt: Date | null; updatedAt: Date };

const previousDb = globalThis.prisma;
const version = new Date("2026-10-18T00:00:00.000Z");
const doc = (...blocks: object[]) => JSON.stringify({ version: 1, blocks });
let pages: Page[];
let writes: string[];

beforeEach(() => {
  writes = [];
  pages = [{ id: "p1", userId: "u1", title: "Ôn thi", content: doc({ id: "a", type: "paragraph", text: "x" }, { id: "t", type: "task", taskId: "c1" }), style: null, icon: "📚", parentId: null, deletedAt: null, updatedAt: version }];
  const match = (page: Page, where: any) => page.id === where.id && page.userId === where.userId
    && (where.deletedAt === undefined || page.deletedAt === where.deletedAt)
    && (where.updatedAt === undefined || page.updatedAt.getTime() === where.updatedAt.getTime());
  const notePage = {
    findFirst: async ({ where }: any) => pages.find(page => match(page, where)) ?? null,
    findMany: async ({ where }: any) => pages.filter(page => page.userId === where.userId),
    create: async ({ data }: any) => { writes.push("notePage.create"); const page = { id: `p${pages.length + 1}`, title: "Trang mới", content: "", style: null, icon: null, parentId: null, deletedAt: null, updatedAt: version, ...data }; pages.push(page); return { id: page.id }; },
    updateMany: async ({ where, data }: any) => {
      writes.push("notePage.updateMany");
      const hits = pages.filter(page => where.id?.in ? where.id.in.includes(page.id) && page.userId === where.userId : match(page, where));
      hits.forEach(page => Object.assign(page, data));
      return { count: hits.length };
    },
  };
  // No card model: any Card read or write in these routes would throw.
  const database: any = {
    course: {}, semester: {}, aiNoteEdit: {}, notePage,
    noteDeadline: { deleteMany: async () => { writes.push("noteDeadline.deleteMany"); }, createMany: async () => { writes.push("noteDeadline.createMany"); } },
  };
  database.$transaction = async (fn: any) => fn(database);
  globalThis.prisma = database as PrismaClient;
});
afterEach(() => { globalThis.prisma = previousDb; });

const as = <T,>(fn: () => Promise<T>) => runWithAuth({ userId: "u1", user: null }, fn);
const params = { params: Promise.resolve({ pageId: "p1" }) };
const json = (method: string, body: unknown) => new Request("http://local/api/pages/p1", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("duplicate page copies references only", async () => {
  const response = await as(() => createPage(new Request("http://local/api/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ duplicateOf: "p1" }) })));
  assert.equal(response.status, 201);
  const copy = pages.find(page => page.id === (pages[1]?.id));
  assert.ok(copy);
  assert.equal(copy.content, pages[0].content);
  assert.equal(JSON.parse(copy.content).blocks[1].taskId, "c1");
  assert.equal(copy.title, "Ôn thi (bản sao)");
  assert.equal(copy.icon, "📚");
  assert.deepEqual(writes, ["notePage.create"]);

  pages[0].deletedAt = new Date();
  const trashed = await as(() => createPage(new Request("http://local/api/pages", { method: "POST", body: JSON.stringify({ duplicateOf: "p1" }) })));
  assert.equal(trashed.status, 404);
});

test("remove reference or page never deletes card", async () => {
  const removed = await as(() => savePage(json("PATCH", { title: "Ôn thi", content: doc({ id: "a", type: "paragraph", text: "x" }), style: null, expectedUpdatedAt: version.toISOString() }), params));
  assert.equal(removed.status, 200);
  const trashed = await as(() => deletePage(new Request("http://local/api/pages/p1", { method: "DELETE" }), params));
  assert.equal(trashed.status, 204);
  assert.ok(pages[0].deletedAt);
  assert.ok(writes.every(write => write.startsWith("notePage.") || write.startsWith("noteDeadline.")));
});

test("save route rejects unstructured content before any write", async () => {
  for (const content of ["văn bản thuần", '{"version":9,"blocks":[]}']) {
    const response = await as(() => savePage(json("PATCH", { title: "Ôn thi", content, style: null, expectedUpdatedAt: version.toISOString() }), params));
    assert.equal(response.status, 400);
  }
  assert.deepEqual(writes, []);
  assert.equal(JSON.parse(pages[0].content).blocks.length, 2);
});
