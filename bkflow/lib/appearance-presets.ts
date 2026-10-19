import type { AccentId, Appearance, BackgroundId } from "@/constants/appearance";

export const THEME_PRESETS = [
  { id: "classic", label: "Mặc định", accent: "blue", background: "glow" },
  { id: "lavender", label: "Oải hương", accent: "violet", background: "lavender" },
  { id: "mint", label: "Bạc hà", accent: "emerald", background: "mint" },
] as const;

export type PresetCategory = "featured" | "study" | "nature" | "minimal" | "tech";

export type ThemePreset = {
  id: string;
  label: string;
  accent: AccentId;
  background: BackgroundId;
  category: PresetCategory;
  description: string;
};

export const ALL_THEME_PRESETS: readonly ThemePreset[] = [
  // Nhóm Nổi bật & Cổ điển
  { id: "classic", label: "Mặc định", accent: "blue", background: "glow", category: "featured", description: "Xanh dương kết hợp ánh sáng dịu nhẹ" },
  { id: "lavender", label: "Oải hương", accent: "violet", background: "lavender", category: "featured", description: "Tím thanh lịch nhẹ nhàng, thư thái cho mắt" },
  { id: "mint", label: "Bạc hà", accent: "emerald", background: "mint", category: "featured", description: "Bạc hà tươi mát giúp nâng cao độ tập trung" },
  { id: "cotton-candy", label: "Kẹo bông gòn", accent: "pink", background: "cotton-candy", category: "featured", description: "Hồng pastel nhẹ nhàng, cảm giác bay bổng thư thái" },
  { id: "sunrise-gold", label: "Bình minh rực rỡ", accent: "gold", background: "sunrise", category: "featured", description: "Nắng vàng ban mai đón chào ngày học mới đầy năng lượng" },

  // Nhóm Học tập Bách Khoa & Năng lượng
  { id: "hust-ruby", label: "Đỏ Bách Khoa", accent: "ruby", background: "sunset", category: "study", description: "Màu cờ sắc áo BK nhiệt huyết, giàu cảm hứng" },
  { id: "tqb-library", label: "Thư viện Tạ Quang Bửu", accent: "navy", background: "ocean", category: "study", description: "Xanh tri thức và không gian tự học tĩnh lặng" },
  { id: "deep-ocean", label: "Đại dương sâu", accent: "sky", background: "ocean", category: "study", description: "Xanh biển thẳm giúp tĩnh tâm tư duy logic" },
  { id: "espresso", label: "Cà phê giảng đường", accent: "coffee", background: "espresso", category: "study", description: "Tông màu cà phê ấm cúng cho những đêm ôn thi" },
  { id: "warm-sand", label: "Giảng đường mùa thu", accent: "amber", background: "warm-sand", category: "study", description: "Nắng vàng ấm áp như khuôn viên Bách Khoa" },
  { id: "exam-season", label: "Mùa thi bứt phá", accent: "orange", background: "citrus", category: "study", description: "Cam rực rỡ tràn đầy sinh lực vượt qua mọi kỳ thi" },

  // Nhóm Thiên nhiên & Tươi mới
  { id: "sakura", label: "Hoa anh đào", accent: "rose", background: "sakura", category: "nature", description: "Sắc hồng đào Nhật Bản nhẹ nhàng, tươi sáng" },
  { id: "matcha-zen", label: "Trà xanh Matcha", accent: "sage", background: "matcha", category: "nature", description: "Xanh trà dịu mắt giúp giảm căng thẳng học tập" },
  { id: "emerald-spring", label: "Mùa xuân biếc", accent: "forest", background: "emerald-spring", category: "nature", description: "Xanh ngát thiên nhiên mầm chồi mùa xuân" },
  { id: "sunset-glow", label: "Hoàng hôn mùa hạ", accent: "orange", background: "peach", category: "nature", description: "Cam san hô ấm áp thư thái cuối ngày học tập" },
  { id: "breeze", label: "Gió thu trong lành", accent: "teal", background: "breeze", category: "nature", description: "Xanh ngọc mát mẻ thoáng đãng và dễ chịu" },
  { id: "coral-reef", label: "Rạn san hô", accent: "coral", background: "coral-reef", category: "nature", description: "Sắc màu rực rỡ từ thế giới đại dương bao la" },

  // Nhóm Tối giản & Hiện đại
  { id: "nordic-slate", label: "Bắc Âu tối giản", accent: "slate", background: "nordic", category: "minimal", description: "Phong cách Scandinavian đơn giản, thanh nhã" },
  { id: "royal-purple", label: "Tím hoàng gia", accent: "purple", background: "twilight", category: "minimal", description: "Chiều tím hoàng hôn sang trọng và sâu lắng" },
  { id: "aurora", label: "Cực quang đa sắc", accent: "indigo", background: "aurora", category: "minimal", description: "Vũ điệu cực quang phương Bắc kỳ ảo" },
  { id: "midnight-study", label: "Đêm sương mù", accent: "stone", background: "midnight-mist", category: "minimal", description: "Tông trầm tối giản dành cho cú đêm tập trung cao độ" },
  { id: "rose-gold", label: "Vàng hồng thanh lịch", accent: "crimson", background: "rose-gold", category: "minimal", description: "Sự kết hợp tinh tế giữa quý phái và hiện đại" },

  // Nhóm Kỹ thuật & Công nghệ HUST
  { id: "math-grid", label: "Giấy kẻ đồ thị", accent: "blue", background: "graph-paper", category: "tech", description: "Lưới caro kỹ thuật quen thuộc với sinh viên" },
  { id: "blueprint", label: "Bản vẽ kỹ thuật", accent: "navy", background: "blueprint", category: "tech", description: "Bản vẽ đồ họa kỹ thuật cơ khí & xây dựng" },
  { id: "circuit", label: "Vi mạch số", accent: "cyan", background: "circuit", category: "tech", description: "Bo mạch điện tử công nghệ thông tin viễn thông" },
  { id: "cyberpunk", label: "Cyberpunk Neon", accent: "fuchsia", background: "cyberpunk-light", category: "tech", description: "Ánh neon tương lai sắc nét và sống động" },
  { id: "matrix-code", label: "Ma trận số", accent: "emerald", background: "plus-matrix", category: "tech", description: "Lưới ma trận thuật toán và lập trình máy tính" },
  { id: "cosmos", label: "Vũ trụ tinh tú", accent: "indigo", background: "stars", category: "tech", description: "Bầu trời đêm ngàn sao của những ước mơ lớn" },
] as const;

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
