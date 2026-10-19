"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { updateAppearance } from "@/actions/appearance/update-appearance";
import { readPageStyle, type PageStyle } from "@/lib/notes/page-style";
import { createAppearanceQueue, THEME_PRESETS, type ThemePresetId, type AppearanceSaveStatus } from "@/lib/appearance-presets";
import { useAuth } from "@/web/lib/auth";
import {
  type AccentId,
  type Appearance,
  type BackgroundId,
  BACKGROUNDS,
} from "@/constants/appearance";

type AppearanceContextValue = Appearance & {
  pageStyle: PageStyle;
  setAccent: (accent: AccentId) => void;
  setBackground: (background: BackgroundId) => void;
  setPageStyle: (pageStyle: PageStyle) => void;
  selectPreset: (id: ThemePresetId) => void;
  saveStatus: AppearanceSaveStatus;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export const useAppearance = () => {
  const context = useContext(AppearanceContext);

  if (!context) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }

  return context;
};

interface AppearanceProviderProps {
  initialAppearance: Appearance;
  children: React.ReactNode;
}

export const AppearanceProvider = (props: AppearanceProviderProps) => {
  const { userId } = useAuth();
  return <AppearanceSession key={`${userId}:${JSON.stringify(props.initialAppearance)}`} {...props} />;
};

const AppearanceSession = ({ initialAppearance, children }: AppearanceProviderProps) => {
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const { userId } = useAuth();
  const ownerRef = useRef(userId);
  const [saveStatus, setSaveStatus] = useState<AppearanceSaveStatus>("idle");
  const queueRef = useRef<ReturnType<typeof createAppearanceQueue> | null>(null);
  useEffect(() => {
    ownerRef.current = userId;
    if (!userId) return;
    const queue = createAppearanceQueue({ initial: initialAppearance, owner: userId, getOwner: () => ownerRef.current,
      save: updateAppearance, onChange: setAppearance, onStatus: setSaveStatus, onError: error => toast.error(error) });
    queueRef.current = queue;
    return () => { ownerRef.current = null; queue.dispose(); queueRef.current = null; };
  }, [userId, initialAppearance]);

  // Portaled UI (popovers, dialogs, toasts) renders under <body>, so mirror the accent on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = appearance.accent;

    return () => {
      delete root.dataset.accent;
    };
  }, [appearance.accent]);

  const setAccent = useCallback(
    (accent: AccentId) => { void queueRef.current?.update({ accent }); },
    [],
  );

  const setBackground = useCallback(
    (background: BackgroundId) => { void queueRef.current?.update({ background }); },
    [],
  );
  const setPageStyle = useCallback((pageStyle: PageStyle) => { void queueRef.current?.update({ pageStyle }); }, []);
  const selectPreset = useCallback((id: ThemePresetId) => {
    const preset = THEME_PRESETS.find(p => p.id === id);
    if (preset) void queueRef.current?.update({ accent: preset.accent, background: preset.background });
  }, []);

  const backgroundStyle = BACKGROUNDS.find((item) => item.id === appearance.background)?.style;

  return (
    <AppearanceContext.Provider value={{ ...appearance, pageStyle: readPageStyle(appearance.pageStyle), setAccent, setBackground, setPageStyle, selectPreset, saveStatus }}>
      <div
        data-accent={appearance.accent}
        data-background={appearance.background}
        className="relative h-full"
      >
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 transition-[background,filter] duration-500 dark:brightness-[0.22] dark:saturate-50"
          style={backgroundStyle}
        />
        {children}
      </div>
    </AppearanceContext.Provider>
  );
};
