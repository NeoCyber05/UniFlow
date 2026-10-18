import "server-only";

import { db } from "@/lib/db";

export const getPersonalNoteScope = async (userId: string) => {
  return { userId };
};

export const findOwnedNote = (scope: { userId: string }, id: string) =>
  db.notePage.findFirst({ where: { id, userId: scope.userId } });
