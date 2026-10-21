import type { Tool } from "ai";
import { z } from "zod";

import type { AssistantContext } from "./context";
import { type TaskEdit, taskEditBefore, type TaskEditTarget, toTaskEdit } from "./task-edits";
import { requiresContentConfirmation } from "./content-confirmation";

export const AI_OPERATIONS = [
  "answer",
  "edit_page",
  "edit_task_content",
  "add_checklist",
  "set_schedule",
  "set_deadline",
  "batch_update",
  "replace_content",
] as const;

/** Operation do UI gửi lên; giá trị lạ bị từ chối ở ranh giới request. */
export const AiOperationSchema = z.enum(AI_OPERATIONS);
export type AiOperation = z.infer<typeof AiOperationSchema>;
export type ApplyPolicy = "read" | "direct-with-undo" | "preview";

const APPLY_POLICIES = {
  answer: "read",
  edit_page: "direct-with-undo",
  edit_task_content: "direct-with-undo",
  add_checklist: "direct-with-undo",
  set_schedule: "preview",
  set_deadline: "preview",
  batch_update: "preview",
  replace_content: "preview",
} as const satisfies Record<AiOperation, ApplyPolicy>;

export const getApplyPolicy = (operation: AiOperation): ApplyPolicy => APPLY_POLICIES[operation];

/**
 * Cách biểu diễn "xác nhận": đề xuất replace_content mang `confirmation: "explicit"`.
 * UI phải hỏi xác nhận riêng (không chỉ nút "Áp dụng") và endpoint áp dụng phải nhận
 * `confirmed: true`, thiếu thì từ chối. Các operation khác có `confirmation: null`.
 */
export const getConfirmation = (operation: AiOperation): "explicit" | null =>
  operation === "replace_content" ? "explicit" : null;

/** Công cụ chỉ đọc: được chạy trực tiếp ở mọi request. */
export const READ_TOOLS = new Set([
  "getCurrentTime",
  "searchWorkspace",
  "getPage",
  "getMyAgenda",
  "getDeadlines",
  "getBoardProgress",
  "findCards",
  "getCardDetails",
]);

type ToolInput = Record<string, unknown>;
type ToolOptions = Parameters<NonNullable<Tool["execute"]>>[1];

/** Mọi công cụ ghi dữ liệu và operation tương ứng (có thể phụ thuộc input). */
export const MUTATION_TOOL_OPERATIONS: Record<string, (input: ToolInput) => AiOperation> = {
  createDeadlineCard: () => "set_deadline",
  updateCardDeadline: (input) =>
    input.dueDate !== undefined || input.deadlineOn !== undefined
      ? "set_deadline"
      : ["scheduledOn", "scheduledStartAt", "scheduledEndAt"].some((key) => input[key] !== undefined) ? "set_schedule" : "edit_task_content",
  createRecurringSchedule: () => "set_schedule",
  batchCreateCards: () => "batch_update",
  createCardChecklist: () => "add_checklist",
  // Chuyển cột không phải sửa nội dung: xếp vào nhóm preview cho an toàn.
  moveCard: () => "batch_update",
  updateCardDetails: () => "edit_task_content",
  archiveCard: () => "replace_content",
  createCardDependency: () => "batch_update",
  deleteCardDependency: () => "batch_update",
  updateChecklistItem: (input) =>
    (input.change as { type?: unknown } | undefined)?.type === "dueDate" ? "set_deadline" : "edit_task_content",
};

export type AssistantContextRef = { kind: AssistantContext["kind"]; id: string; expectedUpdatedAt?: string };

export const getContextRef = (context: AssistantContext): AssistantContextRef =>
  context.kind === "page"
    ? { kind: "page", id: context.pageId, expectedUpdatedAt: context.expectedUpdatedAt }
    : context.kind === "task"
      ? { kind: "task", id: context.cardId, expectedUpdatedAt: context.expectedUpdatedAt }
      : { kind: context.kind, id: context.boardId };

/** Phần áp dụng được của đề xuất: gửi nguyên văn (kèm requestId) tới POST /api/ai/edits; payload không đổi theo ngữ cảnh. */
export type AiTaskEditPreview = TaskEdit & { cardId: string; expectedUpdatedAt: string; before: ReturnType<typeof taskEditBefore> };

