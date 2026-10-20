import { getUserAppearance } from "@/lib/appearance";
import { pickCurrentWorkspace } from "@/lib/workspaces";
import { getOrCreateWorkspaces } from "@/lib/workspaces-db";

export const loadDashboard = async (userId: string | null) => {
  const [appearance, currentWorkspace] = await Promise.all([
    getUserAppearance(userId),
    userId ? getOrCreateWorkspaces(userId).then(pickCurrentWorkspace) : null,
  ]);

  return { appearance, currentWorkspaceId: currentWorkspace?.id ?? null } as const;
};
