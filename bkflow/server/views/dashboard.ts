import { getUserAppearance } from "@/lib/appearance";
import { pickCurrentSemester } from "@/lib/semesters";
import { getOrSeedSemesters } from "@/lib/semesters-db";

export const loadDashboard = async (userId: string | null) => {
  const [appearance, currentSemester] = await Promise.all([
    getUserAppearance(userId),
    userId ? getOrSeedSemesters(userId).then(pickCurrentSemester) : null,
  ]);

  return { appearance, currentSemesterId: currentSemester?.id ?? null } as const;
};
