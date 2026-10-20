"use client";

import { useId } from "react";
import { tr } from "@/lib/i18n";
import { Check, ChevronDown, Monitor, Moon, SlidersHorizontal, Sun } from "lucide-react";

import { ACCENTS } from "@/constants/appearance";
import { useAppearance } from "@/components/providers/appearance-provider";
import { PageStyleControls } from "@/components/notes/page-style-controls";
import { useColorMode } from "@/hooks/use-color-mode";
import { cn } from "@/lib/utils";
import { StartScreenSetting } from "./start-screen-setting";
import { ThemeGallery } from "./theme-gallery";

export const AppearancePanel = () => {
  const appearance = useAppearance();
  const { mode, setMode } = useColorMode();
  const modeName = useId();

  return <div className="space-y-7">
    <ThemeGallery appearance={appearance} onSelect={appearance.selectPreset} saveStatus={appearance.saveStatus} />

    <fieldset className="border-t border-border pt-6">
      <legend className="sr-only">{tr("appearance.modeLegend")}</legend>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-foreground">{tr("appearance.modeTitle")}</h3>
        <p className="text-xs text-muted-foreground">{tr("appearance.modeDesc")}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([
          { id: "light", label: tr("appearance.mode.light"), Icon: Sun },
          { id: "dark", label: tr("appearance.mode.dark"), Icon: Moon },
          { id: "system", label: tr("appearance.mode.system"), Icon: Monitor },
        ] as const).map(({ id, label, Icon }) => <label key={id} className="cursor-pointer">
          <input type="radio" name={modeName} checked={mode === id} onChange={() => setMode(id)} className="peer sr-only" />
          <span className={cn("flex min-h-12 items-center justify-center gap-2 rounded-xl border text-xs font-medium transition-colors motion-reduce:transition-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring", mode === id ? "border-foreground bg-muted text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
            <Icon aria-hidden="true" className="size-4" />{label}
            {mode === id && <Check aria-hidden="true" className="size-3" />}
          </span>
        </label>)}
      </div>
    </fieldset>

    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2.5 px-4 text-sm font-medium text-foreground focus-visible:rounded-2xl focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal aria-hidden="true" className="size-4 text-muted-foreground" />
        {tr("appearance.custom.title")}
        <span className="ml-auto text-xs font-normal text-muted-foreground">{tr("appearance.custom.optional")}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground group-open:rotate-180" />
      </summary>
      <div className="space-y-5 border-t border-border px-4 pb-5 pt-4">
        <fieldset>
          <legend className="mb-3 text-xs font-medium text-foreground">{tr("appearance.accent.legend")}</legend>
          <div className="grid grid-cols-7 gap-1 sm:grid-cols-14">
            {ACCENTS.map(accent => <button key={accent.id} type="button" aria-label={accent.label} title={accent.label} aria-pressed={appearance.accent === accent.id} onClick={() => appearance.setAccent(accent.id)} className="flex h-11 min-w-0 cursor-pointer items-center justify-center rounded-lg outline-offset-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
              <span className="flex size-7 items-center justify-center rounded-full ring-1 ring-black/10" style={{ backgroundColor: accent.swatch }}>
                {appearance.accent === accent.id && <Check aria-hidden="true" className="size-4 rounded-full bg-black/65 p-0.5 text-white" />}
              </span>
            </button>)}
          </div>
        </fieldset>
        <div className="border-t border-border pt-4">
          <p className="mb-1 text-xs font-medium text-foreground">{tr("appearance.pageStyle.title")}</p>
          <p className="mb-3 text-xs text-muted-foreground">{tr("appearance.pageStyle.desc")}</p>
          <PageStyleControls value={appearance.pageStyle} onChange={appearance.setPageStyle} />
        </div>
      </div>
    </details>
    <StartScreenSetting />
  </div>;
};
