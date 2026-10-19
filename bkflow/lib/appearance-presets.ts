import type { AccentId, Appearance, BackgroundId } from "@/constants/appearance";

export const THEME_PRESETS = [
  { id: "classic", label: "Mặc định", accent: "blue", background: "glow" },
  { id: "lavender", label: "Oải hương", accent: "violet", background: "lavender" },
  { id: "mint", label: "Bạc hà", accent: "emerald", background: "mint" },
] as const;

export const THEME_COLLECTIONS = [
  { id: "essentials", label: "Tinh giản", description: "Nhẹ nhàng, để ý tưởng có chỗ lên tiếng." },
  { id: "seasons", label: "Bốn mùa", description: "Một khung cửa nhỏ mở ra thiên nhiên." },
  { id: "places", label: "Góc thân quen", description: "Mang một nơi bạn yêu vào ngày học mới." },
] as const;
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
  { id: "classic", label: "Mặc định", accent: "blue", background: "glow", category: "essentials", description: "Trong trẻo & gọn gàng" },
  { id: "lavender", label: "Oải hương", accent: "violet", background: "lavender", category: "essentials", description: "Một chút dịu dàng" },
  { id: "mint", label: "Bạc hà", accent: "emerald", background: "mint", category: "essentials", description: "Mát lành & nhẹ tênh" },
  { id: "espresso", label: "Cà phê sữa", accent: "coffee", background: "espresso", category: "essentials", description: "Ấm áp như trang giấy" },
  { id: "spring-garden", label: "Vườn xuân", accent: "emerald", background: "scene-spring", category: "seasons", description: "Lối nhỏ qua mùa hoa" },
  { id: "summer-coast", label: "Hạ bên biển", accent: "cyan", background: "scene-summer", category: "seasons", description: "Nắng vàng, sóng xanh" },
  { id: "autumn-walk", label: "Lá thu", accent: "amber", background: "scene-autumn", category: "seasons", description: "Chậm một nhịp giữa sắc thu" },
  { id: "winter-silence", label: "Đông yên", accent: "slate", background: "scene-winter", category: "seasons", description: "Góc ấm giữa ngày tuyết" },
  { id: "campus", label: "Sân trường", accent: "ruby", background: "scene-campus", category: "places", description: "Một ngày nắng ở Bách Khoa" },
  { id: "library", label: "Góc thư viện", accent: "coffee", background: "scene-library", category: "places", description: "Nơi những ý tưởng bắt đầu" },
  { id: "hanoi", label: "Hà Nội chiều", accent: "coral", background: "scene-hanoi", category: "places", description: "Mặt hồ giữ lại hoàng hôn" },
  { id: "observatory", label: "Trạm ngắm sao", accent: "indigo", background: "scene-observatory", category: "places", description: "Cho những giấc mơ xa" },
] as const satisfies readonly ThemePreset[];

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
