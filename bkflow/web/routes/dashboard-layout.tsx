import { Outlet } from "react-router";

import type { loadDashboard } from "@/server/views/dashboard";
import { AppearanceProvider } from "@/components/providers/appearance-provider";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { Navbar } from "@/app/(platform)/(dashboard)/_components/navbar";

import { useView } from "../lib/use-view";

export type DashboardView = Awaited<ReturnType<typeof loadDashboard>>;

export default function DashboardLayoutRoute() {
  const { data } = useView<DashboardView>("/dashboard");

  if (!data) return null;

  return (
    <AppearanceProvider initialAppearance={data.appearance}>
      <WorkspaceProvider initialPersonalOrgId={data.personalOrgId} currentSemesterId={data.currentSemesterId}>
        <Navbar />
        <Outlet />
      </WorkspaceProvider>
    </AppearanceProvider>
  );
}
