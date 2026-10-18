"use client";

import { useMemo, useState } from "react";
import { Check, Palette, Sparkles, LayoutGrid, Paintbrush, Sun, Moon, Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppearance } from "@/components/providers/appearance-provider";
import {
  ACCENTS,
  BACKGROUNDS,
  type BackgroundCategory,
} from "@/constants/appearance";
import { cn } from "@/lib/utils";
import { useColorMode, type ColorMode } from "@/hooks/use-color-mode";
import { PageStyleControls } from "@/components/notes/page-style-controls";

const COLOR_MODES: { id: ColorMode; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Sáng", Icon: Sun },
  { id: "dark", label: "Tối", Icon: Moon },
  { id: "system", label: "Theo hệ thống", Icon: Monitor },
];

export const AppearancePopover = () => {
  const { mode, setMode } = useColorMode();
  const { accent, background, setAccent, setBackground, pageStyle, setPageStyle } = useAppearance();
  const [filter, setFilter] = useState<BackgroundCategory>("all");

  const activeAccent = useMemo(
    () => ACCENTS.find((item) => item.id === accent),
    [accent],
  );

  const filteredBackgrounds = useMemo(() => {
    if (filter === "all") return BACKGROUNDS;
    return BACKGROUNDS.filter((item) => item.category === filter);
  }, [filter]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Tùy chỉnh giao diện"
          className="h-8 w-8 text-neutral-500 hover:text-violet-700 hover:bg-violet-50"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={12} className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:w-[420px] p-4">
        <div className="space-y-4">
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">Kiểu trang ghi chú mặc định</summary>
            <p className="my-3 text-xs text-muted-foreground">Áp dụng cho các trang chưa có kiểu riêng. Tùy chỉnh ngay trong trang để giữ một kiểu khác.</p>
            <PageStyleControls value={pageStyle} onChange={setPageStyle} />
          </details>
          <div role="radiogroup" aria-label="Chế độ sáng tối" className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-100/80 p-0.5 text-[11px]">
            {COLOR_MODES.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={mode === id}
                onClick={() => setMode(id)}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-1.5 font-medium transition-all",
                  mode === id ? "bg-white text-neutral-800 shadow-xs" : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          {/* Accent Color Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <Paintbrush className="h-3.5 w-3.5 text-neutral-400" />
                Màu chủ đạo ({ACCENTS.length})
              </h3>
              <span className="text-[11px] font-medium text-violet-700">
                {activeAccent?.label}
              </span>
            </div>

            <div role="radiogroup" aria-label="Màu chủ đạo" className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto styled-scrollbar p-0.5">
              {ACCENTS.map((item) => {
                const isActive = item.id === accent;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    aria-label={item.label}
                    title={item.label}
                    onClick={() => setAccent(item.id)}
                    className={cn(
                      "h-6.5 w-6.5 rounded-full flex items-center justify-center cursor-pointer transition-transform duration-150 hover:scale-115 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400 shadow-xs",
                      isActive && "ring-2 ring-offset-2 ring-violet-500 scale-110",
                    )}
                    style={{ backgroundColor: item.swatch }}
                  >
                    {isActive && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="h-px bg-neutral-100" />

          {/* Background Selection Section */}
          <section className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5 text-neutral-400" />
                Hình nền không gian ({BACKGROUNDS.length})
              </h3>
              <span className="text-[11px] text-neutral-400">Bảng giữ ảnh riêng</span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100/80 text-[11px]">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "flex-1 py-1 px-2 rounded-md font-medium transition-all text-center cursor-pointer",
                  filter === "all"
                    ? "bg-white text-neutral-800 shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                Tất cả ({BACKGROUNDS.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("gradient")}
                className={cn(
                  "flex-1 py-1 px-2 rounded-md font-medium transition-all text-center cursor-pointer flex items-center justify-center gap-1",
                  filter === "gradient"
                    ? "bg-white text-neutral-800 shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                <Sparkles className="h-3 w-3 text-amber-500" />
                Chuyển màu ({BACKGROUNDS.filter((b) => b.category === "gradient").length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("pattern")}
                className={cn(
                  "flex-1 py-1 px-2 rounded-md font-medium transition-all text-center cursor-pointer",
                  filter === "pattern"
                    ? "bg-white text-neutral-800 shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                Họa tiết & Vở ({BACKGROUNDS.filter((b) => b.category === "pattern").length})
              </button>
            </div>

            {/* Scrollable Backgrounds Grid */}
            <div
              role="radiogroup"
              aria-label="Hình nền"
              className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto styled-scrollbar pr-1"
            >
              {filteredBackgrounds.map((item) => {
                const isActive = item.id === background;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setBackground(item.id)}
                    className="group flex flex-col gap-1 cursor-pointer text-left focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        "relative block h-14 w-full rounded-lg border transition-all duration-150 group-hover:border-violet-300 group-hover:shadow-xs group-focus-visible:ring-2 group-focus-visible:ring-violet-400",
                        isActive ? "border-violet-500 ring-2 ring-violet-200 shadow-xs" : "border-neutral-200",
                      )}
                      style={item.style}
                    >
                      {isActive && (
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 shadow-xs">
                          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] truncate block",
                        isActive ? "font-semibold text-violet-700" : "text-neutral-600",
                      )}
                      title={item.label}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
};
