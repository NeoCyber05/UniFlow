"use client";

import { ArrowUp, AtSign, ImagePlus, Square, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { MentionChip } from "@/components/ai-assistant/mention-chip";
import { compressImage } from "@/components/capture/image-import-dialog";
import { useConnectedApps } from "@/hooks/use-connected-apps";
import { findMentionApp, matchMentionApps, type MentionApp } from "@/lib/ai/assistant/chat-ui";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ComposerSubmit = { text: string; image: string | null };

// "@gm" ngay trước con trỏ (đầu dòng hoặc sau khoảng trắng) mở menu gắn thẻ ứng dụng.
const MENTION_QUERY = /(^|\s)@([A-Za-z]*)$/;
// "@gmail " gõ đủ tên rồi dấu cách: đổi luôn thành tag.
const MENTION_TYPED = /(^|\s)@([A-Za-z]+)\s$/;

/**
 * Ô nhập của trang Trợ lý: tự giãn, Enter gửi, Shift+Enter xuống dòng, dán hoặc đính một ảnh.
 * Gõ "@" để gắn thẻ ứng dụng (@Gmail…): tag hiện logo trong ô nhập và được gửi kèm thành "@Gmail".
 */
export const Composer = ({
  value,
  onChange,
  onSubmit,
  onStop,
  busy = false,
  disabled = false,
  placeholder,
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
  autoFocus?: boolean;
  size?: "default" | "large";
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [apps, setApps] = useState<MentionApp[]>([]);
  // below: mở menu xuống dưới khi phía dưới ô nhập còn nhiều chỗ hơn (màn chào), ngược lại mở lên trên.
  const [menu, setMenu] = useState<{ query: string; start: number; below: boolean } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const listId = useId();
  const connected = useConnectedApps().data?.apps;
  const options = menu ? matchMentionApps(menu.query).filter((app) => !apps.some((tagged) => tagged.slug === app.slug)) : [];
  const menuOpen = options.length > 0;
  const attach = (file: Blob) => void compressImage(file).then(setImage).catch(() => toast.error(tr("aiAssistant.imageReadError")));
  const canSend = !disabled && !busy && (value.trim().length > 0 || Boolean(image));
  const send = () => {
    if (!canSend) return;
    const tags = apps.map((app) => `@${app.handle}`).join(" ");
    onSubmit({ text: [tags, value.trim()].filter(Boolean).join(" "), image });
    setImage(null);
    setApps([]);
    setMenu(null);
  };

  const placeCaret = (position: number) => requestAnimationFrame(() => {
    textRef.current?.focus();
    textRef.current?.setSelectionRange(position, position);
  });
  const roomBelow = () => {
    const rect = formRef.current?.getBoundingClientRect();
    return rect ? window.innerHeight - rect.bottom > rect.top : false;
  };
  const addApp = (app: MentionApp) => setApps((current) => (current.some((item) => item.slug === app.slug) ? current : [...current, app]));
  const pick = (app: MentionApp) => {
    if (!menu) return;
    const caret = textRef.current?.selectionStart ?? value.length;
    onChange(value.slice(0, menu.start) + value.slice(caret).replace(/^ +/, ""));
    addApp(app);
    setMenu(null);
    placeCaret(menu.start);
  };
  const handleChange = (text: string, caret: number) => {
    const typed = MENTION_TYPED.exec(text.slice(0, caret));
    const app = typed ? findMentionApp(typed[2]) : undefined;
    if (typed && app) {
      const start = caret - typed[2].length - 2;
      onChange(text.slice(0, start) + text.slice(caret));
      addApp(app);
      setMenu(null);
      placeCaret(start);
      return;
    }
    onChange(text);
    const match = MENTION_QUERY.exec(text.slice(0, caret));
    setMenu(match ? { query: match[2], start: caret - match[2].length - 1, below: menu?.below ?? roomBelow() } : null);
    setHighlight(0);
  };
  const openMenu = () => {
    const caret = textRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const insert = before && !/\s$/.test(before) ? " @" : "@";
    onChange(before + insert + value.slice(caret));
    setMenu({ query: "", start: caret + insert.length - 1, below: roomBelow() });
    setHighlight(0);
    placeCaret(caret + insert.length);
  };

  return (
    <form
      ref={formRef}
      onSubmit={(event) => { event.preventDefault(); send(); }}
      className="glass-surface relative rounded-2xl border shadow-xs transition focus-within:border-violet-400 focus-within:ring-3 focus-within:ring-violet-400/15"
    >
      {menuOpen ? (
        <div className={cn("absolute left-2 z-30 w-64 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg", menu?.below ? "top-full mt-2" : "bottom-full mb-2")}>
          <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">{tr("assistant.mention.list")}</p>
          <ul id={listId} role="listbox" aria-label={tr("assistant.mention.list")} className="max-h-[min(15rem,35vh)] overflow-y-auto">
            {options.map((app, index) => (
              <li key={app.slug} id={`${listId}-${index}`} role="option" aria-selected={index === highlight}
                // Giữ focus ở ô nhập khi bấm chọn.
                onMouseDown={(event) => { event.preventDefault(); pick(app); }}
                onMouseEnter={() => setHighlight(index)}
                className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm", index === highlight && "bg-muted")}>
                <img src={app.logo} alt="" aria-hidden="true" className="size-4 object-contain" />
                <span className="min-w-0 flex-1 truncate">{app.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {connected && connected[app.slug] === false ? tr("assistant.mention.notConnected") : `@${app.handle}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {image ? (
        <div className="relative inline-block px-3 pt-3">
          <img src={image} alt={tr("aiAssistant.attachedImageAlt")} className="h-16 rounded-lg border object-cover" />
          <button type="button" onClick={() => setImage(null)} aria-label={tr("aiAssistant.removeImageAria")}
            className="absolute right-1 top-2 rounded-full bg-background p-0.5 text-muted-foreground shadow hover:text-destructive">
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start gap-1.5 px-4 pt-3">
        {apps.map((app) => (
          <MentionChip key={app.slug} app={app} className="ai-pop"
            onRemove={() => { setApps((current) => current.filter((item) => item.slug !== app.slug)); textRef.current?.focus(); }} />
        ))}
        <textarea
          ref={textRef}
          data-assistant-composer
          value={value}
          autoFocus={autoFocus}
          rows={1}
          maxLength={2000}
          disabled={disabled}
          role="combobox"
          aria-label={tr("assistant.composer.label")}
          aria-autocomplete="list"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? listId : undefined}
          aria-activedescendant={menuOpen ? `${listId}-${highlight}` : undefined}
          placeholder={apps.length > 0 ? undefined : placeholder ?? tr("assistant.composer.placeholder")}
          onChange={(event) => handleChange(event.target.value, event.target.selectionStart)}
          onBlur={() => setMenu(null)}
          onKeyDown={(event) => {
            if (menuOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              const next = (highlight + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length;
              setHighlight(next);
              document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" });
              return;
            }
            if (menuOpen && (event.key === "Enter" || event.key === "Tab") && !event.nativeEvent.isComposing) {
              event.preventDefault();
              pick(options[highlight] ?? options[0]);
              return;
            }
            if (menu && event.key === "Escape") {
              event.preventDefault();
              setMenu(null);
              return;
            }
            const target = event.currentTarget;
            if (event.key === "Backspace" && apps.length > 0 && target.selectionStart === 0 && target.selectionEnd === 0) {
              setApps((current) => current.slice(0, -1));
              return;
            }
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
            "block min-w-[10rem] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground [field-sizing:content] disabled:cursor-not-allowed",
            size === "large" ? "min-h-[52px] max-h-60" : "min-h-[32px] max-h-48",
          )}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2 pt-1">
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
        <button
          type="button"
          onClick={openMenu}
          disabled={disabled || busy}
          aria-label={tr("assistant.mention.aria")}
          className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <AtSign className="size-3.5" />
          <span>{tr("assistant.mention.button")}</span>
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
