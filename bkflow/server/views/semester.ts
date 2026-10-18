import { currentUser } from "@/server/auth";
import { db } from "@/lib/db";
import { getOrCreateSemesterBoard } from "@/lib/semester-board";

// Data of app/(platform)/(dashboard)/semester/[semesterId]/page.tsx (always redirects to the board list).
export const loadSemester = async (
  { semesterId }: { semesterId: string },
  userId: string | null,
  orgId: string | null,
) => {
  const user = await currentUser();

  if (!userId || !user) {
    return { redirect: "/sign-in" } as const;
  }

  const semester = await db.semester.findUnique({ where: { id: semesterId }, select: { orgId: true } });

  if (!semester || (semester.orgId !== userId && semester.orgId !== orgId)) {
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
