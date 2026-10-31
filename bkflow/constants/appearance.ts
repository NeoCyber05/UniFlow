import type { CSSProperties } from "react";
import { tr } from "@/lib/i18n";
import type { ExtraMessageKey } from "@/lib/i18n/messages/vi-extra";
import type { PageStyle } from "@/lib/notes/page-style";

export const ACCENT_IDS = [
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "ruby",
  "crimson",
  "coral",
  "orange",
  "amber",
  "gold",
  "yellow",
  "lime",
  "green",
  "emerald",
  "forest",
  "teal",
  "cyan",
  "sky",
  "navy",
  "sage",
  "slate",
  "zinc",
  "neutral",
  "stone",
  "coffee",
] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export const BACKGROUND_CATEGORIES = ["all", "illustration", "gradient", "pattern"] as const;
export type BackgroundCategory = (typeof BACKGROUND_CATEGORIES)[number];

export const BACKGROUND_IDS = [
  "scene-spring", "scene-summer", "scene-autumn", "scene-winter",
  "scene-campus", "scene-library", "scene-hanoi", "scene-observatory",
  // --- Gradients (26) ---
  "glow",
  "aurora",
  "sky",
  "lavender",
  "peach",
  "mint",
  "twilight",
  "ocean",
  "matcha",
  "sakura",
  "warm-sand",
  "sunset",
  "sunrise",
  "nordic",
  "cotton-candy",
  "citrus",
  "nebula",
  "cherry-blossom",
  "espresso",
  "breeze",
  "midnight-mist",
  "rose-gold",
  "lavender-dusk",
  "emerald-spring",
  "coral-reef",
  "cyberpunk-light",

  // --- Patterns (24) ---
  "plain",
  "dots",
  "grid",
  "notebook",
  "crosshatch",
  "blueprint",
  "isometric",
  "circuit",
  "waves",
  "graph-paper",
  "hexagons",
  "plus-matrix",
  "diagonal-stripes",
  "polka-dense",
  "carbon",
  "terrazzo",
  "stars",
  "cubes",
  "music-sheet",
  "circuit-dense",
  "topography",
  "moroccan",
  "bamboo",
  "chevron",
] as const;
export type BackgroundId = (typeof BACKGROUND_IDS)[number];

export const DEFAULT_ACCENT: AccentId = "blue";
export const DEFAULT_BACKGROUND: BackgroundId = "glow";

export type Appearance = {
  accent: AccentId;
  background: BackgroundId;
  pageStyle?: PageStyle;
};

export const DEFAULT_APPEARANCE: Appearance = {
  accent: DEFAULT_ACCENT,
  background: DEFAULT_BACKGROUND,
};

