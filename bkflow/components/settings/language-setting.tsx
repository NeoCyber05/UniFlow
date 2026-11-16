"use client";

import { Check, Languages } from "lucide-react";
import { toast } from "sonner";

import { LOCALES, tr, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Chọn ngôn ngữ giao diện (nằm trong tab Giao diện của Cài đặt). */
export const LanguageSetting = () => {
  const { locale, setLocale } = useLocale();
  return (
    <section className="space-y-3 border-t border-border pt-5">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Languages className="size-4 text-primary" aria-hidden="true" />
          {tr("settings.language.title")}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{tr("settings.language.description")}</p>
      </div>
      <div role="radiogroup" aria-label={tr("settings.language.title")} className="grid grid-cols-2 gap-2">
        {LOCALES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={locale === item.id}
            onClick={() => {
              setLocale(item.id);
              toast.success(tr("settings.language.saved"));
            }}
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm font-medium transition-all",
              locale === item.id
                ? "border-primary bg-primary/10 font-semibold text-primary ring-1 ring-primary"
                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {item.label}
            {locale === item.id && <Check className="size-4" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </section>
  );
};
