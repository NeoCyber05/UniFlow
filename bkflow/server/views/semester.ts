import { currentUser } from "@/server/auth";
import { db } from "@/lib/db";
import { getOrCreateSemesterBoard } from "@/lib/semester-board";

// Data of app/(platform)/(dashboard)/semester/[semesterId]/page.tsx (always redirects to the board list).
export const loadSemester = async (
  { semesterId }: { semesterId: string },
  userId: string | null,
) => {
  const user = await currentUser();

  if (!userId || !user) {
    return { redirect: "/sign-in" } as const;
  }

  const semester = await db.semester.findUnique({ where: { id: semesterId }, select: { userId: true } });

  if (!semester || semester.userId !== userId) {
    return { notFound: true } as const;
  }

  const board = await getOrCreateSemesterBoard({
    userId,
    semesterId,
    user: {
      userId,
      userName: user.fullName || user.primaryEmailAddress?.emailAddress || "Người dùng",
      userImage: user.imageUrl ?? "",
      userEmail: user.primaryEmailAddress?.emailAddress ?? null,
    },
  });

  if (!board) {
    return { notFound: true } as const;
  }

  return { redirect: `/board/${board.id}/list` } as const;
};
