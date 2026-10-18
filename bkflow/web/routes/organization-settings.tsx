import { Navigate, useParams } from "react-router";

import type { loadOrganizationSettings } from "@/server/views/organization-settings";
import { WorkspaceSettingsClient } from "@/app/(platform)/(dashboard)/organization/[organizationId]/settings/_components/workspace-settings-client";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadOrganizationSettings>>;

export default function OrganizationSettingsRoute() {
  const { organizationId = "", "*": rest = "" } = useParams<{ organizationId: string; "*": string }>();
  const { data } = useView<View>(
    `/organization/${organizationId}/settings${rest ? `?rest=${encodeURIComponent(rest)}` : ""}`,
  );

  if (!data) return null;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <WorkspaceSettingsClient
      organization={data.organization}
      initialTab={data.initialTab}
      currentUserId={data.currentUserId}
      currentRole={data.currentRole}
      adminCount={data.adminCount}
      members={data.members}
      invitations={data.invitations}
    />
  );
}
