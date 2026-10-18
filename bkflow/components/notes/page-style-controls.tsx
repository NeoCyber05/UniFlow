"use client";

import { useId } from "react";
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
      {field("fontFamily", "Kiểu chữ", [{ value: "sans", label: "Hiện đại" }, { value: "serif", label: "Sách in" }, { value: "mono", label: "Đơn cách" }])}
      {field("fontSize", "Cỡ chữ", [14, 16, 18, 20, 24].map(size => ({ value: String(size), label: `${size} px` })))}
      {field("lineHeight", "Giãn dòng", [1.4, 1.7, 2, 2.3].map(size => ({ value: String(size), label: `${size} ×` })))}
      {field("width", "Độ rộng", [{ value: "compact", label: "Gọn" }, { value: "normal", label: "Vừa" }, { value: "wide", label: "Rộng" }, { value: "full", label: "Toàn chiều ngang" }])}
      {field("padding", "Khoảng lề", [{ value: "small", label: "Nhỏ" }, { value: "normal", label: "Vừa" }, { value: "large", label: "Thoáng" }])}
      {field("background", "Nền trang", [{ value: "inherit", label: "Giấy trắng" }, ...BACKGROUNDS.map(background => ({ value: background.id, label: background.label }))])}
    </div>
    <p className="text-xs text-muted-foreground">Chọn nền trang sẽ dùng màu/họa tiết khi bỏ màu nền riêng bên dưới.</p>
    <div className="grid grid-cols-2 gap-3">
      {(["paperColor", "textColor"] as const).map(key => <div key={key} className="space-y-1.5">
        <label htmlFor={`${id}-${key}`} className="block text-xs font-medium">{key === "paperColor" ? "Màu nền riêng" : "Màu chữ riêng"}</label>
        <div className="flex items-center gap-1"><input id={`${id}-${key}`} type="color" value={value[key] ?? (key === "paperColor" ? "#ffffff" : "#1f2937")} onChange={event => onChange({ ...value, [key]: event.target.value })} className="h-9 w-12 cursor-pointer rounded border" />
          <Button type="button" variant="ghost" size="sm" disabled={!value[key]} onClick={() => onChange({ ...value, [key]: null })}>Bỏ màu</Button></div>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-1" role="group" aria-label="Phối màu đọc">
      <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, paperColor: "#ffffff", textColor: "#1f2937" })}>Sáng</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, paperColor: "#f5eddc", textColor: "#493c2b", fontFamily: "serif" })}>Giấy ngà</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, paperColor: "#171717", textColor: "#e5e7eb" })}>Tối</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange(DEFAULT_PAGE_STYLE)}>Đặt lại</Button>
    </div>
    <div className="overflow-hidden rounded-lg border" aria-label="Xem trước kiểu trang"><div style={{ ...pageStyleCss(value), maxWidth: "100%", padding: "1rem" }}>Ghi chú của mình<br /><span>Học từng chút, nhớ dài lâu.</span></div></div>
  </div>;
};
