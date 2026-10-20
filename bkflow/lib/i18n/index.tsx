"use client";

import { Fragment, type ReactNode } from "react";
import { create } from "zustand";

import { ja } from "./messages/ja";
import { vi, type MessageKey } from "./messages/vi";

export const LOCALES = [
  { id: "vi", label: "Tiếng Việt" },
  { id: "ja", label: "日本語" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];
export type TParams = Record<string, string | number>;

const MESSAGES: Record<Locale, Partial<Record<MessageKey, string>>> = { vi, ja };
const STORAGE_KEY = "uniflow-locale";

const readLocale = (): Locale => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LOCALES.some((l) => l.id === saved) ? (saved as Locale) : "vi";
  } catch {
    return "vi";
  }
};

const applyLocale = (locale: Locale) => {
  document.documentElement.lang = locale;
};

const initial = typeof window === "undefined" ? "vi" : readLocale();
if (typeof window !== "undefined") applyLocale(initial);

export const useLocale = create<{ locale: Locale; setLocale: (l: Locale) => void }>((set) => ({
  locale: initial,
  setLocale: (locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // storage blocked: locale still applies for this session
    }
    applyLocale(locale);
    set({ locale });
  },
}));

// Dùng được ngoài React (toast, helper). Chuỗi thiếu rơi về tiếng Việt.
// Placeholder dạng {name}, ví dụ tr("x", { goal: 5 }).
export const tr = (key: MessageKey, params?: TParams): string => {
  const locale = useLocale.getState().locale;
  const template = MESSAGES[locale][key] ?? vi[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
};

// Các chuỗi dùng tr() không tự re-render khi đổi ngôn ngữ, nên remount toàn bộ router khi locale đổi.
export const LocaleBoundary = ({ children }: { children: ReactNode }) => {
  const locale = useLocale((s) => s.locale);
  return <Fragment key={locale}>{children}</Fragment>;
};
