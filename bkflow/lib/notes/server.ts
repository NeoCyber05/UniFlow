import "server-only";

import { db } from "@/lib/db";

export const getPersonalNoteScope = async (userId: string) => {
  return { userId, orgId: userId };
};

export const findOwnedNote = (scope: { userId: string; orgId: string }, id: string) =>
  db.notePage.findFirst({ where: { id, ...scope } });
