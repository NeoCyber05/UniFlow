import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { getOrCreateWorkspaces } from "./workspaces-db";

const previousDb = globalThis.prisma;
afterEach(() => { globalThis.prisma = previousDb; });

test("creates exactly one default workspace, only when the user has none", async () => {
  const rows: Record<string, unknown>[] = [];
  // course/notePage/aiNoteEdit keep lib/db.ts from replacing the stub with a real client
  globalThis.prisma = {
    course: {}, notePage: {}, aiNoteEdit: {},
    workspace: {
      findMany: async () => rows.slice(),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        rows.push({ id: `w${rows.length}`, order: 0, ...data });
        return rows.at(-1);
      },
    },
  } as unknown as PrismaClient;

  const first = await getOrCreateWorkspaces("u1");
  const second = await getOrCreateWorkspaces("u1");

  assert.equal(rows.length, 1);
  assert.equal(first.length, 1);
  assert.equal(first[0].title, "Workspace của tôi");
  assert.equal(first[0].isCurrent, true);
  assert.equal(second.length, 1);
});
