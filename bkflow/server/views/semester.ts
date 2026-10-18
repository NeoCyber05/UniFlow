import { currentUser } from "@/server/auth";
import { db } from "@/lib/db";
import { getOrCreateSemesterBoard } from "@/lib/semester-board";
import { resolvePersonalOrgId } from "@/lib/workspace";

// Data of app/(platform)/(dashboard)/semester/[semesterId]/page.tsx (always redirects to the board list).
export const loadSemester = async (
  { semesterId }: { semesterId: string },
  userId: string | null,
  orgId: string | null,
) => {
  const user = await currentUser();

  if (!userId || !orgId || !user) {
    return { redirect: "/select-org" } as const;
  }

  // Sidebar link thẳng tới kỳ cá nhân cả khi org đang active là nhóm
  const [semester, personalOrgId] = await Promise.all([
    db.semester.findUnique({ where: { id: semesterId }, select: { orgId: true } }),
    resolvePersonalOrgId(userId),
  ]);

  if (!semester || (semester.orgId !== orgId && semester.orgId !== personalOrgId)) {
    return { notFound: true } as const;
  }

  const board = await getOrCreateSemesterBoard({
    orgId: semester.orgId,
    semesterId,
    user: {
      userId,
      userName:
        user.fullName ||
        user.username ||
        user.primaryEmailAddress?.emailAddress ||
        "Sinh viên",
      userImage: user.imageUrl,
      userEmail: user.primaryEmailAddress?.emailAddress ?? null,
    },
  });

  if (!board) {
    return { notFound: true } as const;
  }

  return { redirect: `/board/${board.id}/list` } as const;
};
