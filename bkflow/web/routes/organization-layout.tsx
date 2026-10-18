import { Outlet, useParams } from "react-router";

import type { loadOrganizationLayout } from "@/server/views/organization-layout";
import { SidebarShell } from "@/app/(platform)/(dashboard)/_components/sidebar-shell";
import { OrgControl } from "@/app/(platform)/(dashboard)/organization/[organizationId]/_components/org-control";

import { useTitle } from "../lib/use-title";
import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadOrganizationLayout>>;

// organization/layout.tsx (SidebarShell) + organization/[organizationId]/layout.tsx (OrgControl, title).
export default function OrganizationLayoutRoute() {
  const { organizationId = "" } = useParams<{ organizationId: string }>();
  const { data } = useView<View>(`/organization/${organizationId}/layout`);
  useTitle(data?.title ?? "Tổ chức");

  return (
    <SidebarShell>
      <OrgControl />
      <Outlet />
    </SidebarShell>
  );
}
