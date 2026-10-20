"use client";

import { useId } from "react";
import { tr } from "@/lib/i18n";
import { BACKGROUNDS } from "@/constants/appearance";
import { DEFAULT_PAGE_STYLE, PageStyleSchema, pageStyleCss, type PageStyle } from "@/lib/notes/page-style";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const PageStyleControls = ({ value, onChange }: { value: PageStyle; onChange: (value: PageStyle) => void }) => {
  const id = useId();
  const field = (key: keyof PageStyle, label: string, options: { value: string; label: string }[]) => <div className="space-y-1.5" key={key}>
    <label id={`${id}-${key}`} className="text-xs font-medium">{label}</label>
    <Select value={String(value[key])} onValueChange={next => {
      const parsed = PageStyleSchema.safeParse({ ...value, ...(key === "background" ? { paperColor: null } : {}), [key]: key === "fontSize" || key === "lineHeight" ? Number(next) : next });
      if (parsed.success) onChange(parsed.data);
    }}><SelectTrigger aria-labelledby={`${id}-${key}`} className="w-full"><SelectValue /></SelectTrigger><SelectContent>
      {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
    </SelectContent></Select>
  </div>;
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      {field("fontFamily", tr("notes.style.fontFamily"), [{ value: "sans", label: tr("notes.style.sans") }, { value: "serif", label: tr("notes.style.serif") }, { value: "mono", label: tr("notes.style.mono") }])}
      {field("fontSize", tr("notes.style.fontSize"), [14, 16, 18, 20, 24].map(size => ({ value: String(size), label: `${size} px` })))}
      {field("lineHeight", tr("notes.style.lineHeight"), [1.4, 1.7, 2, 2.3].map(size => ({ value: String(size), label: `${size} ×` })))}
      {field("width", tr("notes.style.width"), [{ value: "compact", label: tr("notes.style.narrow") }, { value: "normal", label: tr("common.medium") }, { value: "wide", label: tr("notes.style.wide") }, { value: "full", label: tr("notes.style.full") }])}
      {field("padding", tr("notes.style.padding"), [{ value: "small", label: tr("notes.style.small") }, { value: "normal", label: tr("common.medium") }, { value: "large", label: tr("notes.style.large") }])}
      {field("background", tr("notes.style.background"), [{ value: "inherit", label: tr("notes.style.paperWhite") }, ...BACKGROUNDS.map(background => ({ value: background.id, label: background.label }))])}
    </div>
    <p className="text-xs text-muted-foreground">{tr("notes.style.backgroundHint")}</p>
    <div className="grid grid-cols-2 gap-3">
      {(["paperColor", "textColor"] as const).map(key => <div key={key} className="space-y-1.5">
        <label htmlFor={`${id}-${key}`} className="block text-xs font-medium">{key === "paperColor" ? tr("notes.style.paperColor") : tr("notes.style.textColor")}</label>
        <div className="flex items-center gap-1"><input id={`${id}-${key}`} type="color" value={value[key] ?? (key === "paperColor" ? "#ffffff" : "#1f2937")} onChange={event => onChange({ ...value, [key]: event.target.value })} className="h-9 w-12 cursor-pointer rounded border" />
          <Button type="button" variant="ghost" size="sm" disabled={!value[key]} onClick={() => onChange({ ...value, [key]: null })}>{tr("notes.style.clearColor")}</Button></div>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-1" role="group" aria-label={tr("notes.style.readingPalette")}>
      <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, paperColor: "#ffffff", textColor: "#1f2937" })}>{tr("common.light")}</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, paperColor: "#f5eddc", textColor: "#493c2b", fontFamily: "serif" })}>{tr("notes.style.ivory")}</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, paperColor: "#171717", textColor: "#e5e7eb" })}>{tr("common.dark")}</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange(DEFAULT_PAGE_STYLE)}>{tr("common.reset")}</Button>
    </div>
    <div className="overflow-hidden rounded-lg border" aria-label={tr("notes.style.previewLabel")}><div style={{ ...pageStyleCss(value), maxWidth: "100%", padding: "1rem" }}>{tr("notes.style.previewText")}</div></div>
  </div>;
};
