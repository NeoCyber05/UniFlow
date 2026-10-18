import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { extractNoteDeadlines } from "@/lib/notes/deadlines";

export const getPersonalNoteScope = async (userId: string) => {
  return { userId };
};

export const findOwnedNote = (scope: { userId: string }, id: string) =>
  db.notePage.findFirst({ where: { id, userId: scope.userId } });

// Call inside the same transaction as every NotePage.content write.
export const syncNoteDeadlines = async (tx: Prisma.TransactionClient, { userId, pageId, content }: { userId: string; pageId: string; content: string }) => {
  await tx.noteDeadline.deleteMany({ where: { pageId } });
  const deadlines = extractNoteDeadlines(content);
  if (deadlines.length) await tx.noteDeadline.createMany({ data: deadlines.map(deadline => ({ ...deadline, userId, pageId })) });
};
