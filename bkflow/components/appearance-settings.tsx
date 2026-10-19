"use client";

import { useState } from "react";
import { Check, Monitor, Moon, Sun, Sparkles } from "lucide-react";
import { ACCENTS, BACKGROUNDS } from "@/constants/appearance";
import { ALL_THEME_PRESETS, getActivePreset, type PresetCategory } from "@/lib/appearance-presets";
import { useAppearance } from "@/components/providers/appearance-provider";
import { PageStyleControls } from "@/components/notes/page-style-controls";
import { useColorMode } from "@/hooks/use-color-mode";

const CATEGORIES: { id: PresetCategory | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "featured", label: "Nổi bật" },
  { id: "study", label: "Học tập HUST" },
  { id: "nature", label: "Thiên nhiên" },
  { id: "minimal", label: "Tối giản" },
  { id: "tech", label: "Kỹ thuật" },
];

export const AppearanceSettings = () => {
  const appearance = useAppearance();
  const active = getActivePreset(appearance);
  const { mode, setMode } = useColorMode();
  const [category, setCategory] = useState<PresetCategory | "all">("all");

  const filteredPresets = category === "all"
    ? ALL_THEME_PRESETS
    : ALL_THEME_PRESETS.filter((p) => p.category === category);

  return <main className="mx-auto w-full max-w-4xl space-y-8 px-5 pb-16 pt-24">
    <header>
      <p className="text-sm text-muted-foreground">Cài đặt</p>
      <h1 className="mt-1 text-2xl font-semibold">Giao diện</h1>
      <p className="mt-2 text-sm text-muted-foreground">Chọn một giao diện phối sẵn từ {ALL_THEME_PRESETS.length} chủ đề độc quyền. Lựa chọn được lưu theo tài khoản.</p>
    </header>
    <fieldset>
      <div className="flex items-center justify-between mb-3">
        <legend className="font-medium">Chủ đề giao diện</legend>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                category === cat.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
      {active === "legacy" && <p className="mb-4 rounded-lg border bg-card p-3 text-sm">Giao diện hiện tại — cấu hình cũ được giữ đến khi bạn chọn theme mới.</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        {filteredPresets.map(preset => <label key={preset.id} data-accent={preset.accent} className="relative cursor-pointer rounded-xl border bg-card p-3 text-card-foreground has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring hover:border-primary/50 transition-all">
          <input type="radio" name="theme" value={preset.id} checked={active === preset.id} onChange={() => appearance.selectPreset(preset.id)} className="sr-only" />
          <div aria-hidden="true" className="mb-3 flex h-32 items-center rounded-lg p-3" style={BACKGROUNDS.find(b => b.id === preset.background)?.style}>
            <div className="w-full rounded-lg border bg-card p-3 text-card-foreground shadow-sm"><div className="mb-2 h-1.5 w-14 rounded" style={{ backgroundColor: ACCENTS.find(a => a.id === preset.accent)?.swatch }} /><p className="text-xs font-semibold">Kế hoạch hôm nay</p><p className="mt-1 text-[11px] text-muted-foreground">Công việc và ghi chú</p><span className="mt-2 inline-block rounded px-2 py-1 text-[10px] text-white" style={{ backgroundColor: ACCENTS.find(a => a.id === preset.accent)?.swatch }}>Thêm việc</span></div>
          </div>
          <span className="flex items-center justify-between gap-2 text-sm font-medium">{preset.label}{active === preset.id && <span className="inline-flex items-center gap-1 text-xs"><Check aria-hidden="true" className="size-3" />Đang dùng</span>}</span>
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{preset.description}</p>
        </label>)}
      </div>
      <p role="status" className="mt-3 min-h-5 text-sm text-muted-foreground">{appearance.saveStatus === "saving" ? "Đang lưu…" : appearance.saveStatus === "saved" ? "Đã lưu giao diện." : appearance.saveStatus === "error" ? "Chưa lưu được. Đã khôi phục giao diện đã lưu." : ""}</p>
    </fieldset>
    <fieldset><legend className="mb-2 font-medium">Chế độ sáng tối</legend><p className="mb-3 text-sm text-muted-foreground">Áp dụng trên thiết bị này.</p>
      <div className="flex flex-wrap gap-2">{([{ id: "light", label: "Sáng", Icon: Sun }, { id: "dark", label: "Tối", Icon: Moon }, { id: "system", label: "Theo hệ thống", Icon: Monitor }] as const).map(({ id, label, Icon }) => <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm has-[:checked]:ring-2 has-[:checked]:ring-primary"><input type="radio" name="color-mode" value={id} checked={mode === id} onChange={() => setMode(id)} /><Icon aria-hidden="true" className="size-4" />{label}</label>)}</div>
    </fieldset>
    <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-medium">Kiểu Trang mặc định</summary><p className="my-3 text-sm text-muted-foreground">Chỉ áp dụng cho Trang chưa có kiểu riêng. Đổi theme không thay các thiết lập này.</p><PageStyleControls value={appearance.pageStyle} onChange={appearance.setPageStyle} /></details>
  </main>;
};
