import "./ai-motion.css";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { type MentionApp, splitMentions } from "@/lib/ai/assistant/chat-ui";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Tag một ứng dụng (@Gmail…): logo + tên; có nút bỏ khi đang soạn. */
export const MentionChip = ({ app, onRemove, className }: { app: MentionApp; onRemove?: () => void; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-md bg-background px-1.5 py-0.5 align-middle text-xs font-medium text-foreground ring-1 ring-border", className)}>
    <img src={app.logo} alt="" aria-hidden="true" className="size-3.5 object-contain" />
    <span>{app.name}</span>
    {onRemove ? (
      <button type="button" onClick={onRemove} aria-label={tr("assistant.mention.remove", { app: app.name })}
        className="-mr-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <X className="size-3" />
      </button>
    ) : null}
  </span>
);

/** Văn bản tin người dùng, "@Gmail" hiện thành tag có logo. */
export const MentionText = ({ text }: { text: string }): ReactNode =>
  splitMentions(text).map((part, index) => (typeof part === "string" ? part : <MentionChip key={index} app={part} className="mx-0.5" />));
