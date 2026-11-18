"use client";

import "./ai-motion.css";

import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Hint } from "@/components/hint";
import type { AnswerSource } from "@/lib/ai/assistant/chat-ui";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { SourceIcon } from "./source-icon";
import { TOOL_LABEL_KEYS } from "./tool-labels";

export type TracePart = { id: string; tool: string; state: string; proposal?: boolean; sources?: AnswerSource[] };

const isDone = (state: string) => state === "output-available";
const isFailed = (state: string) => state === "output-error" || state === "output-denied";
const SOURCES_SHOWN = 3;

export const traceStepLabel = (part: TracePart) => {
  if (part.proposal) return tr("aiAssistant.draftedProposal");
  const keys = TOOL_LABEL_KEYS[part.tool];
  if (!keys) return tr("assistant.trace.stepGeneric");
  return tr(isDone(part.state) || isFailed(part.state) ? keys.done : keys.running);
};

const formatDuration = (ms: number, live: boolean) => {
  const seconds = live ? Math.floor(ms / 1000) : Math.max(1, Math.round(ms / 1000));
  return seconds < 60
    ? tr("assistant.thinking.seconds", { count: seconds })
    : tr("assistant.thinking.minutes", { minutes: Math.floor(seconds / 60), seconds: seconds % 60 });
};

/** Đồng hồ chạy theo giây khi `running`; dừng thì giữ lần đọc cuối. */
const useNow = (running: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
};

const StepSources = ({ sources }: { sources: AnswerSource[] }) => {
  const [all, setAll] = useState(false);
  const shown = all ? sources : sources.slice(0, SOURCES_SHOWN);
  const rest = sources.length - shown.length;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {shown.map((source, index) => {
        const pill = (
          <span className="flex min-w-0 items-center gap-1.5">
            <SourceIcon source={source} className="size-3" />
            <span className="truncate">{source.title}</span>
          </span>
        );
        const className = "ai-pop inline-flex max-w-[15rem] items-center rounded-full border bg-background px-2 py-0.5 text-[11px] text-foreground/80 hover:bg-muted";
        const style = { animationDelay: `${(index % SOURCES_SHOWN) * 80}ms` };
        return (
          <Hint key={source.id} description={source.href ?? source.subtitle ?? source.title} side="top">
            {source.href
              ? <a href={source.href} target="_blank" rel="noreferrer" className={className} style={style}>{pill}</a>
              : <span tabIndex={0} className={className} style={style}>{pill}</span>}
          </Hint>
        );
      })}
      {rest > 0 ? (
        <button type="button" onClick={() => setAll(true)}
          className="ai-pop rounded-full px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10">
          {tr("assistant.thinking.moreSources", { count: rest })}
        </button>
      ) : null}
    </div>
  );
};

/** Dấu tick xanh cuối dòng các bước: bật ra rồi vẽ nét tick. */
const DoneCheck = () => (
  <span aria-hidden="true" className="ai-pop absolute left-0 top-0.5 flex size-3.5 items-center justify-center rounded-full bg-violet-600 text-white">
    <svg viewBox="0 0 12 12" className="ai-check size-2.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6.3 5 8.6l4.5-5" />
    </svg>
  </span>
);

/**
 * Bảng "AI đang làm": tiêu đề là nút thu/mở (đồng hồ chạy khi đang nghĩ, rồi thành "Đã làm trong …"),
 * dòng thời gian các bước hiện lần lượt, nguồn đã đọc dưới từng bước, tick xanh khi xong.
 */
export const ThinkingPanel = ({ steps, active, startedAt, durationMs, className }: {
  steps: TracePart[];
  /** Đang nghĩ / gọi công cụ (chưa bắt đầu viết câu trả lời). */
  active: boolean;
  /** Lúc gửi câu hỏi (đồng hồ chạy từ đây). Chỉ có với câu trả lời đang chạy. */
  startedAt?: number;
  /** Thời gian đã lưu kèm câu trả lời cũ. */
  durationMs?: number;
  className?: string;
}) => {
  const [start] = useState(startedAt);
  const [open, setOpen] = useState(active);
  const now = useNow(active);
  const listId = useId();
  const elapsed = durationMs ?? (start === undefined ? undefined : Math.max(0, now - start));
  const failed = steps.some((step) => isFailed(step.state));
  const running = active ? steps.find((step) => !isDone(step.state) && !isFailed(step.state)) : undefined;

  const label = active
    ? tr("assistant.thinking.live", { time: formatDuration(elapsed ?? 0, true) })
    : elapsed === undefined
      ? tr("assistant.trace.done", { count: steps.length })
      : tr("assistant.thinking.worked", { time: formatDuration(elapsed, false) });

  return (
    <div className={cn("text-xs", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-full items-center gap-2 rounded-md py-0.5 pr-1 text-foreground hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {active ? (
          <span aria-hidden="true" className="ai-node-pulse size-2 shrink-0 rounded-full bg-violet-500" />
        ) : failed ? (
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0 text-amber-600" />
        ) : (
          <span aria-hidden="true" className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white"><Check className="size-2.5" strokeWidth={3} /></span>
        )}
        <span className="truncate font-semibold tabular-nums">{label}</span>
        <ChevronDown aria-hidden="true" className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <ol id={listId} aria-live="polite" aria-relevant="additions" hidden={!open} className="mt-2 pl-0.5">
        {steps.map((step, index) => {
          const isRunning = step === running;
          const hasNext = index < steps.length - 1 || !active;
          return (
            <li key={step.id} className="ai-fade-up relative pb-3 pl-6">
              {hasNext ? <span aria-hidden="true" className="ai-line-grow absolute -bottom-[5px] left-[6.5px] top-[18px] w-px bg-border" /> : null}
              {isFailed(step.state) ? (
                <AlertTriangle aria-hidden="true" className="absolute left-0 top-0.5 size-3.5 text-amber-600" />
              ) : isRunning ? (
                <span aria-hidden="true" className="ai-node-pulse absolute left-[3px] top-[5px] size-2 rounded-full bg-violet-500" />
              ) : (
                <span aria-hidden="true" className="absolute left-[3px] top-[5px] size-2 rounded-full bg-violet-300 dark:bg-violet-400/60" />
              )}
              <span className={cn("block break-words", isRunning ? "font-medium text-foreground" : "text-muted-foreground")}>
                {traceStepLabel(step)}{isFailed(step.state) ? ` · ${tr("assistant.trace.stepFailed")}` : ""}
              </span>
              {step.sources && step.sources.length > 0 ? <StepSources sources={step.sources} /> : null}
            </li>
          );
        })}
        {!active ? (
          <li className="ai-fade-up relative pl-6">
            <DoneCheck />
            <span className="block font-medium text-foreground">{tr("assistant.thinking.done")}</span>
          </li>
        ) : null}
      </ol>
    </div>
  );
};
