"use client";

import { useId } from "react";
import { tr } from "@/lib/i18n";
import { Check, Monitor, Moon, SlidersHorizontal, Sun } from "lucide-react";

import { useAppearance } from "@/components/providers/appearance-provider";
import { useColorMode } from "@/hooks/use-color-mode";
import { cn } from "@/lib/utils";
import { MAX_GLASS_TRANSPARENCY } from "@/web/lib/local-prefs";
import { StartScreenSetting } from "./start-screen-setting";
import { ThemeGallery } from "./theme-gallery";

export const AppearancePanel = () => {
  const appearance = useAppearance();
  const { mode, setMode } = useColorMode();
  const modeName = useId();
  const glassId = useId();

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

    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={glassId} className="flex items-center gap-2.5 text-sm font-medium text-foreground">
          <SlidersHorizontal aria-hidden="true" className="size-4 text-muted-foreground" />
          {tr("appearance.glass.title")}
        </label>
        <output htmlFor={glassId} className="text-sm font-medium tabular-nums text-foreground">{appearance.glassTransparency}%</output>
      </div>
      <p id={`${glassId}-hint`} className="mt-2 text-xs text-muted-foreground">{tr("appearance.glass.desc")}</p>
      <input id={glassId} type="range" min={0} max={MAX_GLASS_TRANSPARENCY} step={1}
        value={appearance.glassTransparency} onChange={event => appearance.setGlassTransparency(event.currentTarget.valueAsNumber)}
        aria-describedby={`${glassId}-hint`}
        className="mt-3 h-6 w-full cursor-pointer accent-primary focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{tr("appearance.glass.solid")}</span><span>{tr("appearance.glass.clear")}</span>
      </div>
    </section>
    <StartScreenSetting />
  </div>;
};
