import { clerkClient } from "../clerk";

// generateMetadata of app/(platform)/(dashboard)/organization/[organizationId]/layout.tsx.
export const loadOrganizationLayout = async (organizationId: string | undefined, orgId: string | null) => {
  const resolvedId = organizationId || orgId;

  if (!resolvedId) {
    return { title: "Tổ chức" } as const;
  }

  try {
    const client = await clerkClient();
    const organization = await client.organizations.getOrganization({
      organizationId: resolvedId,
    });

    return { title: organization.name || "Tổ chức" } as const;
  } catch {
    return { title: "Tổ chức" } as const;
  }
};
