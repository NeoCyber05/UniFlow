import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import CreateOrganizationPage from "@/app/(platform)/(clerk)/select-org/[[...select-org]]/page";

import { useView } from "../lib/use-view";
import type { DashboardView } from "./dashboard-layout";

// Same data as the dashboard layout: the page only needs WorkspaceProvider's personalOrgId.
export default function SelectOrgRoute() {
  const { data } = useView<DashboardView>("/dashboard");

  if (!data) return null;

  return (
    <div className="h-full flex items-center justify-center">
      <WorkspaceProvider initialPersonalOrgId={data.personalOrgId} currentSemesterId={data.currentSemesterId}>
        <CreateOrganizationPage />
      </WorkspaceProvider>
    </div>
  );
}