// 28 màu chủ đạo (Accent colors)
export const ACCENTS: { id: AccentId; label: string; swatch: string }[] = [
  { id: "blue", get label() { return tr("preset.accent.blue"); }, swatch: "#2563eb" },
  { id: "indigo", get label() { return tr("preset.accent.indigo"); }, swatch: "#4f46e5" },
  { id: "violet", get label() { return tr("preset.accent.violet"); }, swatch: "#7c3aed" },
  { id: "purple", get label() { return tr("preset.accent.purple"); }, swatch: "#9333ea" },
  { id: "fuchsia", get label() { return tr("preset.accent.fuchsia"); }, swatch: "#a21caf" },
  { id: "pink", get label() { return tr("preset.accent.pink"); }, swatch: "#db2777" },
  { id: "rose", get label() { return tr("preset.accent.rose"); }, swatch: "#e11d48" },
  { id: "ruby", get label() { return tr("preset.accent.ruby"); }, swatch: "#dc2626" },
  { id: "crimson", get label() { return tr("preset.accent.crimson"); }, swatch: "#be123c" },
  { id: "coral", get label() { return tr("preset.accent.coral"); }, swatch: "#ea580c" },
  { id: "orange", get label() { return tr("preset.accent.orange"); }, swatch: "#c2410c" },
  { id: "amber", get label() { return tr("preset.accent.amber"); }, swatch: "#b45309" },
  { id: "gold", get label() { return tr("preset.accent.gold"); }, swatch: "#ca8a04" },
  { id: "yellow", get label() { return tr("preset.accent.yellow"); }, swatch: "#d97706" },
  { id: "lime", get label() { return tr("preset.accent.lime"); }, swatch: "#4d7c0f" },
  { id: "green", get label() { return tr("preset.accent.green"); }, swatch: "#16a34a" },
  { id: "emerald", get label() { return tr("preset.accent.emerald"); }, swatch: "#047857" },
  { id: "forest", get label() { return tr("preset.accent.forest"); }, swatch: "#15803d" },
  { id: "teal", get label() { return tr("preset.accent.teal"); }, swatch: "#0f766e" },
  { id: "cyan", get label() { return tr("preset.accent.cyan"); }, swatch: "#0e7490" },
  { id: "sky", get label() { return tr("preset.accent.sky"); }, swatch: "#0284c7" },
  { id: "navy", get label() { return tr("preset.accent.navy"); }, swatch: "#1d4ed8" },
  { id: "sage", get label() { return tr("preset.accent.sage"); }, swatch: "#4e6e56" },
  { id: "slate", get label() { return tr("preset.accent.slate"); }, swatch: "#475569" },
  { id: "zinc", get label() { return tr("preset.accent.zinc"); }, swatch: "#52525b" },
  { id: "neutral", get label() { return tr("preset.accent.neutral"); }, swatch: "#525252" },
  { id: "stone", get label() { return tr("preset.accent.stone"); }, swatch: "#57534e" },
  { id: "coffee", get label() { return tr("preset.accent.coffee"); }, swatch: "#78350f" },
];

export type BackgroundItem = {
  id: BackgroundId;
  label: string;
  category: Exclude<BackgroundCategory, "all">;
  artwork?: string;
  style: CSSProperties;
};

const SCENIC_BACKGROUNDS: readonly { id: BackgroundId; labelKey: ExtraMessageKey; file: string; color: string }[] = [
  { id: "scene-spring", labelKey: "preset.bg.scene-spring", file: "spring", color: "#dcebd9" },
  { id: "scene-summer", labelKey: "preset.bg.scene-summer", file: "summer", color: "#c2e9ed" },
  { id: "scene-autumn", labelKey: "preset.bg.scene-autumn", file: "autumn", color: "#f6dbb8" },
  { id: "scene-winter", labelKey: "preset.bg.scene-winter", file: "winter", color: "#cbd9ef" },
  { id: "scene-campus", labelKey: "preset.bg.scene-campus", file: "campus", color: "#f5d9c0" },
  { id: "scene-library", labelKey: "preset.bg.scene-library", file: "library", color: "#e9d8b7" },
  { id: "scene-hanoi", labelKey: "preset.bg.scene-hanoi", file: "hanoi", color: "#efb5a1" },
  { id: "scene-observatory", labelKey: "preset.bg.scene-observatory", file: "observatory", color: "#292b5b" },
];

