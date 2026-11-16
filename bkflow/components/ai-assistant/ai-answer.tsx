"use client";

import "./ai-motion.css";

import { ExternalLink } from "lucide-react";
import { createContext, type Dispatch, type ReactNode, type SetStateAction, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type AnswerSource, sourceIndexOf } from "@/lib/ai/assistant/chat-ui";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { AssistantMarkdown, MarkdownLinkContext } from "./assistant-markdown";
import { SourceIcon, sourceAppName } from "./source-icon";

type AnswerContextValue = {
  sources: AnswerSource[];
  /** Nguồn đang được trỏ tới (thẻ, ô "+N" hoặc chip): các phần liên quan cùng sáng lên. */
  lit: string[];
  setLit: Dispatch<SetStateAction<string[]>>;
  animate: boolean;
};

const AnswerContext = createContext<AnswerContextValue | null>(null);
const useAnswerContext = () => useContext(AnswerContext);

// Dưới 480px vừa 2 thẻ nguồn, rộng hơn vừa 3; phần còn lại gộp vào ô "+N".
const SMALL = 2;
const LARGE = 3;
const litClass = "border-violet-400 bg-violet-50 ring-2 ring-violet-400/25 dark:bg-violet-500/15";

const SourcePreview = ({ source, index }: { source: AnswerSource; index: number }) => (
  <div className="space-y-1.5">
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <SourceIcon source={source} />
      <span className="truncate">{sourceAppName(source)}</span>
      <span className="ml-auto tabular-nums">{index + 1}</span>
    </p>
    <p className="text-sm font-medium leading-snug">{source.title}</p>
    {source.subtitle ? <p className="text-xs text-muted-foreground">{source.subtitle}</p> : null}
    {source.href ? (
      <a href={source.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        {tr("assistant.sources.open")}<ExternalLink aria-hidden="true" className="size-3" />
      </a>
    ) : null}
  </div>
);

/** Chip số nguồn trong câu trả lời: rê chuột (hoặc chạm trên màn hình cảm ứng) để xem trước nguồn. */
const CitationChip = ({ index }: { index: number }) => {
  const context = useAnswerContext();
  const [open, setOpen] = useState(false);
  const pointer = useRef("");
  const closeTimer = useRef<number | undefined>(undefined);
  const source = context?.sources[index];
  if (!context || !source) return null;

  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
    context.setLit([source.id]);
  };
  // Chỉ tắt sáng của chính chip này: con trỏ có thể đã sang một thẻ nguồn khác.
  const unlight = () => context.setLit((current) => (current.length === 1 && current[0] === source.id ? [] : current));
  const hide = () => {
    closeTimer.current = window.setTimeout(() => { setOpen(false); unlight(); }, 120);
  };

  return (
    <Popover open={open} onOpenChange={(value) => { setOpen(value); if (!value) unlight(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={tr("assistant.sources.citation", { index: index + 1, title: source.title })}
          onPointerDown={(event) => { pointer.current = event.pointerType; }}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") show(); }}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") hide(); }}
          // Chuột đã mở bằng hover: bấm không đóng lại. Chạm / bàn phím thì bật tắt như thường.
          onClick={(event) => { if (pointer.current === "mouse") event.preventDefault(); pointer.current = ""; }}
          className={cn(
            "ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-muted px-1 align-[1px] text-[10px] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-violet-100 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-ring",
            context.lit.includes(source.id) && "bg-violet-600 text-white hover:bg-violet-600 hover:text-white",
            context.animate && "ai-pop",
          )}
        >
          {index + 1}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-3" onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") show(); }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") hide(); }}>
        <SourcePreview source={source} index={index} />
      </PopoverContent>
    </Popover>
  );
};

const SourceCard = ({ source, index, className }: { source: AnswerSource; index: number; className?: string }) => {
  const context = useAnswerContext()!;
  const on = () => context.setLit([source.id]);
  const off = () => context.setLit([]);
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <SourceIcon source={source} />
        <span className="min-w-0 truncate">{source.subtitle ?? sourceAppName(source)}</span>
        <span className="ml-auto pl-1 tabular-nums">{index + 1}</span>
      </span>
      <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">{source.title}</span>
    </>
  );
  const classes = cn(
    "flex min-w-0 flex-1 basis-0 flex-col gap-1 rounded-xl border bg-card/70 p-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
    context.lit.includes(source.id) && litClass,
    context.animate && "ai-pop",
    className,
  );
  const style = context.animate ? { animationDelay: `${index * 90}ms` } : undefined;
  return source.href ? (
    <a href={source.href} target="_blank" rel="noreferrer" className={classes} style={style} onMouseEnter={on} onMouseLeave={off} onFocus={on} onBlur={off}>{body}</a>
  ) : (
    <div className={classes} style={style} onMouseEnter={on} onMouseLeave={off}>{body}</div>
  );
};

