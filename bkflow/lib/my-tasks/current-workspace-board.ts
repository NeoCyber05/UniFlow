import "server-only";

import { db } from "@/lib/db";
import { getOrCreateWorkspaceBoard } from "@/lib/workspace-board";
import { pickCurrentWorkspace } from "@/lib/workspaces";
import { getOrCreateWorkspaces } from "@/lib/workspaces-db";

export const NO_CURRENT_WORKSPACE_ERROR = "Chưa có workspace hiện tại. Hãy tạo workspace trước.";

/** Id bảng của workspace hiện tại; tạo bảng nếu chưa có. */
export const resolveCurrentWorkspaceBoardId = async (
  userId: string,
  knownWorkspace?: { id: string } | null,
): Promise<string | null> => {
  if (!userId) return null;

  const workspace = knownWorkspace ?? pickCurrentWorkspace(await getOrCreateWorkspaces(userId));

  if (!workspace) return null;

  // Fast path: workspace thuộc user nên board của nó cũng vậy
  const existing = await db.board.findFirst({
    where: { workspaceId: workspace.id, userId },
    select: { id: true },
  });

  if (existing) return existing.id;

  const board = await getOrCreateWorkspaceBoard({ userId, workspaceId: workspace.id });

  return board?.id ?? null;
};
