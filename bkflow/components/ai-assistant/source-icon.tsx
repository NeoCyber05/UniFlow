import { FileText, GraduationCap, LayoutGrid, type LucideIcon, SquareCheckBig } from "lucide-react";

import { type AnswerSource, MENTION_APPS } from "@/lib/ai/assistant/chat-ui";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<string, LucideIcon> = { card: SquareCheckBig, note: FileText, board: LayoutGrid, course: GraduationCap };

export const sourceAppName = (source: AnswerSource) => MENTION_APPS.find((app) => app.slug === source.app)?.name ?? "UniFlow";

/** Logo ứng dụng của nguồn, hoặc icon theo loại mục UniFlow. */
export const SourceIcon = ({ source, className }: { source: AnswerSource; className?: string }) => {
  const app = MENTION_APPS.find((item) => item.slug === source.app);
  if (app) return <img src={app.logo} alt="" aria-hidden="true" className={cn("size-3.5 shrink-0 object-contain", className)} />;
  const Icon = KIND_ICONS[source.kind ?? ""] ?? FileText;
  return <Icon aria-hidden="true" className={cn("size-3.5 shrink-0 text-violet-600", className)} />;
};
