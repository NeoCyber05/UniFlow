import type { AccentId, Appearance, BackgroundId } from "@/constants/appearance";
import { tr } from "@/lib/i18n";

export const THEME_PRESETS = [
  { id: "classic" as const, get label() { return tr("preset.theme.classic.label"); }, accent: "blue" as const, background: "glow" as const },
  { id: "lavender" as const, get label() { return tr("preset.theme.lavender.label"); }, accent: "violet" as const, background: "lavender" as const },
  { id: "mint" as const, get label() { return tr("preset.theme.mint.label"); }, accent: "emerald" as const, background: "mint" as const },
];

export const THEME_COLLECTIONS = [
  { id: "essentials" as const, get label() { return tr("preset.collection.essentials.label"); }, get description() { return tr("preset.collection.essentials.desc"); } },
  { id: "seasons" as const, get label() { return tr("preset.collection.seasons.label"); }, get description() { return tr("preset.collection.seasons.desc"); } },
  { id: "places" as const, get label() { return tr("preset.collection.places.label"); }, get description() { return tr("preset.collection.places.desc"); } },
];
export type PresetCategory = (typeof THEME_COLLECTIONS)[number]["id"];

export type ThemePreset = {
  id: string;
  label: string;
  accent: AccentId;
  background: BackgroundId;
  category: PresetCategory;
  description: string;
};

export const ALL_THEME_PRESETS = [
  { id: "classic" as const, get label() { return tr("preset.theme.classic.label"); }, accent: "blue" as const, background: "glow" as const, category: "essentials" as const, get description() { return tr("preset.theme.classic.desc"); } },
  { id: "lavender" as const, get label() { return tr("preset.theme.lavender.label"); }, accent: "violet" as const, background: "lavender" as const, category: "essentials" as const, get description() { return tr("preset.theme.lavender.desc"); } },
  { id: "mint" as const, get label() { return tr("preset.theme.mint.label"); }, accent: "emerald" as const, background: "mint" as const, category: "essentials" as const, get description() { return tr("preset.theme.mint.desc"); } },
  { id: "espresso" as const, get label() { return tr("preset.theme.espresso.label"); }, accent: "coffee" as const, background: "espresso" as const, category: "essentials" as const, get description() { return tr("preset.theme.espresso.desc"); } },
  { id: "spring-garden" as const, get label() { return tr("preset.theme.spring-garden.label"); }, accent: "emerald" as const, background: "scene-spring" as const, category: "seasons" as const, get description() { return tr("preset.theme.spring-garden.desc"); } },
  { id: "summer-coast" as const, get label() { return tr("preset.theme.summer-coast.label"); }, accent: "cyan" as const, background: "scene-summer" as const, category: "seasons" as const, get description() { return tr("preset.theme.summer-coast.desc"); } },
  { id: "autumn-walk" as const, get label() { return tr("preset.theme.autumn-walk.label"); }, accent: "amber" as const, background: "scene-autumn" as const, category: "seasons" as const, get description() { return tr("preset.theme.autumn-walk.desc"); } },
  { id: "winter-silence" as const, get label() { return tr("preset.theme.winter-silence.label"); }, accent: "slate" as const, background: "scene-winter" as const, category: "seasons" as const, get description() { return tr("preset.theme.winter-silence.desc"); } },
  { id: "campus" as const, get label() { return tr("preset.theme.campus.label"); }, accent: "ruby" as const, background: "scene-campus" as const, category: "places" as const, get description() { return tr("preset.theme.campus.desc"); } },
  { id: "library" as const, get label() { return tr("preset.theme.library.label"); }, accent: "coffee" as const, background: "scene-library" as const, category: "places" as const, get description() { return tr("preset.theme.library.desc"); } },
  { id: "hanoi" as const, get label() { return tr("preset.theme.hanoi.label"); }, accent: "coral" as const, background: "scene-hanoi" as const, category: "places" as const, get description() { return tr("preset.theme.hanoi.desc"); } },
  { id: "observatory" as const, get label() { return tr("preset.theme.observatory.label"); }, accent: "indigo" as const, background: "scene-observatory" as const, category: "places" as const, get description() { return tr("preset.theme.observatory.desc"); } },
] satisfies readonly ThemePreset[];

export type ThemePresetId = (typeof ALL_THEME_PRESETS)[number]["id"];

export const getActivePreset = (appearance: Pick<Appearance, "accent" | "background">): ThemePresetId | "legacy" =>
  ALL_THEME_PRESETS.find(p => p.accent === appearance.accent && p.background === appearance.background)?.id ?? "legacy";

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
        const result = await options.save({ ...patch, expectedUserId: options.owner }).catch(() => ({ error: tr("preset.saveError"), data: undefined }));
        if (!active()) return;
        if (result.data) saved = result.data;
        if (request !== version) return;
        current = saved; options.onChange(saved);
        options.onStatus(result.data ? "saved" : "error");
        if (!result.data) options.onError(result.error || tr("preset.saveError"));
      });
      return tail;
    },
    dispose() { disposed = true; },
  };
};
