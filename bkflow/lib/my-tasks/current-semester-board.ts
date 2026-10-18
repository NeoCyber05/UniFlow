import "server-only";

import { currentUser } from "@/server/auth";

import { getOrCreateSemesterBoard } from "@/lib/semester-board";
import { pickCurrentSemester } from "@/lib/semesters";
import { getOrSeedSemesters } from "@/lib/semesters-db";

export const NO_CURRENT_SEMESTER_ERROR = "Chưa có học kỳ hiện tại. Hãy tạo học kỳ trước.";

/** Id bảng của học kỳ hiện tại trong workspace cá nhân; tạo bảng nếu chưa có. */
export const resolveCurrentSemesterBoardId = async (userId: string): Promise<string | null> => {
  if (!userId) return null;

  const semester = pickCurrentSemester(await getOrSeedSemesters(userId));

  if (!semester) return null;

  const user = await currentUser();

  if (!user) return null;

  const board = await getOrCreateSemesterBoard({
    userId,
    semesterId: semester.id,
    user: {
      userId,
      userName: user.fullName || user.primaryEmailAddress?.emailAddress || "Sinh viên",
      userImage: user.imageUrl ?? "",
      userEmail: user.primaryEmailAddress?.emailAddress ?? null,
    },
  });

  return board?.id ?? null;
};
