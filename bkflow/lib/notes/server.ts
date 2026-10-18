import "server-only";

import { db } from "@/lib/db";
import { resolvePersonalOrgId } from "@/lib/workspace";

export const getPersonalNoteScope = async (userId: string) => {
  const orgId = await resolvePersonalOrgId(userId);
  return orgId ? { userId, orgId } : null;
};

export const findOwnedNote = (scope: { userId: string; orgId: string }, id: string) =>
  db.notePage.findFirst({ where: { id, ...scope } });
