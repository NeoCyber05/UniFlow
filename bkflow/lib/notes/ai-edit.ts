import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { AiOperationSchema } from "@/lib/ai/assistant/policy";
import { db } from "@/lib/db";
import { NoteBlocksDocumentSchema } from "./blocks";
import { canonicalizeConvertedContent } from "./legacy-task-conversion";
import { syncNoteDeadlines } from "./server";

type Client = Prisma.TransactionClient;
type NoteDocument = z.infer<typeof NoteBlocksDocumentSchema>;

// confirmed:true resends the previewed document; it is re-validated against the page like model output.
export const AiPageEditRequest = z.object({
  prompt: z.string().trim().min(1).max(1500),
  expectedUpdatedAt: z.string().datetime(),
  requestId: z.string().uuid(),
  operation: AiOperationSchema.extract(["edit_page", "replace_content"]).default("edit_page"),
  confirmed: z.literal(true).optional(),
  document: NoteBlocksDocumentSchema.optional(),
}).refine(body => !body.confirmed || (body.operation === "replace_content" && body.document), "Thiếu nội dung cần xác nhận.");
export type AiPageEditRequest = z.infer<typeof AiPageEditRequest>;

export class AiEditError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const STALE_PAGE_MESSAGE = "Trang vừa được chỉnh sửa ở nơi khác. Nội dung AI chưa được áp dụng.";

/** Same requestId must carry the same target and payload; the document counts only once it was confirmed. */
export const aiEditFingerprint = (pageId: string, body: AiPageEditRequest) => createHash("sha256").update(JSON.stringify([
  pageId, body.operation, body.prompt, new Date(body.expectedUpdatedAt).toISOString(), body.confirmed ? body.document : null,
])).digest("hex");

type ReplayInput = { userId: string; pageId: string; requestId: string; fingerprint: string };
const changeSelect = { id: true, createdAt: true, undoneAt: true } as const;

const replayOf = async (client: Client, { userId, pageId, requestId, fingerprint }: ReplayInput) => {
  const receipt = await client.aiNoteEdit.findFirst({ where: { userId, requestId }, select: { ...changeSelect, notePageId: true, requestFingerprint: true } });
  if (!receipt) return null;
  if (receipt.notePageId !== pageId || receipt.requestFingerprint !== fingerprint) throw new AiEditError("Mã yêu cầu này đã dùng cho một chỉnh sửa khác. Hãy gửi lại yêu cầu mới.", 409);
  const page = await client.notePage.findFirst({ where: { id: pageId, userId } });
  if (!page) throw new AiEditError("Không tìm thấy trang.", 404);
  return { page, changeId: receipt.id, change: { id: receipt.id, createdAt: receipt.createdAt, undoneAt: receipt.undoneAt }, replayed: true };
};

/** Receipt lookup before calling the model, so a retried request never edits twice. */
export const findAiEditReplay = (input: ReplayInput) => replayOf(db, input);

/** Writes already-validated AI output: CAS on expectedUpdatedAt, Task 3 canonicalization, deadline mirror and receipt in one transaction. */
export const applyAiPageEdit = async (input: ReplayInput & { expectedUpdatedAt: string; operation: AiPageEditRequest["operation"]; document: NoteDocument }) => {
  const { userId, pageId, requestId, fingerprint, document } = input;
  try {
    return await db.$transaction(async tx => {
      const replay = await replayOf(tx, input);
      if (replay) return replay;
      const page = await tx.notePage.findFirst({ where: { id: pageId, userId } });
      if (!page) throw new AiEditError("Không tìm thấy trang.", 404);
      const expected = new Date(input.expectedUpdatedAt);
      if (page.updatedAt.getTime() !== expected.getTime()) throw new AiEditError(STALE_PAGE_MESSAGE, 409);
      const afterContent = await canonicalizeConvertedContent(tx, { pageId, content: JSON.stringify(document) });
      const updated = await tx.notePage.updateMany({ where: { id: pageId, userId, updatedAt: expected }, data: { content: afterContent, updatedAt: new Date(Math.max(Date.now(), expected.getTime() + 1)) } });
      if (!updated.count) throw new AiEditError(STALE_PAGE_MESSAGE, 409);
      await syncNoteDeadlines(tx, { userId, pageId, content: afterContent });
      const nextPage = await tx.notePage.findUniqueOrThrow({ where: { id: pageId } });
      const change = await tx.aiNoteEdit.create({ data: {
        userId, notePageId: pageId, beforeContent: page.content, afterContent, beforeUpdatedAt: page.updatedAt,
        appliedUpdatedAt: nextPage.updatedAt, requestId, requestFingerprint: fingerprint,
      }, select: changeSelect });
      return { page: nextPage, changeId: change.id, change, replayed: false };
    });
  } catch (error) {
    // A concurrent request with the same requestId committed first; unique(userId, requestId) rolled this one back.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await findAiEditReplay(input);
      if (replay) return replay;
    }
    throw error;
  }
};
