"use client";

import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { Hint } from "@/components/hint";
import { tr } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages/vi";
import { cn } from "@/lib/utils";

const REASONS: { id: string; key: MessageKey }[] = [
  { id: "wrong_info", key: "assistant.feedback.wrongInfo" },
  { id: "not_what_asked", key: "assistant.feedback.notWhatAsked" },
  { id: "unclear", key: "assistant.feedback.unclear" },
];

const iconButton = "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none";

const sendFeedback = (messageId: string, rating: "up" | "down", reason?: string) =>
  fetch("/api/ai/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, rating, reason }),
  }).catch(() => undefined);

/** Thanh nhỏ dưới câu trả lời: Chép, Hỏi lại, Hữu ích, Chưa đúng (kèm lý do). */
export const MessageActions = ({ messageId, text, onRetry }: { messageId: string; text: string; onRetry?: () => void }) => {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-0.5" role="toolbar" aria-label={tr("assistant.actions.label")}>
        {text ? (
          <Hint description={copied ? tr("assistant.actions.copied") : tr("assistant.actions.copy")} side="bottom">
            <button type="button" className={iconButton} aria-label={tr("assistant.actions.copy")} onClick={() => void copy()}>
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            </button>
          </Hint>
        ) : null}
        {onRetry ? (
          <Hint description={tr("assistant.actions.retry")} side="bottom">
            <button type="button" className={iconButton} aria-label={tr("assistant.actions.retry")} onClick={onRetry}>
              <RotateCcw className="size-3.5" />
            </button>
          </Hint>
        ) : null}
        <Hint description={tr("assistant.actions.helpful")} side="bottom">
          <button type="button" className={cn(iconButton, rating === "up" && "text-foreground")} aria-pressed={rating === "up"} aria-label={tr("assistant.actions.helpful")} disabled={rating !== null}
            onClick={() => { setRating("up"); void sendFeedback(messageId, "up"); }}>
            <ThumbsUp className={cn("size-3.5", rating === "up" && "fill-current")} />
          </button>
        </Hint>
        <Hint description={tr("assistant.actions.notHelpful")} side="bottom">
          <button type="button" className={cn(iconButton, rating === "down" && "text-foreground")} aria-pressed={rating === "down"} aria-label={tr("assistant.actions.notHelpful")} disabled={rating !== null}
            onClick={() => { setRating("down"); setAsking(true); }}>
            <ThumbsDown className={cn("size-3.5", rating === "down" && "fill-current")} />
          </button>
        </Hint>
        {sent ? <span role="status" className="ml-1 text-xs text-muted-foreground">{tr("assistant.feedback.thanks")}</span> : null}
      </div>
      {asking && !sent ? (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={tr("assistant.feedback.label")}>
          {REASONS.map((reason) => (
            <button key={reason.id} type="button"
              className="rounded-full border px-2.5 py-1 text-xs text-foreground/80 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => { setSent(true); setAsking(false); void sendFeedback(messageId, "down", reason.id); }}>
              {tr(reason.key)}
            </button>
          ))}
          <button type="button" className="px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setSent(true); setAsking(false); void sendFeedback(messageId, "down"); }}>
            {tr("assistant.feedback.skip")}
          </button>
        </div>
      ) : null}
    </div>
  );
};
