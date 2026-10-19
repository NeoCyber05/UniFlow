import { useState } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppearanceProvider } from "@/components/providers/appearance-provider";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { ThemeGallery } from "@/components/settings/theme-gallery";
import { ALL_THEME_PRESETS } from "@/lib/appearance-presets";
import { useSettingsModal } from "@/hooks/use-settings-modal";
import { useColorMode } from "@/hooks/use-color-mode";
import { DEFAULT_APPEARANCE, type Appearance } from "@/constants/appearance";
import "./globals.css";

// Local visual fixture, no account or backend requests.
window.fetch = async () => Response.json({});
const client = new QueryClient();
const Demo = () => {
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const { mode, setMode } = useColorMode();
  return <AppearanceProvider initialAppearance={appearance}>
    <div className="min-h-dvh px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto mb-5 flex max-w-4xl flex-wrap items-center justify-between gap-3 text-xs">
        <strong className="text-sm tracking-tight">UniFlow <span className="font-normal text-muted-foreground">/ Giao diện</span></strong>
        <div className="flex gap-2">
          <button className="rounded-lg border bg-background px-3 py-2" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>Đổi sáng tối</button>
          <button className="rounded-lg border bg-background px-3 py-2" onClick={() => useSettingsModal.getState().onOpen("appearance")}>Mở Cài đặt</button>
        </div>
      </div>
      <main className="mx-auto max-w-4xl rounded-3xl border border-border bg-background p-5 sm:p-8">
        <ThemeGallery appearance={appearance} saveStatus="idle" onSelect={id => { const preset = ALL_THEME_PRESETS.find(item => item.id === id)!; setAppearance({ accent: preset.accent, background: preset.background }); }} />
      </main>
      <SettingsDialog />
    </div>
  </AppearanceProvider>;
};
const router = createMemoryRouter([{ path: "/", element: <Demo /> }]);
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
