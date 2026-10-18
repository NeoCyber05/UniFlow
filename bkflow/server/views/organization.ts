import { getWorkspaceType } from "@/lib/workspace";

// Data of app/(platform)/(dashboard)/organization/[organizationId]/page.tsx.
export const loadOrganization = async (
  { organizationId, error }: { organizationId: string; error?: string },
  userId: string | null,
) => {
  if (!userId) {
    return { redirect: "/select-org" } as const;
  }

  const workspaceType = await getWorkspaceType(userId, organizationId);

  if (workspaceType === "PERSONAL") {
    return { redirect: error ? `/my/today?error=${encodeURIComponent(error)}` : "/my/today" } as const;
  }

  return { organizationId, error } as const;
};
