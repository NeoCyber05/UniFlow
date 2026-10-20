import "server-only";

import { cache } from "react";
import { Prisma, type Workspace } from "@prisma/client";

import { db } from "@/lib/db";
import { DEFAULT_WORKSPACE_TITLE } from "@/lib/workspaces";

const listWorkspaces = (userId: string) =>
  db.workspace.findMany({ where: { userId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });

/** Workspace của user theo order; lần đầu tạo đúng 1 workspace mặc định. */
export const getOrCreateWorkspaces = cache(async (userId: string): Promise<Workspace[]> => {
  const workspaces = await listWorkspaces(userId);

  if (workspaces.length > 0) return workspaces;

  try {
    await db.workspace.create({
      data: { userId, title: DEFAULT_WORKSPACE_TITLE, color: "violet", isCurrent: true },
    });
  } catch (error) {
    // Hai request đầu tiên chạy song song: request thua đọc lại workspace đã tạo
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }

  return listWorkspaces(userId);
});
