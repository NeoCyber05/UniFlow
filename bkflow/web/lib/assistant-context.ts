import type { AssistantContext } from "@/lib/ai/assistant/context";
import type { AiOperation } from "@/lib/ai/assistant/policy";

export const snapshotAssistantRequest = <T extends AssistantContext>(context: T, operation: AiOperation) => ({ context: structuredClone(context), operation });
export const assistantContextKey = (context: AssistantContext) => context.kind === "page" ? `page:${context.pageId}` : context.kind === "task" ? `task:${context.cardId}` : context.kind === "calendar" ? `calendar:${context.boardId}:${context.date}:${JSON.stringify(context.filters)}` : `board:${context.boardId}`;

const EDIT_LABELS: Record<string, string> = { description: "Nội dung", title: "Tên", items: "Các bước", dueDate: "Hạn nộp", deadlineOn: "Hạn nộp", scheduledOn: "Ngày làm", scheduledStartAt: "Bắt đầu", scheduledEndAt: "Kết thúc" };
export const formatEditValues = (value: unknown): string => {
  if (!value || typeof value !== "object") return "Chưa có";
  return Object.entries(value).filter(([key]) => EDIT_LABELS[key]).map(([key, item]) => {
    const text = item == null || item === "" ? "Chưa đặt" : Array.isArray(item) ? item.join("; ") : typeof item === "string" && /^\d{4}-\d{2}-\d{2}T/.test(item) && Number.isFinite(Date.parse(item)) ? new Date(item).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : String(item);
    return `${EDIT_LABELS[key]}: ${text}`;
  }).join("\n") || "Chưa có";
};

/** A replayed chat proposal uses the same receipt key even after a reload. */
export const proposalRequestId = async (seed: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  const h = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
