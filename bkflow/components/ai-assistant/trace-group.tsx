"use client";

import { AlertTriangle, Check, ChevronDown, Loader2 } from "lucide-react";
import { useId, useState } from "react";

import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { TOOL_LABEL_KEYS } from "./tool-labels";

export type TracePart = { id: string; tool: string; state: string; proposal?: boolean };

const isDone = (state: string) => state === "output-available";
const isFailed = (state: string) => state === "output-error" || state === "output-denied";

export const traceStepLabel = (part: TracePart) => {
  if (part.proposal) return tr("aiAssistant.draftedProposal");
  const keys = TOOL_LABEL_KEYS[part.tool];
  if (!keys) return tr("assistant.trace.stepGeneric");
  return tr(isDone(part.state) || isFailed(part.state) ? keys.done : keys.running);
};

/** Các bước công cụ của một câu trả lời gộp thành một dòng; bấm để mở danh sách bước. */
export const TraceGroup = ({ parts, working }: { parts: TracePart[]; working: boolean }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const running = parts.find((part) => !isDone(part.state) && !isFailed(part.state));
  const failed = parts.filter((part) => isFailed(part.state)).length;
  const active = working && running;

  return (
    <div className="text-xs">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-full items-center gap-2 rounded-md py-0.5 pr-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {active ? (
          <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin text-violet-600" />
        ) : failed ? (
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0 text-amber-600" />
        ) : (
          <span aria-hidden="true" className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="size-2.5" strokeWidth={3} /></span>
        )}
        <span className="truncate font-medium">
          {active ? `${traceStepLabel(running)}…` : tr("assistant.trace.done", { count: parts.length })}
        </span>
        <ChevronDown aria-hidden="true" className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ol id={listId} className="mt-1.5 ml-[6px] space-y-1.5 border-l pl-3.5">
          {parts.map((part) => (
            <li key={part.id} className="flex items-center gap-2 text-muted-foreground">
              {isFailed(part.state) ? (
                <AlertTriangle aria-hidden="true" className="size-3 shrink-0 text-amber-600" />
              ) : isDone(part.state) ? (
                <Check aria-hidden="true" className="size-3 shrink-0 text-emerald-600" />
              ) : (
                <Loader2 aria-hidden="true" className="size-3 shrink-0 animate-spin" />
              )}
              <span className="min-w-0 break-words">{traceStepLabel(part)}{isFailed(part.state) ? ` · ${tr("assistant.trace.stepFailed")}` : ""}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
};
