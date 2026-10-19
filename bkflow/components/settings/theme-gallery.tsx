"use client";

import { useId } from "react";
import { Check, Coffee, Flower2, Leaf, Sun } from "lucide-react";

import { ACCENTS, BACKGROUNDS, type Appearance } from "@/constants/appearance";
import { ALL_THEME_PRESETS, THEME_COLLECTIONS, getActivePreset, type AppearanceSaveStatus, type ThemePresetId } from "@/lib/appearance-presets";
import { cn } from "@/lib/utils";

const ESSENTIAL_ICONS = { classic: Sun, lavender: Flower2, mint: Leaf, espresso: Coffee };

type ThemeGalleryProps = {
  appearance: Pick<Appearance, "accent" | "background">;
  onSelect: (id: ThemePresetId) => void;
  saveStatus: AppearanceSaveStatus;
};

export const ThemeGallery = ({ appearance, onSelect, saveStatus }: ThemeGalleryProps) => {
  const name = useId();
  const activeId = getActivePreset(appearance);
  const active = ALL_THEME_PRESETS.find(preset => preset.id === activeId);
  const currentAccent = ACCENTS.find(accent => accent.id === appearance.accent);

  return <section className="space-y-7" aria-label="Bộ sưu tập Giao diện">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Không gian của bạn</p>
        <h3 className="text-xl font-semibold tracking-tight text-foreground">Bộ sưu tập Giao diện</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">Một chút cảm hứng cho mỗi ngày học.</p>
      </div>
      <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: currentAccent?.swatch }} />
        <span className="truncate">Đang dùng · {active?.label ?? "Tùy chỉnh"}</span>
      </div>
    </header>

    <fieldset className="space-y-7">
      <legend className="sr-only">Chọn giao diện</legend>
      {THEME_COLLECTIONS.map(collection => <section key={collection.id} aria-labelledby={`${name}-${collection.id}`}>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h4 id={`${name}-${collection.id}`} className="text-sm font-semibold text-foreground">{collection.label}</h4>
          <p className="text-xs text-muted-foreground">{collection.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {ALL_THEME_PRESETS.filter(preset => preset.category === collection.id).map(preset => {
            const selected = activeId === preset.id;
            const background = BACKGROUNDS.find(item => item.id === preset.background);
            const accent = ACCENTS.find(item => item.id === preset.accent);
            const Icon = preset.category === "essentials" ? ESSENTIAL_ICONS[preset.id] : null;
            return <label key={preset.id} className="group min-w-0 cursor-pointer">
              <input type="radio" name={name} value={preset.id} checked={selected} onChange={() => onSelect(preset.id)} className="peer sr-only" />
              <div className={cn(
                "relative rounded-2xl border bg-card p-1 transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring",
                selected ? "border-foreground ring-1 ring-foreground" : "border-border group-hover:border-muted-foreground/60 group-hover:shadow-sm",
              )}>
                {background?.artwork ? <img
                  src={background.artwork} alt="" aria-hidden="true" width={960} height={540}
                  loading="lazy" decoding="async" className="aspect-video w-full rounded-xl object-cover"
                /> : <div aria-hidden="true" className="relative flex aspect-[2.3/1] items-center justify-center overflow-hidden rounded-xl" style={background?.style}>
                  <span className="absolute -bottom-9 -right-4 size-24 rounded-full opacity-[0.07]" style={{ backgroundColor: accent?.swatch }} />
                  <span className="absolute -left-7 -top-8 size-24 rounded-full border opacity-[0.12]" style={{ borderColor: accent?.swatch }} />
                  {Icon && <Icon className="size-7" strokeWidth={1.25} style={{ color: accent?.swatch }} />}
                </div>}
                {selected && <span aria-hidden="true" className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-foreground text-background shadow-sm ring-2 ring-card">
                  <Check className="size-3.5" strokeWidth={2.5} />
                </span>}
              </div>
              <div className="px-0.5 pt-2.5">
                <span className="block text-[13px] font-medium text-foreground">{preset.label}<span className="sr-only">{selected ? ", đang dùng" : ""}</span></span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{preset.description}</span>
              </div>
            </label>;
          })}
        </div>
      </section>)}
    </fieldset>
    <p role="status" aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
      {saveStatus === "saving" ? "Đang lưu giao diện…" : saveStatus === "saved" ? "Đã lưu vào tài khoản của bạn." : saveStatus === "error" ? "Chưa lưu được. Đã khôi phục giao diện đã lưu." : activeId === "legacy" ? "Giao diện tùy chỉnh của bạn vẫn được giữ nguyên đến khi chọn chủ đề mới." : "Chọn một chủ đề để đổi màu nhấn và hình nền cùng lúc."}
    </p>
  </section>;
};
