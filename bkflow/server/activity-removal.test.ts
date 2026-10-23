import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("activity log UI and read endpoints are removed", () => {
  for (const path of [
    "server/routes/boards/[boardId]/activity/route.ts",
    "server/routes/cards/[cardId]/logs/route.ts",
    "components/modals/card-modal/activity.tsx",
    "app/(platform)/(dashboard)/board/[boardId]/_components/board-activity-popover-content.tsx",
  ]) assert.equal(existsSync(path), false, path);
  for (const path of [
    "components/my-tasks/my-sidebar-nav.tsx",
    "components/modals/card-modal/card-detail-body.tsx",
  ]) assert.doesNotMatch(readFileSync(path, "utf8"), /Nhật ký hoạt động|card-logs|BoardActivityPopoverContent/);
});

test("board sidebar has no second navigation header or collapse button", () => {
  const source = readFileSync("app/(platform)/(dashboard)/board/[boardId]/_components/board-sidebar.tsx", "utf8");
  assert.doesNotMatch(source, /<span>Điều hướng<\/span>|PanelLeftClose/);
});
