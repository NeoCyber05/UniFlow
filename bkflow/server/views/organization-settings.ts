import type {
  ActiveTab,
  Role,
  WorkspaceSettingsInvitation,
  WorkspaceSettingsMember,
} from "@/app/(platform)/(dashboard)/organization/[organizationId]/settings/_types";

import { clerkClient } from "../clerk";

const ADMIN_ROLE = "org:admin";
const MEMBER_ROLE = "org:member";
const PAGE_SIZE = 100;

const getName = (member: {
  firstName?: string | null;
  lastName?: string | null;
  identifier?: string | null;
}) => {
  const fullName = [member.firstName, member.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || member.identifier || "Thành viên tổ chức";
};

const toRole = (role: string): Role =>
  role === ADMIN_ROLE ? ADMIN_ROLE : MEMBER_ROLE;

const toIsoDate = (value: Date | number) => new Date(value).toISOString();

const getInitialTab = (rest?: string[]): ActiveTab => {
  const firstSegment = rest?.[0];

  if (firstSegment === "members" || firstSegment === "invitations") {
    return firstSegment;
  }

  return "general";
};

const fetchAllPages = async <T,>(
  loader: (offset: number) => Promise<{ data: T[]; totalCount: number }>,
) => {
  const items: T[] = [];
  let offset = 0;
  let totalCount = Number.POSITIVE_INFINITY;

  while (offset < totalCount) {
    const page = await loader(offset);
    items.push(...page.data);
    totalCount = page.totalCount;
    offset += PAGE_SIZE;
  }

  return items;
};

// Data of app/(platform)/(dashboard)/organization/[organizationId]/settings/[[...rest]]/page.tsx.
export const loadOrganizationSettings = async (
  { organizationId, rest }: { organizationId: string; rest?: string[] },
  userId: string | null,
) => {
  if (!userId) {
    return { redirect: "/sign-in" } as const;
  }

  const client = await clerkClient();
  const currentMemberships = await client.organizations.getOrganizationMembershipList({
    organizationId,
    userId: [userId],
    limit: 1,
  });
  const currentMembership = currentMemberships.data[0];

  if (!currentMembership) {
    return { redirect: "/select-org" } as const;
  }

  const isAdmin = currentMembership.role === ADMIN_ROLE;
  const initialTab = getInitialTab(rest);

  if (initialTab === "invitations" && !isAdmin) {
    return { redirect: `/organization/${organizationId}/settings/members` } as const;
  }

  const [organization, memberships, invitations, adminMemberships] = await Promise.all([
    client.organizations.getOrganization({
      organizationId,
      includeMembersCount: true,
    }),
    fetchAllPages((offset) =>
      client.organizations.getOrganizationMembershipList({
        organizationId,
        limit: PAGE_SIZE,
        offset,
        orderBy: "+first_name",
      }),
    ),
    isAdmin
      ? fetchAllPages((offset) =>
          client.organizations.getOrganizationInvitationList({
            organizationId,
            status: ["pending"],
            limit: PAGE_SIZE,
            offset,
          }),
        )
      : Promise.resolve([]),
    fetchAllPages((offset) =>
      client.organizations.getOrganizationMembershipList({
        organizationId,
        role: [ADMIN_ROLE],
        limit: PAGE_SIZE,
        offset,
      }),
    ),
  ]);

  const members: WorkspaceSettingsMember[] = memberships
    .map((membership) => {
      const user = membership.publicUserData;

      if (!user?.userId) {
        return null;
      }

      return {
        id: membership.id,
        userId: user.userId,
        name: getName(user),
        email: user.identifier ?? "",
        imageUrl: user.imageUrl,
        role: toRole(membership.role),
        createdAt: toIsoDate(membership.createdAt),
        isCurrentUser: user.userId === userId,
      };
    })
    .filter((member): member is WorkspaceSettingsMember => Boolean(member));

  const pendingInvitations: WorkspaceSettingsInvitation[] = invitations
    .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))
    .map((invitation) => ({
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      role: toRole(invitation.role),
      createdAt: toIsoDate(invitation.createdAt),
    }));

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      imageUrl: organization.imageUrl,
      maxAllowedMemberships: organization.maxAllowedMemberships,
    },
    initialTab,
    currentUserId: userId,
    currentRole: toRole(currentMembership.role),
    adminCount: adminMemberships.length,
    members,
    invitations: pendingInvitations,
  } as const;
};