/** Đề xuất thay đổi: KHÔNG ghi dữ liệu; được áp dụng sau qua UI/endpoint áp dụng. */
export type AiProposal = {
  ok: true;
  action: "proposal";
  tool: string;
  operation: AiOperation;
  policy: ApplyPolicy;
  confirmation: "explicit" | null;
  input: ToolInput;
  target: { id: string; title: string } | null;
  context: AssistantContextRef | null;
  /** null: chưa có đường áp dụng (di chuyển, lưu trữ, phụ thuộc, tạo thẻ mới qua bản nháp). */
  edit: AiTaskEditPreview | null;
};

export type AiClarification = { ok: false; needsClarification: true; error: string };

export type ToolPolicyGate = {
  context?: AssistantContext;
  /** Operation do thao tác UI/lệnh xác định; không có nghĩa là hỏi đáp/đề xuất. */
  operation?: AiOperation;
  /** Tải thẻ trong phạm vi đã kiểm quyền của phiên; null nếu không có. */
  loadCard: (cardId: string) => Promise<TaskEditTarget | null>;
  applyEdit?: (edit: TaskEdit, card: TaskEditTarget, expectedUpdatedAt: string, toolCallId: string) => Promise<unknown>;
  /** Người dùng đã bấm "Đồng ý" trên một đề xuất: chạy công cụ ghi thật (chỉ dùng ở endpoint áp dụng đề xuất). */
  approved?: boolean;
};

/**
 * Bọc bộ công cụ: chỉ công cụ đọc chạy thẳng. Công cụ ghi chỉ chạy khi operation có policy
 * direct-with-undo, đúng là lệnh UI gửi lên và nhắm đúng thẻ của ngữ cảnh; còn lại trả đề xuất.
 * Model không thể tự nâng câu hỏi thành lệnh ghi chỉ vì công cụ có trong registry.
 */
export const applyToolPolicy = <T extends Record<string, Tool>>(tools: T, gate: ToolPolicyGate): T =>
  Object.fromEntries(
    Object.entries(tools).map(([name, definition]) => {
      if (READ_TOOLS.has(name)) return [name, definition];
      const classify = MUTATION_TOOL_OPERATIONS[name];
      const execute = definition.execute as ((input: ToolInput, options: ToolOptions) => unknown) | undefined;
      // Công cụ chưa phân loại không được đăng ký: không có đường ghi dữ liệu vòng qua policy.
      if (!classify || !execute) throw new Error(`Công cụ AI "${name}" chưa được phân loại policy.`);

      const gated = async (input: ToolInput, options: ToolOptions): Promise<unknown> => {
        let operation = classify(input);
        const cardId = typeof input.cardId === "string" ? input.cardId : null;
        const target = cardId ? await gate.loadCard(cardId) : null;
        if (cardId && !target) {
          return { ok: false, needsClarification: true, error: "Chưa xác định được thẻ cần áp dụng trên bảng hiện tại. Bạn muốn áp dụng cho thẻ nào?" } satisfies AiClarification;
        }
        if (gate.approved) return execute(input, options);
        const { context, operation: command } = gate;
        const edit = toTaskEdit(name, input);
        if (edit?.operation === "edit_task_content" && target && requiresContentConfirmation(target.description, edit.payload.description)) operation = "replace_content";
        const policy = getApplyPolicy(operation);
        // Direct path only for a supported task edit; execute goes through applyAiTaskEdit (receipt + undo).
        if (edit && target && gate.applyEdit && policy === "direct-with-undo" && command === operation && context?.kind === "task" && context.cardId === cardId) {
          return gate.applyEdit(edit, target, context.expectedUpdatedAt, options.toolCallId);
        }
        return {
          ok: true, action: "proposal", tool: name, operation, policy,
          confirmation: getConfirmation(operation), input,
          target: target && { id: target.id, title: target.title },
          context: context ? getContextRef(context) : null,
          edit: edit && target
            ? { ...edit, cardId: target.id, expectedUpdatedAt: target.updatedAt.toISOString(), before: taskEditBefore(edit.operation, target) }
            : null,
        } satisfies AiProposal;
      };
      return [name, { ...definition, execute: gated }];
    }),
  ) as T;
