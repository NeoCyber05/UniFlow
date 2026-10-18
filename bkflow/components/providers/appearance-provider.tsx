"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { updateAppearance } from "@/actions/appearance/update-appearance";
import { readPageStyle, type PageStyle } from "@/lib/notes/page-style";
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

export const AppearanceProvider = ({ initialAppearance, children }: AppearanceProviderProps) => {
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const savedRef = useRef<Appearance>(initialAppearance);
  const requestIdRef = useRef(0);
  const appearanceRef = useRef(initialAppearance);
  const queueRef = useRef(Promise.resolve());

  // Portaled UI (popovers, dialogs, toasts) renders under <body>, so mirror the accent on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = appearance.accent;

    return () => {
      delete root.dataset.accent;
    };
  }, [appearance.accent]);

  const persist = useCallback(async (next: Appearance) => {
    appearanceRef.current = next;
    setAppearance(next);
    const requestId = ++requestIdRef.current;
    // Serialize writes so rapid customization cannot save an older choice last.
    queueRef.current = queueRef.current.then(async () => {
      const result = await updateAppearance(next).catch(() => ({ error: "Không thể lưu giao diện.", data: undefined }));
      if (result.data) savedRef.current = result.data;

      // A newer selection is in flight; let that one decide the final state
      if (requestId !== requestIdRef.current || result.data) return;

      setAppearance(savedRef.current);
      appearanceRef.current = savedRef.current;
      toast.error(result.error || "Không thể lưu giao diện.");
    });
    return queueRef.current;
  }, []);

  const setAccent = useCallback(
    (accent: AccentId) => persist({ ...appearanceRef.current, accent }),
    [persist],
  );

  const setBackground = useCallback(
    (background: BackgroundId) => persist({ ...appearanceRef.current, background }),
    [persist],
  );
  const setPageStyle = useCallback((pageStyle: PageStyle) => persist({ ...appearanceRef.current, pageStyle }), [persist]);

  const backgroundStyle = BACKGROUNDS.find((item) => item.id === appearance.background)?.style;

  return (
    <AppearanceContext.Provider value={{ ...appearance, pageStyle: readPageStyle(appearance.pageStyle), setAccent, setBackground, setPageStyle }}>
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
