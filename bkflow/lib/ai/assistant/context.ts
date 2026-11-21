import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { parseNoteBlocks } from "@/lib/notes/blocks";
import { checkBoardOwnership, type BoardOwnershipMembership } from "@/lib/permissions";
import { workspaceBoardScope } from "@/lib/search/workspace-search";

const Id = z.string().min(1).max(100);
const Revision = z.iso.datetime({ offset: true });

/** Ngữ cảnh client gửi kèm câu hỏi. Chỉ là gợi ý: server luôn tải lại và kiểm quyền. */
export const AssistantContextSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("page"), pageId: Id, expectedUpdatedAt: Revision, selectedBlockIds: z.array(Id).max(100).optional() }),
  z.strictObject({ kind: z.literal("task"), cardId: Id, expectedUpdatedAt: Revision, selection: z.strictObject({ text: z.string().trim().min(1).max(8000) }).optional() }),
  z.strictObject({
    kind: z.literal("calendar"), boardId: Id, date: z.iso.date(),
    filters: z.strictObject({ courseId: Id.optional(), includeCompleted: z.boolean().optional() }),
  }),
  z.strictObject({ kind: z.literal("board"), boardId: Id }),
]);
export type AssistantContext = z.infer<typeof AssistantContextSchema>;

export type ResolvedAssistantContext = {
  context: AssistantContext;
  /** Phần tối thiểu đã kiểm quyền đưa vào prompt; là dữ liệu, không phải chỉ dẫn. */
  prompt: Record<string, unknown>;
} & (
  | { boardId: null; page: { content: string; truncated: boolean } }
  | { boardId: string; membership: BoardOwnershipMembership }
);

type Failure = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Failure["status"], error: string): Failure => ({ ok: false, status, error });
const sameRevision = (actual: Date, expected: string) => actual.getTime() === new Date(expected).getTime();
const PROMPT_TEXT_LIMIT = 2_000;
const PAGE_CONTENT_LIMIT = 8_000;

export const resolveAssistantContext = async (
  input: AssistantContext,
  userId: string,
): Promise<{ ok: true; value: Readonly<ResolvedAssistantContext> } | Failure> => {
  // Chụp lại lúc gửi: client đổi Trang/task sau đó không đổi target của request đang chạy.
  const context = Object.freeze(structuredClone(input));

  if (context.kind === "page") {
    const page = await db.notePage.findFirst({
      where: { id: context.pageId, userId, deletedAt: null },
      select: { id: true, title: true, content: true, updatedAt: true },
    });
    if (!page) return fail(404, "Không tìm thấy trang hoặc bạn không có quyền truy cập.");
    if (!sameRevision(page.updatedAt, context.expectedUpdatedAt)) return fail(409, "Trang đã thay đổi. Hãy tải lại trước khi hỏi AI.");
    const selected = context.selectedBlockIds ?? [];
    const blocks = new Map((selected.length ? parseNoteBlocks(page.content) : []).map((block) => [block.id, block]));
    if (selected.some((id) => !blocks.has(id))) return fail(400, "Khối được chọn không thuộc trang này.");
    const selectedText = selected.map((id) => { const block = blocks.get(id)!; return "text" in block ? block.text : ""; }).join("\n");
    return { ok: true, value: Object.freeze({
      context,
      boardId: null,
      prompt: { kind: "page", pageId: page.id, title: page.title, selectedText: selectedText.slice(0, PROMPT_TEXT_LIMIT) },
      page: { content: page.content.slice(0, PAGE_CONTENT_LIMIT), truncated: page.content.length > PAGE_CONTENT_LIMIT },
    }) };
  }

  let boardId: string;
  let prompt: Record<string, unknown>;
  if (context.kind === "task") {
    const card = await db.card.findFirst({
      where: { id: context.cardId, archivedAt: null, list: { archivedAt: null, board: workspaceBoardScope(userId) } },
      select: { id: true, title: true, description: true, updatedAt: true, list: { select: { boardId: true } } },
    });
    if (!card) return fail(404, "Không tìm thấy thẻ hoặc bạn không có quyền truy cập.");
    if (!sameRevision(card.updatedAt, context.expectedUpdatedAt)) return fail(409, "Thẻ đã thay đổi. Hãy tải lại trước khi hỏi AI.");
    if (context.selection && !`${card.title}\n${card.description ?? ""}`.includes(context.selection.text)) {
      return fail(400, "Đoạn được chọn không khớp nội dung thẻ hiện tại.");
    }
    boardId = card.list.boardId;
    prompt = { kind: "task", cardId: card.id, title: card.title, selectedText: context.selection?.text.slice(0, PROMPT_TEXT_LIMIT) ?? null };
  } else {
    boardId = context.boardId;
    prompt = context.kind === "calendar"
      ? { kind: "calendar", boardId, date: context.date, filters: context.filters }
      : { kind: "board", boardId };
  }

  const { error, membership } = await checkBoardOwnership(boardId, userId);
  if (!membership) return fail(403, error ?? "Không có quyền truy cập bảng.");
  if (context.kind === "calendar" && context.filters.courseId) {
    const course = await db.course.findFirst({ where: { id: context.filters.courseId, boardId }, select: { id: true } });
    if (!course) return fail(403, "Bộ lọc danh mục không thuộc bảng này.");
  }
  return { ok: true, value: Object.freeze({ context, boardId, prompt, membership }) };
};
