import { readPageStyle } from "@/lib/notes/page-style";
import { findOwnedNote, getPersonalNoteScope } from "@/lib/notes/server";

// Data of app/(platform)/(dashboard)/pages/[pageId]/page.tsx.
// Linked task blocks load separately from GET /api/pages/:pageId/tasks so they are re-checked on every visit.
export const loadPage = async ({ pageId }: { pageId: string }, userId: string | null) => {
  if (!userId) return { redirect: "/select-org" } as const;
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return { notFound: true } as const;
  const page = await findOwnedNote(scope, pageId);
  if (!page) return { notFound: true } as const;
  return { initialPage: { ...page, style: page.style ? readPageStyle(page.style) : null, updatedAt: page.updatedAt.toISOString() } } as const;
};
