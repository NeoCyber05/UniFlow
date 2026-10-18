import { parseNoteBlocks } from "./blocks";

export type ExtractedDeadline = { blockId: string; title: string; dueAt: Date; reminder: string; done: boolean };

// Deadline blocks without a valid date are drafts and are not tracked.
export const extractNoteDeadlines = (content: string): ExtractedDeadline[] =>
  parseNoteBlocks(content).flatMap(block => {
    if (block.type !== "deadline" || !block.dueAt) return [];
    const dueAt = new Date(block.dueAt);
    if (Number.isNaN(dueAt.getTime())) return [];
    return [{ blockId: block.id, title: block.text.trim() || "Hạn chưa đặt tên", dueAt, reminder: block.reminder || "none", done: block.checked }];
  });
