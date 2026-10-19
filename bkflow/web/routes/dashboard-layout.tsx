import { Outlet } from "react-router";

import type { loadDashboard } from "@/server/views/dashboard";
import { AppearanceProvider } from "@/components/providers/appearance-provider";
import { Navbar } from "@/app/(platform)/(dashboard)/_components/navbar";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";

import { useAuth } from "../lib/auth";

import { useView } from "../lib/use-view";

export type DashboardView = Awaited<ReturnType<typeof loadDashboard>>;

export default function DashboardLayoutRoute() {
  const { userId } = useAuth();
  const { data, error } = useView<DashboardView>("/dashboard", { userId, enabled: Boolean(userId) });

  if (error) return <p className="p-6 text-sm text-red-600">Không tải được dữ liệu ({error.message}). Thử đăng nhập lại hoặc tải lại trang.</p>;
  if (!data) return null;

  return (
    <AppearanceProvider key={userId} initialAppearance={data.appearance}>
      <Navbar />
      <Outlet />
      <OnboardingTour key={userId} />
    </AppearanceProvider>
  );
}
