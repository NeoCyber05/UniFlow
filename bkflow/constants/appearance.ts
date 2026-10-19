import type { CSSProperties } from "react";
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
  { id: "blue", label: "Xanh dương cổ điển", swatch: "#2563eb" },
  { id: "indigo", label: "Chàm trí tuệ", swatch: "#4f46e5" },
  { id: "violet", label: "Tím thanh lịch", swatch: "#7c3aed" },
  { id: "purple", label: "Tím hoàng gia", swatch: "#9333ea" },
  { id: "fuchsia", label: "Hồng cánh sen", swatch: "#a21caf" },
  { id: "pink", label: "Hồng phấn tươi", swatch: "#db2777" },
  { id: "rose", label: "Hồng đào dịu", swatch: "#e11d48" },
  { id: "ruby", label: "Đỏ Bách Khoa", swatch: "#dc2626" },
  { id: "crimson", label: "Đỏ thẫm sang", swatch: "#be123c" },
  { id: "coral", label: "Cam san hô", swatch: "#ea580c" },
  { id: "orange", label: "Cam cháy năng lượng", swatch: "#c2410c" },
  { id: "amber", label: "Hổ phách ấm áp", swatch: "#b45309" },
  { id: "gold", label: "Vàng hoàng kim", swatch: "#ca8a04" },
  { id: "yellow", label: "Vàng nắng rực rỡ", swatch: "#d97706" },
  { id: "lime", label: "Xanh cốm non", swatch: "#4d7c0f" },
  { id: "green", label: "Xanh lá tự nhiên", swatch: "#16a34a" },
  { id: "emerald", label: "Ngọc lục bảo", swatch: "#047857" },
  { id: "forest", label: "Xanh rừng sâu", swatch: "#15803d" },
  { id: "teal", label: "Xanh mòng két", swatch: "#0f766e" },
  { id: "cyan", label: "Xanh ngọc bích", swatch: "#0e7490" },
  { id: "sky", label: "Xanh da trời tự do", swatch: "#0284c7" },
  { id: "navy", label: "Xanh hải quân đậm", swatch: "#1d4ed8" },
  { id: "sage", label: "Xanh xô thơm tĩnh", swatch: "#4e6e56" },
  { id: "slate", label: "Xám than chì", swatch: "#475569" },
  { id: "zinc", label: "Ánh kim hiện đại", swatch: "#52525b" },
  { id: "neutral", label: "Xám tối giản", swatch: "#525252" },
  { id: "stone", label: "Đá cuội mộc", swatch: "#57534e" },
  { id: "coffee", label: "Cà phê đậm đà", swatch: "#78350f" },
];

export type BackgroundItem = {
  id: BackgroundId;
  label: string;
  category: Exclude<BackgroundCategory, "all">;
  artwork?: string;
  style: CSSProperties;
};

const SCENIC_BACKGROUNDS = [
  { id: "scene-spring", label: "Vườn xuân", file: "spring", color: "#dcebd9" },
  { id: "scene-summer", label: "Hạ bên biển", file: "summer", color: "#c2e9ed" },
  { id: "scene-autumn", label: "Lá thu", file: "autumn", color: "#f6dbb8" },
  { id: "scene-winter", label: "Đông yên", file: "winter", color: "#cbd9ef" },
  { id: "scene-campus", label: "Sân trường", file: "campus", color: "#f5d9c0" },
  { id: "scene-library", label: "Góc thư viện", file: "library", color: "#e9d8b7" },
  { id: "scene-hanoi", label: "Hà Nội chiều", file: "hanoi", color: "#efb5a1" },
  { id: "scene-observatory", label: "Trạm ngắm sao", file: "observatory", color: "#292b5b" },
] as const;

