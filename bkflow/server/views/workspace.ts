import { db } from "@/lib/db";
import { getOrCreateWorkspaceBoard } from "@/lib/workspace-board";

// /workspace/:workspaceId → đặt làm hiện tại rồi chuyển tới bảng của nó.
export const loadWorkspace = async ({ workspaceId }: { workspaceId: string }, userId: string | null) => {
  if (!userId) {
    return { redirect: "/sign-in" } as const;
  }

  const board = await getOrCreateWorkspaceBoard({ userId, workspaceId });

  if (!board) {
    return { notFound: true } as const;
  }

  await db.$transaction([
    db.workspace.updateMany({ where: { userId, isCurrent: true, NOT: { id: workspaceId } }, data: { isCurrent: false } }),
    db.workspace.update({ where: { id: workspaceId }, data: { isCurrent: true } }),
  ]);

  return { redirect: `/board/${board.id}/list` } as const;
};
