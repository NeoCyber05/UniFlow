import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BOARD_MEMBER_REQUIRED_ERROR,
  checkBoardOwnership,
  requireBoardMember,
  requireBoardEditor,
  requireBoardAdmin,
} from "./permissions";

test("returns ownership membership when board belongs to user", async () => {
  const fakeDb = {
    board: {
      findFirst: async ({ where }: { where: { id: string; orgId: string } }) => {
        if (where.id === "b1" && where.orgId === "u1") {
          return { id: "b1", title: "Board 1", orgId: "u1" };
        }
        return null;
      },
    },
  };

  const result = await checkBoardOwnership("b1", "u1", fakeDb as any);
  assert.equal(result.error, null);
  assert.equal(result.membership?.board.id, "b1");
  assert.equal(result.membership?.board.orgId, "u1");
  assert.equal(result.membership?.role, "ADMIN");
});

test("returns error when board belongs to someone else or does not exist", async () => {
  const fakeDb = {
    board: {
      findFirst: async () => null,
    },
  };

  const result = await checkBoardOwnership("b1", "u2", fakeDb as any);
  assert.equal(result.error, BOARD_MEMBER_REQUIRED_ERROR);
  assert.equal(result.membership, null);
});
