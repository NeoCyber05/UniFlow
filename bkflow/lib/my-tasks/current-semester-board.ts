import "server-only";

import { currentUser } from "@/server/clerk";

import { getOrCreateSemesterBoard } from "@/lib/semester-board";
import { pickCurrentSemester } from "@/lib/semesters";
import { getOrSeedSemesters } from "@/lib/semesters-db";
import { resolvePersonalOrgId } from "@/lib/workspace";

export const NO_CURRENT_SEMESTER_ERROR = "Chưa có học kỳ hiện tại. Hãy tạo học kỳ trước.";

/** Id bảng của học kỳ hiện tại trong workspace cá nhân; tạo bảng nếu chưa có. */
export const resolveCurrentSemesterBoardId = async (userId: string): Promise<string | null> => {
  const personalOrgId = await resolvePersonalOrgId(userId);

  if (!personalOrgId) return null;

  const semester = pickCurrentSemester(await getOrSeedSemesters(personalOrgId));

  if (!semester) return null;

  const user = await currentUser();

  if (!user) return null;

  const board = await getOrCreateSemesterBoard({
    orgId: personalOrgId,
    semesterId: semester.id,
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

  return board?.id ?? null;
};