const MoreTile = ({ from, className }: { from: number; className?: string }) => {
  const context = useAnswerContext()!;
  const rest = context.sources.slice(from);
  const ids = rest.map((source) => source.id);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={tr("assistant.sources.moreAria", { count: rest.length })}
          onMouseEnter={() => context.setLit(ids)}
          onMouseLeave={() => context.setLit([])}
          className={cn(
            "flex w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border bg-card/70 text-xs transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
            context.lit.some((id) => ids.includes(id)) && litClass,
            context.animate && "ai-pop",
            className,
          )}
          style={context.animate ? { animationDelay: `${from * 90}ms` } : undefined}
        >
          <span aria-hidden="true" className="flex -space-x-1">
            {rest.slice(0, 3).map((source) => (
              <span key={source.id} className="rounded-full bg-background p-0.5 ring-1 ring-border"><SourceIcon source={source} className="size-3" /></span>
            ))}
          </span>
          <span className="font-semibold tabular-nums">+{rest.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-0 p-1.5">
        {rest.map((source, offset) => {
          const row = (
            <>
              <SourceIcon source={source} />
              <span className="min-w-0 flex-1 truncate">{source.title}</span>
              <span className="tabular-nums text-muted-foreground">{from + offset + 1}</span>
            </>
          );
          const rowClass = "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted";
          return source.href
            ? <a key={source.id} href={source.href} target="_blank" rel="noreferrer" className={rowClass}>{row}</a>
            : <div key={source.id} className={rowClass}>{row}</div>;
        })}
      </PopoverContent>
    </Popover>
  );
};

const SourceRow = ({ reading }: { reading: boolean }) => {
  const { sources } = useAnswerContext()!;
  const count = sources.length;
  return (
    <section aria-label={tr("assistant.sources.count", { count })} className="@container">
      <p className={cn("mb-2 text-xs font-medium text-muted-foreground", reading && "ai-shimmer")}>
        {tr(reading ? "assistant.sources.reading" : "assistant.sources.count", { count })}
      </p>
      <div className="flex gap-2">
        {sources.slice(0, LARGE).map((source, index) => (
          <SourceCard key={source.id} source={source} index={index} className={index >= SMALL ? "hidden @min-[480px]:flex" : undefined} />
        ))}
        {count > SMALL ? <MoreTile from={SMALL} className="@min-[480px]:hidden" /> : null}
        {count > LARGE ? <MoreTile from={LARGE} className="hidden @min-[480px]:flex" /> : null}
      </div>
    </section>
  );
};

/** Khối giữ chiều cao cũ rồi trượt tới chiều cao mới khi nội dung lớn dần. */
const GlideHeight = ({ active, children }: { active: boolean; children: ReactNode }) => {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const element = inner.current;
    if (!active || !element) return;
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);
  return (
    <div className="ai-autoheight overflow-hidden" style={active && height !== undefined ? { height } : undefined}>
      <div ref={inner}>{children}</div>
    </div>
  );
};

/**
 * Câu trả lời AI: hàng thẻ nguồn ("Đang đọc N nguồn" khi đang đọc), văn bản stream với chip trích dẫn.
 * Rê chip làm sáng thẻ nguồn (hoặc ô "+N"), rê thẻ / ô làm sáng các chip của nó.
 */
export const AiAnswer = ({ text, sources, streaming, reading }: {
  text: string;
  sources: AnswerSource[];
  /** Câu trả lời đang stream: chữ hiện dần, có chấm nhấp nháy ở cuối. */
  streaming: boolean;
  /** Còn đang đọc nguồn (chưa viết câu trả lời). */
  reading: boolean;
}) => {
  const [lit, setLit] = useState<string[]>([]);
  const value = useMemo(() => ({ sources, lit, setLit, animate: streaming }), [sources, lit, streaming]);
  // Liên kết tới một nguồn đã đọc: chữ thường + chip số nguồn.
  const renderLink = useCallback((href: string | undefined, children: ReactNode) => {
    const index = sourceIndexOf(sources, href);
    if (index < 0) return null;
    // Dính chip vào từ cuối để chip không rớt xuống dòng một mình.
    const text = typeof children === "string" ? children : null;
    const cut = text ? text.trimEnd().lastIndexOf(" ") + 1 : 0;
    return text
      ? <>{text.slice(0, cut)}<span className="whitespace-nowrap">{text.slice(cut)}<CitationChip index={index} /></span></>
      : <><span>{children}</span><CitationChip index={index} /></>;
  }, [sources]);
  return (
    <AnswerContext.Provider value={value}>
    <MarkdownLinkContext.Provider value={renderLink}>
      <div className="w-full max-w-[640px] space-y-3">
        {sources.length > 0 ? <SourceRow reading={reading} /> : null}
        {text ? (
          <GlideHeight active={streaming}>
            <AssistantMarkdown text={text} streaming={streaming} />
          </GlideHeight>
        ) : null}
      </div>
    </MarkdownLinkContext.Provider>
    </AnswerContext.Provider>
  );
};
