import { z } from "zod";

const textBlock = z.object({ id: z.string().min(1).max(80), text: z.string().max(10_000) });

export const NoteBlockSchema = z.discriminatedUnion("type", [
  textBlock.extend({ type: z.literal("paragraph") }),
  textBlock.extend({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  textBlock.extend({ type: z.literal("todo"), checked: z.boolean() }),
  textBlock.extend({ type: z.literal("callout") }),
  textBlock.extend({ type: z.literal("bullet") }),
  textBlock.extend({ type: z.literal("numbered") }),
  textBlock.extend({ type: z.literal("quote") }),
  z.object({ id: z.string().min(1).max(80), type: z.literal("divider") }),
  z.object({ id: z.string().min(1).max(80), type: z.literal("task"), taskId: z.string().max(80) }),
  // dueAt is an ISO datetime or "" while unset; reminder is a reminderLabels key or "none".
  textBlock.extend({ type: z.literal("deadline"), dueAt: z.string().max(40), reminder: z.string().max(10), checked: z.boolean() }),
]);

export const NoteBlocksDocumentSchema = z.object({ version: z.literal(1), blocks: z.array(NoteBlockSchema).min(1).max(100) }).superRefine((document, context) => {
  if (JSON.stringify(document).length > 100_000) context.addIssue({ code: "custom", message: "Trang quá dài." });
  if (new Set(document.blocks.map(block => block.id)).size !== document.blocks.length) context.addIssue({ code: "custom", message: "Mỗi khối cần một mã riêng." });
});
export type NoteBlock = z.infer<typeof NoteBlockSchema>;

const fallback = (text: string): NoteBlock[] => [{ id: "fallback", type: "paragraph", text }];

export const parseNoteBlocks = (content: string): NoteBlock[] => {
  if (!content) return [{ id: "empty", type: "paragraph", text: "" }];
  try {
    const parsed: unknown = JSON.parse(content);
    const document = NoteBlocksDocumentSchema.safeParse(parsed);
    return document.success ? document.data.blocks : fallback(content);
  } catch {
    return fallback(content);
  }
};

export const serializeNoteBlocks = (blocks: readonly NoteBlock[]): string => {
  const document = NoteBlocksDocumentSchema.parse({ version: 1, blocks });
  const content = JSON.stringify(document);
  if (content.length > 100_000) throw new Error("Trang quá dài.");
  return content;
};

// Save route accepts only a valid version-1 document; legacy text is converted by the client on explicit edit.
export const isStructuredNoteContent = (content: string) => {
  try { return NoteBlocksDocumentSchema.safeParse(JSON.parse(content)).success; } catch { return false; }
};

// A JSON object/array we cannot read (newer version, unknown block) is preserved untouched; plain legacy text is not.
export const isUnsupportedNoteDocument = (content: string) => {
  try {
    const parsed: unknown = JSON.parse(content);
    return typeof parsed === "object" && parsed !== null && !NoteBlocksDocumentSchema.safeParse(parsed).success;
  } catch {
    return false;
  }
};

export const haveSameNoteContent = (left: readonly NoteBlock[], right: readonly NoteBlock[]) => {
  const content = (blocks: readonly NoteBlock[]) => JSON.stringify(blocks, (key, value: unknown) => key === "id" ? undefined : value);
  return content(left) === content(right);
};

const isProtectedBlock = (block: NoteBlock) => block.type === "task" || block.type === "deadline";
const blockKey = (block?: NoteBlock) => block ? JSON.stringify(block, Object.keys(block).sort()) : "";

export type AiBlockEditCheck = { ok: false; error: string } | { ok: true; noop: boolean; large: boolean };

/**
 * Invariants on validated AI output, enforced after the model and independent of the prompt:
 * task/deadline blocks come back with the same id and payload; AI never adds or retargets one.
 * "large" (needs replace_content + explicit confirmation): removes a task/deadline block, or on a page
 * with at least 4 blocks removes/rewrites more than half of its other blocks.
 */
export const checkAiBlockEdit = (before: readonly NoteBlock[], after: readonly NoteBlock[]): AiBlockEditCheck => {
  const beforeById = new Map(before.map(block => [block.id, block]));
  for (const block of after) {
    if (isProtectedBlock(block) && blockKey(beforeById.get(block.id)) !== blockKey(block)) {
      return { ok: false, error: block.type === "task" ? "AI không được thêm hoặc đổi liên kết công việc. Trang chưa thay đổi." : "AI không được thêm hoặc đổi hạn. Trang chưa thay đổi." };
    }
  }
  if (haveSameNoteContent(before, after)) return { ok: true, noop: true, large: false };
  const afterById = new Map(after.map(block => [block.id, block]));
  const others = before.filter(block => !isProtectedBlock(block));
  const touched = others.filter(block => blockKey(afterById.get(block.id)) !== blockKey(block)).length;
  const large = before.some(block => isProtectedBlock(block) && !afterById.has(block.id)) || (before.length >= 4 && touched * 2 > others.length);
  return { ok: true, noop: false, large };
};
