import type { Appearance } from "@/constants/appearance";

export const THEME_PRESETS = [
  { id: "classic", label: "Mặc định", accent: "blue", background: "glow" },
  { id: "lavender", label: "Oải hương", accent: "violet", background: "lavender" },
  { id: "mint", label: "Bạc hà", accent: "emerald", background: "mint" },
] as const;
export type ThemePresetId = (typeof THEME_PRESETS)[number]["id"];
export const getActivePreset = (appearance: Pick<Appearance, "accent" | "background">): ThemePresetId | "legacy" =>
  THEME_PRESETS.find(p => p.accent === appearance.accent && p.background === appearance.background)?.id ?? "legacy";

type AppearancePatch = Partial<Appearance>;
export type AppearanceSaveStatus = "idle" | "saving" | "saved" | "error";

/** Serial writes carry only changed fields, so a theme cannot overwrite an independently saved page style. */
export const createAppearanceQueue = (options: {
  initial: Appearance; owner: string; getOwner: () => string | null;
  save: (patch: AppearancePatch & { expectedUserId: string }) => Promise<{ data?: Appearance; error?: string | null }>;
  onChange: (appearance: Appearance) => void; onStatus: (status: AppearanceSaveStatus) => void; onError: (error: string) => void;
}) => {
  let current = options.initial; let saved = current; let version = 0; let disposed = false;
  let tail = Promise.resolve();
  const active = () => !disposed && options.getOwner() === options.owner;
  return {
    update(patch: AppearancePatch) {
      if (!active()) return Promise.resolve();
      const request = ++version;
      current = { ...current, ...patch }; options.onChange(current); options.onStatus("saving");
      tail = tail.then(async () => {
        if (!active()) return;
        const result = await options.save({ ...patch, expectedUserId: options.owner }).catch(() => ({ error: "Không thể lưu giao diện.", data: undefined }));
        if (!active()) return;
        if (result.data) saved = result.data;
        if (request !== version) return;
        current = saved; options.onChange(saved);
        options.onStatus(result.data ? "saved" : "error");
        if (!result.data) options.onError(result.error || "Không thể lưu giao diện.");
      });
      return tail;
    },
    dispose() { disposed = true; },
  };
};