// Existing gradients and patterns stay valid for saved custom appearances.
export const BACKGROUNDS: BackgroundItem[] = [
  ...SCENIC_BACKGROUNDS.map(({ id, label, file, color }) => ({
    id, label, category: "illustration" as const, artwork: `/theme-art/${file}.svg`,
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
    label: "Ánh sáng đồng bộ",
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
    label: "Cực quang đa sắc",
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
    label: "Bầu trời xanh ngắt",
    category: "gradient",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: "linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 35%, #f8fafc 70%)",
    },
  },
  {
    id: "lavender",
    label: "Oải hương mơ màng",
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
    label: "Hoàng hôn rực rỡ",
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
    label: "Bạc hà mát lạnh",
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
    label: "Chiều tím lãng mạn",
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
    label: "Đại dương sâu thẳm",
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
    label: "Trà xanh thanh mát",
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
    label: "Hoa anh đào",
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
    label: "Quán cà phê ấm áp",
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
    label: "Hoàng hôn mùa hạ",
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
    label: "Bình minh giảng đường",
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
    label: "Bắc Âu tối giản",
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
    label: "Kẹo bông ngọt ngào",
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
    label: "Cam chanh tươi mát",
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
    label: "Tinh vân huyền bí",
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
    label: "Vườn hoa Tokyo",
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
    label: "Cà phê sữa đá",
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
    label: "Gió thu trong lành",
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
    label: "Sương đêm tĩnh lặng",
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
    label: "Vàng hồng quý phái",
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
    label: "Chiều buông tím",
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
    label: "Mùa xuân biếc",
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
    label: "Rạn san hô ấm",
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
    label: "Không gian số",
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
    label: "Trắng tinh khôi",
    category: "pattern",
    style: { backgroundColor: "#ffffff" },
  },
  {
    id: "dots",
    label: "Chấm bi kinh điển",
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
      backgroundSize: "20px 20px",
    },
  },
  {
    id: "grid",
    label: "Lưới ô vuông",
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
    label: "Vở kẻ ngang học sinh",
    category: "pattern",
    style: {
      backgroundColor: "#fffdfa",
      backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, #e7e5e4 28px)",
    },
  },
  {
    id: "crosshatch",
    label: "Giấy caro toán học",
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
    label: "Bản vẽ HUST",
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
    label: "Lưới 3D không gian",
    category: "pattern",
    style: {
      backgroundColor: "#fafbfc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='52' viewBox='0 0 30 52'%3E%3Cpath d='M15 0L0 26l15 26 15-26L15 0zm0 52v-26M0 26h30' fill='none' stroke='%23cbd5e1' stroke-width='0.8' stroke-opacity='0.45'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "circuit",
    label: "Vi mạch số",
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' stroke='%2394a3b8' stroke-width='1' stroke-opacity='0.3'%3E%3Cpath d='M30 0v20M0 30h20M40 30h20M30 40v20M20 20h20v20H20z'/%3E%3Ccircle cx='30' cy='30' r='3' fill='%2394a3b8' fill-opacity='0.35'/%3E%3Ccircle cx='0' cy='0' r='2' fill='%2394a3b8' fill-opacity='0.25'/%3E%3C/g%3E%3C/svg%3E")`,
    },
  },
  {
    id: "waves",
    label: "Gợn sóng êm đềm",
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='20' viewBox='0 0 80 20'%3E%3Cpath d='M0 10 Q 20 0, 40 10 T 80 10' fill='none' stroke='%2394a3b8' stroke-width='1.2' stroke-opacity='0.25'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "graph-paper",
    label: "Giấy kẻ đồ thị",
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
    label: "Tổ ong liên kết",
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.89v12.72l11 6.35 11-6.35V17.89L14 11.54 3 17.89z' fill='%2394a3b8' fill-opacity='0.22'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "plus-matrix",
    label: "Ma trận dấu cộng",
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M16 11v10M11 16h10' stroke='%2394a3b8' stroke-width='1.2' stroke-linecap='square' stroke-opacity='0.35'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "diagonal-stripes",
    label: "Sọc chéo năng động",
    category: "pattern",
    style: {
      backgroundColor: "#fafbfc",
      backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 12px, #e2e8f0 12px, #e2e8f0 13px)",
    },
  },
  {
    id: "polka-dense",
    label: "Chấm bi hạt mịn",
    category: "pattern",
    style: {
      backgroundColor: "#fbfcfd",
      backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
      backgroundSize: "12px 12px",
    },
  },
  {
    id: "carbon",
    label: "Sợi carbon công nghệ",
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M0 0h8v8H0zm8 8h8v8H8z' fill='%23e2e8f0' fill-opacity='0.6'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "terrazzo",
    label: "Đá mài Terrazzo",
    category: "pattern",
    style: {
      backgroundColor: "#fbfbfc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cpath d='M12 8l4 6-5 3zM45 10l5 2-2 5-4-1zM28 35l6 1-2 5-5-2zM52 48l3 5-5 2zM10 50l4 1-1 4-4-2z' fill='%2394a3b8' fill-opacity='0.28'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "stars",
    label: "Bầu trời ngàn sao",
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M24 18l1.5 4.5H30l-4 3 1.5 4.5-3.5-2.5-3.5 2.5 1.5-4.5-4-3h4.5z' fill='%2394a3b8' fill-opacity='0.25'/%3E%3Ccircle cx='6' cy='8' r='1' fill='%2394a3b8' fill-opacity='0.3'/%3E%3Ccircle cx='42' cy='38' r='1.2' fill='%2394a3b8' fill-opacity='0.3'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "cubes",
    label: "Khối lập phương 3D",
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='55.42' viewBox='0 0 32 55.42'%3E%3Cpath d='M16 0l16 9.24v18.47L16 36.95 0 27.71V9.24L16 0zm0 36.95l16 9.24v18.47L16 73.9 0 64.66V46.19l16-9.24z' fill='none' stroke='%23cbd5e1' stroke-width='0.8' stroke-opacity='0.45'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "music-sheet",
    label: "Khuông nhạc nghệ thuật",
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
    label: "Bo mạch vi xử lý",
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath d='M0 10h15v10H5v10h15v10M25 0v10h15M25 20h10v20' fill='none' stroke='%2394a3b8' stroke-width='1' stroke-opacity='0.28'/%3E%3Ccircle cx='15' cy='10' r='2' fill='%2394a3b8' fill-opacity='0.35'/%3E%3Ccircle cx='25' cy='20' r='2' fill='%2394a3b8' fill-opacity='0.35'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "topography",
    label: "Bản đồ đường đồng mức",
    category: "pattern",
    style: {
      backgroundColor: "#f8fafc",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cpath d='M0 20c15-5 30 10 60 0M0 40c20 10 35-15 60 5' fill='none' stroke='%2394a3b8' stroke-width='1' stroke-opacity='0.25'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "moroccan",
    label: "Hoa văn gạch men",
    category: "pattern",
    style: {
      backgroundColor: "#fbfcfd",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Cpath d='M18 0l9 9-9 9-9-9 9-9zm0 18l9 9-9 9-9-9 9-9z' fill='none' stroke='%23cbd5e1' stroke-width='1' stroke-opacity='0.35'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "bamboo",
    label: "Nan tre đan lát",
    category: "pattern",
    style: {
      backgroundColor: "#faf9f6",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M0 0h12v12H0zm12 12h12v12H12z' fill='%23e7e5e4' fill-opacity='0.45'/%3E%3Cpath d='M12 0h12v12H12zM0 12h12v12H0z' fill='none' stroke='%23e7e5e4' stroke-width='0.8' stroke-opacity='0.35'/%3E%3C/svg%3E")`,
    },
  },
  {
    id: "chevron",
    label: "Xương cá Chevron",
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