// Existing gradients and patterns stay valid for saved custom appearances.
export const BACKGROUNDS: BackgroundItem[] = [
  ...SCENIC_BACKGROUNDS.map(({ id, labelKey, file, color }) => ({
    id, get label() { return tr(labelKey); }, category: "illustration" as const, artwork: `/theme-art/${file}.svg`,
    style: {
      backgroundColor: color,
      backgroundImage: `url("/theme-art/${file}.svg")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    },
  })),
  // ==========================================
  // --- PHẦN 1: CHUYỂN MÀU (GRADIENTS - 26 LOẠI) ---
  // ==========================================
  {
    id: "glow",
    get label() { return tr("preset.bg.glow"); },
    category: "gradient",
    style: {
      backgroundColor: "#fafafa",
      backgroundImage: [
        "radial-gradient(at 0% 0%, var(--color-violet-100) 0px, transparent 45%)",
        "radial-gradient(at 100% 0%, var(--color-violet-50) 0px, transparent 50%)",
        "radial-gradient(at 100% 100%, var(--color-violet-100) 0px, transparent 45%)",
      ].join(", "),
    },
  },
  {
    id: "aurora",
    get label() { return tr("preset.bg.aurora"); },
    category: "gradient",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #dbeafe 0px, transparent 50%)",
        "radial-gradient(at 100% 0%, #fae8ff 0px, transparent 50%)",
        "radial-gradient(at 100% 100%, #dcfce7 0px, transparent 50%)",
        "radial-gradient(at 0% 100%, #fef9c3 0px, transparent 45%)",
      ].join(", "),
    },
  },
  {
    id: "sky",
    get label() { return tr("preset.bg.sky"); },
    category: "gradient",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: "linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 35%, #f8fafc 70%)",
    },
  },
  {
    id: "lavender",
    get label() { return tr("preset.bg.lavender"); },
    category: "gradient",
    style: {
      backgroundColor: "#faf5ff",
      backgroundImage: [
        "radial-gradient(at 10% 10%, #ede9fe 0px, transparent 50%)",
        "radial-gradient(at 90% 80%, #fce7f3 0px, transparent 50%)",
      ].join(", "),
    },
  },
  {
    id: "peach",
    get label() { return tr("preset.bg.peach"); },
    category: "gradient",
    style: {
      backgroundColor: "#fffbf5",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #ffe4e6 0px, transparent 50%)",
        "radial-gradient(at 100% 30%, #fef3c7 0px, transparent 50%)",
        "radial-gradient(at 40% 100%, #ffedd5 0px, transparent 50%)",
      ].join(", "),
    },
  },
  {
    id: "mint",
    get label() { return tr("preset.bg.mint"); },
    category: "gradient",
    style: {
      backgroundColor: "#f6fefb",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #ccfbf1 0px, transparent 50%)",
        "radial-gradient(at 100% 100%, #e0f2fe 0px, transparent 50%)",
      ].join(", "),
    },
  },
  {
    id: "twilight",
    get label() { return tr("preset.bg.twilight"); },
    category: "gradient",
    style: {
      backgroundColor: "#fdf8ff",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #fae8ff 0px, transparent 50%)",
        "radial-gradient(at 100% 0%, #e0e7ff 0px, transparent 50%)",
        "radial-gradient(at 50% 100%, #fce7f3 0px, transparent 50%)",
      ].join(", "),
    },
  },
  {
    id: "ocean",
    get label() { return tr("preset.bg.ocean"); },
    category: "gradient",
    style: {
      backgroundColor: "#f0fdfa",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #cffafe 0px, transparent 50%)",
        "radial-gradient(at 100% 100%, #bfdbfe 0px, transparent 50%)",
        "radial-gradient(at 50% 50%, #e0f2fe 0px, transparent 60%)",
      ].join(", "),
    },
  },
  {
    id: "matcha",
    get label() { return tr("preset.bg.matcha"); },
    category: "gradient",
    style: {
      backgroundColor: "#f6fbf7",
      backgroundImage: [
        "radial-gradient(at 10% 10%, #dcfce7 0px, transparent 50%)",
        "radial-gradient(at 90% 90%, #f0fdf4 0px, transparent 50%)",
        "radial-gradient(at 50% 0%, #ecfdf5 0px, transparent 45%)",
      ].join(", "),
    },
  },
  {
    id: "sakura",
    get label() { return tr("preset.bg.sakura"); },
    category: "gradient",
    style: {
      backgroundColor: "#fff7f9",
      backgroundImage: [
        "radial-gradient(at 0% 20%, #ffe4e6 0px, transparent 50%)",
        "radial-gradient(at 100% 80%, #fce7f3 0px, transparent 50%)",
        "radial-gradient(at 50% 100%, #fdf2f8 0px, transparent 40%)",
      ].join(", "),
    },
  },
  {
    id: "warm-sand",
    get label() { return tr("preset.bg.warm-sand"); },
    category: "gradient",
    style: {
      backgroundColor: "#faf8f5",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #fef3c7 0px, transparent 45%)",
        "radial-gradient(at 100% 50%, #ffedd5 0px, transparent 50%)",
        "radial-gradient(at 30% 100%, #fde68a 0px, transparent 40%)",
      ].join(", "),
    },
  },
  {
    id: "sunset",
    get label() { return tr("preset.bg.sunset"); },
    category: "gradient",
    style: {
      backgroundColor: "#fff7ed",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #fed7aa 0px, transparent 50%)",
        "radial-gradient(at 100% 0%, #fbcfe8 0px, transparent 50%)",
        "radial-gradient(at 50% 100%, #fde68a 0px, transparent 45%)",
      ].join(", "),
    },
  },
  {
    id: "sunrise",
    get label() { return tr("preset.bg.sunrise"); },
    category: "gradient",
    style: {
      backgroundColor: "#fefce8",
      backgroundImage: [
        "radial-gradient(at 10% 0%, #fef08a 0px, transparent 50%)",
        "radial-gradient(at 90% 40%, #fed7aa 0px, transparent 50%)",
        "radial-gradient(at 30% 100%, #fbcfe8 0px, transparent 40%)",
      ].join(", "),
    },
  },
  {
    id: "nordic",
    get label() { return tr("preset.bg.nordic"); },
    category: "gradient",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #e2e8f0 0px, transparent 50%)",
        "radial-gradient(at 100% 100%, #cbd5e1 0px, transparent 45%)",
        "radial-gradient(at 50% 50%, #f1f5f9 0px, transparent 60%)",
      ].join(", "),
    },
  },
  {
    id: "cotton-candy",
    get label() { return tr("preset.bg.cotton-candy"); },
    category: "gradient",
    style: {
      backgroundColor: "#faf5ff",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #bae6fd 0px, transparent 50%)",
        "radial-gradient(at 100% 100%, #fbcfe8 0px, transparent 50%)",
        "radial-gradient(at 50% 50%, #e0e7ff 0px, transparent 40%)",
      ].join(", "),
    },
  },
  {
    id: "citrus",
    get label() { return tr("preset.bg.citrus"); },
    category: "gradient",
    style: {
      backgroundColor: "#fefce8",
      backgroundImage: [
        "radial-gradient(at 0% 30%, #fef08a 0px, transparent 50%)",
        "radial-gradient(at 100% 70%, #fed7aa 0px, transparent 50%)",
        "radial-gradient(at 60% 0%, #d9f99d 0px, transparent 40%)",
      ].join(", "),
    },
  },
  {
    id: "nebula",
    get label() { return tr("preset.bg.nebula"); },
    category: "gradient",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: [
        "radial-gradient(at 10% 20%, #e9d5ff 0px, transparent 50%)",
        "radial-gradient(at 90% 80%, #bae6fd 0px, transparent 50%)",
        "radial-gradient(at 50% 100%, #fce7f3 0px, transparent 40%)",
      ].join(", "),
    },
  },
  {
    id: "cherry-blossom",
    get label() { return tr("preset.bg.cherry-blossom"); },
    category: "gradient",
    style: {
      backgroundColor: "#fff1f2",
      backgroundImage: [
        "radial-gradient(at 10% 10%, #fecdd3 0px, transparent 45%)",
        "radial-gradient(at 90% 90%, #fbcfe8 0px, transparent 45%)",
        "radial-gradient(at 50% 50%, #fff1f2 0px, transparent 60%)",
      ].join(", "),
    },
  },
  {
    id: "espresso",
    get label() { return tr("preset.bg.espresso"); },
    category: "gradient",
    style: {
      backgroundColor: "#faf5ef",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #fef3c7 0px, transparent 45%)",
        "radial-gradient(at 100% 100%, #fed7aa 0px, transparent 45%)",
        "radial-gradient(at 50% 50%, #ffedd5 0px, transparent 50%)",
      ].join(", "),
    },
  },
  {
    id: "breeze",
    get label() { return tr("preset.bg.breeze"); },
    category: "gradient",
    style: {
      backgroundColor: "#f0fdf4",
      backgroundImage: [
        "radial-gradient(at 0% 100%, #bbf7d0 0px, transparent 50%)",
        "radial-gradient(at 100% 0%, #bae6fd 0px, transparent 50%)",
      ].join(", "),
    },
  },
  {
    id: "midnight-mist",
    get label() { return tr("preset.bg.midnight-mist"); },
    category: "gradient",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #cbd5e1 0px, transparent 45%)",
        "radial-gradient(at 100% 100%, #e2e8f0 0px, transparent 50%)",
        "radial-gradient(at 50% 0%, #e0e7ff 0px, transparent 40%)",
      ].join(", "),
    },
  },
  {
    id: "rose-gold",
    get label() { return tr("preset.bg.rose-gold"); },
    category: "gradient",
    style: {
      backgroundColor: "#fff7ed",
      backgroundImage: [
        "radial-gradient(at 20% 20%, #fecdd3 0px, transparent 50%)",
        "radial-gradient(at 80% 80%, #fef08a 0px, transparent 50%)",
      ].join(", "),
    },
  },
  {
    id: "lavender-dusk",
    get label() { return tr("preset.bg.lavender-dusk"); },
    category: "gradient",
    style: {
      backgroundColor: "#faf5ff",
      backgroundImage: [
        "radial-gradient(at 0% 100%, #ddd6fe 0px, transparent 50%)",
        "radial-gradient(at 100% 0%, #e0e7ff 0px, transparent 50%)",
        "radial-gradient(at 50% 50%, #fdf4ff 0px, transparent 50%)",
      ].join(", "),
    },
  },
  {
    id: "emerald-spring",
    get label() { return tr("preset.bg.emerald-spring"); },
    category: "gradient",
    style: {
      backgroundColor: "#f0fdf4",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #a7f3d0 0px, transparent 45%)",
        "radial-gradient(at 100% 100%, #bbf7d0 0px, transparent 45%)",
        "radial-gradient(at 50% 0%, #fef9c3 0px, transparent 40%)",
      ].join(", "),
    },
  },
  {
    id: "coral-reef",
    get label() { return tr("preset.bg.coral-reef"); },
    category: "gradient",
    style: {
      backgroundColor: "#fff7ed",
      backgroundImage: [
        "radial-gradient(at 0% 50%, #fed7aa 0px, transparent 50%)",
        "radial-gradient(at 100% 50%, #a5f3fc 0px, transparent 45%)",
      ].join(", "),
    },
  },
  {
    id: "cyberpunk-light",
    get label() { return tr("preset.bg.cyberpunk-light"); },
    category: "gradient",
    style: {
      backgroundColor: "#faf5ff",
      backgroundImage: [
        "radial-gradient(at 0% 0%, #f5d0fe 0px, transparent 45%)",
        "radial-gradient(at 100% 100%, #a5f3fc 0px, transparent 45%)",
      ].join(", "),
    },
  },

  // ==========================================
  // --- PHẦN 2: HỌA TIẾT & VỞ (PATTERNS - 24 LOẠI) ---
  // ==========================================
  {
    id: "plain",
    get label() { return tr("preset.bg.plain"); },
    category: "pattern",
    style: { backgroundColor: "#ffffff" },
  },
  {
    id: "dots",
    get label() { return tr("preset.bg.dots"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
      backgroundSize: "20px 20px",
    },
  },
  {
    id: "grid",
    get label() { return tr("preset.bg.grid"); },
    category: "pattern",
    style: {
      backgroundColor: "#fbfcfd",
      backgroundImage: [
        "linear-gradient(to right, #e2e8f0 1px, transparent 1px)",
        "linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
      ].join(", "),
      backgroundSize: "24px 24px",
    },
  },
  {
    id: "notebook",
    get label() { return tr("preset.bg.notebook"); },
    category: "pattern",
    style: {
      backgroundColor: "#fffdfa",
      backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, #e7e5e4 28px)",
    },
  },
  {
    id: "crosshatch",
    get label() { return tr("preset.bg.crosshatch"); },
    category: "pattern",
    style: {
      backgroundColor: "#fcfdfe",
      backgroundImage: [
        "linear-gradient(to right, #cbd5e1 1px, transparent 1px)",
        "linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)",
      ].join(", "),
      backgroundSize: "14px 14px",
    },
  },
  {
    id: "blueprint",
    get label() { return tr("preset.bg.blueprint"); },
    category: "pattern",
    style: {
      backgroundColor: "#f0f6ff",
      backgroundImage: [
        "linear-gradient(to right, #dbeafe 1px, transparent 1px)",
        "linear-gradient(to bottom, #dbeafe 1px, transparent 1px)",
        "linear-gradient(to right, #bfdbfe 1px, transparent 1px)",
        "linear-gradient(to bottom, #bfdbfe 1px, transparent 1px)",
      ].join(", "),
      backgroundSize: "20px 20px, 20px 20px, 100px 100px, 100px 100px",
    },
  },
  {
    id: "isometric",
    get label() { return tr("preset.bg.isometric"); },
    category: "pattern",
    style: {
      backgroundColor: "#fafbfc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='52' viewBox='0 0 30 52'%3E%3Cpath d='M15 0L0 26l15 26 15-26L15 0zm0 52v-26M0 26h30' fill='none' stroke='%23cbd5e1' stroke-width='0.8' stroke-opacity='0.45'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "circuit",
    get label() { return tr("preset.bg.circuit"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' stroke='%2394a3b8' stroke-width='1' stroke-opacity='0.3'%3E%3Cpath d='M30 0v20M0 30h20M40 30h20M30 40v20M20 20h20v20H20z'/%3E%3Ccircle cx='30' cy='30' r='3' fill='%2394a3b8' fill-opacity='0.35'/%3E%3Ccircle cx='0' cy='0' r='2' fill='%2394a3b8' fill-opacity='0.25'/%3E%3C/g%3E%3C/svg%3E")`,
    },
  },
  {
    id: "waves",
    get label() { return tr("preset.bg.waves"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='20' viewBox='0 0 80 20'%3E%3Cpath d='M0 10 Q 20 0, 40 10 T 80 10' fill='none' stroke='%2394a3b8' stroke-width='1.2' stroke-opacity='0.25'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "graph-paper",
    get label() { return tr("preset.bg.graph-paper"); },
    category: "pattern",
    style: {
      backgroundColor: "#fbfcfd",
      backgroundImage: [
        "linear-gradient(to right, #e2e8f0 1px, transparent 1px)",
        "linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
        "linear-gradient(to right, #cbd5e1 1.5px, transparent 1.5px)",
        "linear-gradient(to bottom, #cbd5e1 1.5px, transparent 1.5px)",
      ].join(", "),
      backgroundSize: "10px 10px, 10px 10px, 50px 50px, 50px 50px",
    },
  },
  {
    id: "hexagons",
    get label() { return tr("preset.bg.hexagons"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.89v12.72l11 6.35 11-6.35V17.89L14 11.54 3 17.89z' fill='%2394a3b8' fill-opacity='0.22'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "plus-matrix",
    get label() { return tr("preset.bg.plus-matrix"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M16 11v10M11 16h10' stroke='%2394a3b8' stroke-width='1.2' stroke-linecap='square' stroke-opacity='0.35'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "diagonal-stripes",
    get label() { return tr("preset.bg.diagonal-stripes"); },
    category: "pattern",
    style: {
      backgroundColor: "#fafbfc",
      backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 12px, #e2e8f0 12px, #e2e8f0 13px)",
    },
  },
  {
    id: "polka-dense",
    get label() { return tr("preset.bg.polka-dense"); },
    category: "pattern",
    style: {
      backgroundColor: "#fbfcfd",
      backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
      backgroundSize: "12px 12px",
    },
  },
  {
    id: "carbon",
    get label() { return tr("preset.bg.carbon"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M0 0h8v8H0zm8 8h8v8H8z' fill='%23e2e8f0' fill-opacity='0.6'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "terrazzo",
    get label() { return tr("preset.bg.terrazzo"); },
    category: "pattern",
    style: {
      backgroundColor: "#fbfbfc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cpath d='M12 8l4 6-5 3zM45 10l5 2-2 5-4-1zM28 35l6 1-2 5-5-2zM52 48l3 5-5 2zM10 50l4 1-1 4-4-2z' fill='%2394a3b8' fill-opacity='0.28'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "stars",
    get label() { return tr("preset.bg.stars"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M24 18l1.5 4.5H30l-4 3 1.5 4.5-3.5-2.5-3.5 2.5 1.5-4.5-4-3h4.5z' fill='%2394a3b8' fill-opacity='0.25'/%3E%3Ccircle cx='6' cy='8' r='1' fill='%2394a3b8' fill-opacity='0.3'/%3E%3Ccircle cx='42' cy='38' r='1.2' fill='%2394a3b8' fill-opacity='0.3'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "cubes",
    get label() { return tr("preset.bg.cubes"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='55.42' viewBox='0 0 32 55.42'%3E%3Cpath d='M16 0l16 9.24v18.47L16 36.95 0 27.71V9.24L16 0zm0 36.95l16 9.24v18.47L16 73.9 0 64.66V46.19l16-9.24z' fill='none' stroke='%23cbd5e1' stroke-width='0.8' stroke-opacity='0.45'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "music-sheet",
    get label() { return tr("preset.bg.music-sheet"); },
    category: "pattern",
    style: {
      backgroundColor: "#fffdfa",
      backgroundImage: [
        "repeating-linear-gradient(transparent, transparent 7px, #e2e8f0 7px, #e2e8f0 8px)",
      ].join(", "),
      backgroundSize: "100% 40px",
    },
  },
  {
    id: "circuit-dense",
    get label() { return tr("preset.bg.circuit-dense"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath d='M0 10h15v10H5v10h15v10M25 0v10h15M25 20h10v20' fill='none' stroke='%2394a3b8' stroke-width='1' stroke-opacity='0.28'/%3E%3Ccircle cx='15' cy='10' r='2' fill='%2394a3b8' fill-opacity='0.35'/%3E%3Ccircle cx='25' cy='20' r='2' fill='%2394a3b8' fill-opacity='0.35'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "topography",
    get label() { return tr("preset.bg.topography"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cpath d='M0 20c15-5 30 10 60 0M0 40c20 10 35-15 60 5' fill='none' stroke='%2394a3b8' stroke-width='1' stroke-opacity='0.25'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "moroccan",
    get label() { return tr("preset.bg.moroccan"); },
    category: "pattern",
    style: {
      backgroundColor: "#fbfcfd",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Cpath d='M18 0l9 9-9 9-9-9 9-9zm0 18l9 9-9 9-9-9 9-9z' fill='none' stroke='%23cbd5e1' stroke-width='1' stroke-opacity='0.35'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "bamboo",
    get label() { return tr("preset.bg.bamboo"); },
    category: "pattern",
    style: {
      backgroundColor: "#faf9f6",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M0 0h12v12H0zm12 12h12v12H12z' fill='%23e7e5e4' fill-opacity='0.45'/%3E%3Cpath d='M12 0h12v12H12zM0 12h12v12H0z' fill='none' stroke='%23e7e5e4' stroke-width='0.8' stroke-opacity='0.35'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "chevron",
    get label() { return tr("preset.bg.chevron"); },
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'%3E%3Cpath d='M0 10l20-10 20 10-20 10L0 10z' fill='none' stroke='%23cbd5e1' stroke-width='1' stroke-opacity='0.35'/%3E%3C/svg%3E")`,
    },
  },
];

export const isAccentId = (value: unknown): value is AccentId =>
  typeof value === "string" && (ACCENT_IDS as readonly string[]).includes(value);

export const isBackgroundId = (value: unknown): value is BackgroundId =>
  typeof value === "string" && (BACKGROUND_IDS as readonly string[]).includes(value);
