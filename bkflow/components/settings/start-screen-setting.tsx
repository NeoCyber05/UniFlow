"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

import { tr } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages/vi";
import { cn } from "@/lib/utils";
import { START_PATHS, getStartPath, setStartPath as saveStartPath, type StartPath } from "@/web/lib/local-prefs";

const START_SCREENS: { path: StartPath; labelKey: MessageKey; descKey: MessageKey }[] = [
  { path: START_PATHS[0], labelKey: "settings.screen.today", descKey: "settings.screen.todayDesc" },
  { path: START_PATHS[1], labelKey: "settings.screen.calendar", descKey: "settings.screen.calendarDesc" },
  { path: START_PATHS[2], labelKey: "settings.screen.upcoming", descKey: "settings.screen.upcomingDesc" },
  { path: START_PATHS[3], labelKey: "settings.screen.notes", descKey: "settings.screen.notesDesc" },
];

/** Trang mở ra sau đăng nhập (đọc ở web/routes/guards.tsx, auth-pages.tsx). */
export const StartScreenSetting = () => {
  const [startPath, setStartPath] = useState(getStartPath);

  const choose = (value: StartPath) => {
    setStartPath(value);
    saveStartPath(value);
    toast.success(tr("settings.toast.defaultScreenSaved"));
  };

  return (
    <section className="space-y-3 border-t border-border pt-5">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Rocket className="size-4 text-primary" aria-hidden="true" />
          {tr("settings.defaultScreen.title")}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{tr("settings.defaultScreen.desc")}</p>
      </div>
      <div role="radiogroup" aria-label={tr("settings.defaultScreen.title")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {START_SCREENS.map((item) => (
          <button
            key={item.path}
            type="button"
            role="radio"
            aria-checked={startPath === item.path}
            onClick={() => choose(item.path)}
            className={cn(
              "cursor-pointer rounded-xl border p-3 text-left transition-all",
              startPath === item.path
                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <p className="text-xs font-semibold">{tr(item.labelKey)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{tr(item.descKey)}</p>
          </button>
        ))}
      </div>
    </section>
  );
};
