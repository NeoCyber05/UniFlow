"use client";

import { Loader2 } from "lucide-react";

import type { BoardAssistantUIMessage } from "@/lib/ai/assistant/agent";
import { tr } from "@/lib/i18n";

import { traceStepLabel } from "./trace-group";

/** Bước đang chạy của câu trả lời mới nhất (tool part chưa có kết quả), để dòng chờ nói đang làm gì. */
export const runningStepLabel = (messages: BoardAssistantUIMessage[]) => {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return null;
  for (let index = last.parts.length - 1; index >= 0; index -= 1) {
    const part = last.parts[index];
    if ("toolCallId" in part) {
      if (part.state === "input-streaming" || part.state === "input-available") {
        return traceStepLabel({ id: part.toolCallId, tool: part.type.replace(/^tool-/, ""), state: part.state });
      }
      return null;
    }
  }
  return null;
};

/** Dòng chờ khi trợ lý đang làm: nói bước hiện tại thay cho ba chấm. */
export const ThinkingStatus = ({ label, className }: { label?: string | null; className?: string }) => (
  <div role="status" aria-live="polite" className={className}>
    <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
      <Loader2 aria-hidden="true" className="size-3.5 animate-spin text-violet-600" />
      {label ? `${label}…` : tr("aiAssistant.thinking")}
    </span>
  </div>
);
