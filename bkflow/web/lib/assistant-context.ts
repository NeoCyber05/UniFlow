import type { AssistantContext } from "@/lib/ai/assistant/context";
import type { AiOperation } from "@/lib/ai/assistant/policy";
import { getIntlLocale, tr } from "@/lib/i18n";
import type { CardMessageKey } from "@/lib/i18n/messages/vi-card";

export const snapshotAssistantRequest = <T extends AssistantContext>(context: T, operation: AiOperation) => ({ context: structuredClone(context), operation });
export const assistantContextKey = (context: AssistantContext) => context.kind === "page" ? `page:${context.pageId}` : context.kind === "task" ? `task:${context.cardId}` : context.kind === "calendar" ? `calendar:${context.boardId}:${context.date}:${JSON.stringify(context.filters)}` : `board:${context.boardId}`;

const EDIT_LABEL_KEYS: Record<string, CardMessageKey> = {
  description: "aiAssistant.edit.description",
  title: "aiAssistant.edit.title",
  items: "aiAssistant.edit.items",
  dueDate: "aiAssistant.edit.dueDate",
  deadlineOn: "aiAssistant.edit.deadlineOn",
  scheduledOn: "aiAssistant.edit.scheduledOn",
  scheduledStartAt: "aiAssistant.edit.scheduledStartAt",
  scheduledEndAt: "aiAssistant.edit.scheduledEndAt",
};

export const formatEditValues = (value: unknown): string => {
  if (!value || typeof value !== "object") return tr("aiAssistant.edit.empty");
  return Object.entries(value).filter(([key]) => EDIT_LABEL_KEYS[key]).map(([key, item]) => {
    const text = item == null || item === "" ? tr("aiAssistant.edit.unset") : Array.isArray(item) ? item.join("; ") : typeof item === "string" && /^\d{4}-\d{2}-\d{2}T/.test(item) && Number.isFinite(Date.parse(item)) ? new Date(item).toLocaleString(getIntlLocale(), { timeZone: "Asia/Ho_Chi_Minh" }) : String(item);
    return `${tr(EDIT_LABEL_KEYS[key])}: ${text}`;
  }).join("\n") || tr("aiAssistant.edit.empty");
};

/** A replayed chat proposal uses the same receipt key even after a reload. */
export const proposalRequestId = async (seed: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  const h = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
