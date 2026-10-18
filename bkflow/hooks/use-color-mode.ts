"use client";

import { useCallback, useEffect, useState } from "react";

export type ColorMode = "light" | "dark" | "system";

const KEY = "color-mode";

const read = (): ColorMode => {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};

const apply = (mode: ColorMode) => {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
};

// shortcut: stored per device in localStorage, not in UserPreference; move to the DB if it must follow the user across devices.
export const useColorMode = () => {
  const [mode, setModeState] = useState<ColorMode>(read);

  useEffect(() => {
    apply(mode);
    if (mode !== "system") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ColorMode) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: still apply for this session
    }
    setModeState(next);
  }, []);

  return { mode, setMode };
};
