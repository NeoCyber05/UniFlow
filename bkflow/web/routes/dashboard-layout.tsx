import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import type { loadDashboard } from "@/server/views/dashboard";
import { AppearanceProvider } from "@/components/providers/appearance-provider";
import { Navbar } from "@/app/(platform)/(dashboard)/_components/navbar";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { SettingsDialog } from "@/components/settings/settings-dialog";

import { useAuth } from "../lib/auth";
import { prefetchRouteViews } from "../lib/prefetch-route";

import { useView } from "../lib/use-view";

export type DashboardView = Awaited<ReturnType<typeof loadDashboard>>;

// Child views start loading now instead of after /dashboard returns and the Outlet mounts.
// Own component: reading the location here keeps navigations from re-rendering the navbar and dialogs.
const PrefetchRouteViews = ({ userId }: { userId: string | null }) => {
  const queryClient = useQueryClient();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (userId) prefetchRouteViews(queryClient, pathname, search);
  }, [userId, pathname, search, queryClient]);

  return null;
};

export default function DashboardLayoutRoute() {
  const { userId } = useAuth();
  const { data, error } = useView<DashboardView>("/dashboard", { userId, enabled: Boolean(userId) });

  const content = error ? (
    <p className="p-6 text-sm text-red-600">Không tải được dữ liệu ({error.message}). Thử đăng nhập lại hoặc tải lại trang.</p>
  ) : data ? (
    <AppearanceProvider key={userId} initialAppearance={data.appearance}>
      <Navbar />
      <Outlet />
      <OnboardingTour key={userId} />
      <SettingsDialog />
    </AppearanceProvider>
  ) : null;

  return (
    <>
      <PrefetchRouteViews userId={userId} />
      {content}
    </>
  );
}
