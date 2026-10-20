"use client";

import { Palette } from "lucide-react";
import { tr } from "@/lib/i18n";
import Link from "@/web/shims/next-link";

export const AppearancePopover = () => (
  <Link href="/settings/appearance" aria-label={tr("common.settingsAppearance")} title={tr("common.settingsAppearance")}
    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
    <Palette aria-hidden="true" className="size-4" /><span className="hidden sm:inline">{tr("common.appearance")}</span>
  </Link>
);
