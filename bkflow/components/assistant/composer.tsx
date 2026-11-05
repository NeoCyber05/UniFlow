"use client";

import { ArrowUp, ImagePlus, Square, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";

import { compressImage } from "@/components/capture/image-import-dialog";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ComposerSubmit = { text: string; image: string | null };

/** Ô nhập của trang Trợ lý: tự giãn, Enter gửi, Shift+Enter xuống dòng, dán hoặc đính một ảnh. */
export const Composer = ({
  value,
  onChange,
  onSubmit,
  onStop,
  busy = false,
  disabled = false,
  placeholder,
  footer,
  autoFocus = false,
  size = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (input: ComposerSubmit) => void;
  onStop?: () => void;
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Các nút phụ ở hàng dưới (chọn phạm vi…). */
  footer?: ReactNode;
  autoFocus?: boolean;
  size?: "default" | "large";
}) => {
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attach = (file: Blob) => void compressImage(file).then(setImage).catch(() => toast.error(tr("aiAssistant.imageReadError")));
  const canSend = !disabled && !busy && (value.trim().length > 0 || Boolean(image));
  const send = () => {
    if (!canSend) return;
    onSubmit({ text: value.trim(), image });
    setImage(null);
  };

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); send(); }}
      className="rounded-2xl border bg-background shadow-xs transition focus-within:border-violet-400 focus-within:ring-3 focus-within:ring-violet-400/15"
    >
      {image ? (
        <div className="relative inline-block px-3 pt-3">
          <img src={image} alt={tr("aiAssistant.attachedImageAlt")} className="h-16 rounded-lg border object-cover" />
          <button type="button" onClick={() => setImage(null)} aria-label={tr("aiAssistant.removeImageAria")}
            className="absolute right-1 top-2 rounded-full bg-background p-0.5 text-muted-foreground shadow hover:text-destructive">
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
      <textarea
        data-assistant-composer
        value={value}
        autoFocus={autoFocus}
        rows={1}
        maxLength={2000}
        disabled={disabled}
        aria-label={tr("assistant.composer.label")}
        placeholder={placeholder ?? tr("assistant.composer.placeholder")}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
        onPaste={(event) => {
          const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
          if (!file) return;
          event.preventDefault();
          attach(file);
        }}
        className={cn(
          "block w-full resize-none bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-muted-foreground [field-sizing:content] disabled:cursor-not-allowed",
          size === "large" ? "min-h-[64px] max-h-60" : "min-h-[44px] max-h-48",
        )}
      />
      <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2 pt-1">
        {footer}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy}
          aria-label={tr("aiAssistant.attachImageAria")}
          title={tr("aiAssistant.attachImageTitle")}
          className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <ImagePlus className="size-3.5" />
          <span>{tr("assistant.composer.image")}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
          onChange={(event) => { const file = event.target.files?.[0]; if (file) attach(file); event.target.value = ""; }} />
        <span className="flex-1" />
        {busy && onStop ? (
          <button type="button" onClick={onStop} aria-label={tr("aiAssistant.stopAria")}
            className="flex size-8 items-center justify-center rounded-full bg-foreground text-background">
            <Square className="size-3 fill-current" />
          </button>
        ) : (
          <button type="submit" disabled={!canSend} aria-label={tr("aiAssistant.sendAria")}
            className="flex size-8 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-700 disabled:opacity-40">
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </form>
  );
};
