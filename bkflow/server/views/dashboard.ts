import { getUserAppearance } from "@/lib/appearance";
import { pickCurrentSemester } from "@/lib/semesters";
import { getOrSeedSemesters } from "@/lib/semesters-db";
import { resolvePersonalOrgId } from "@/lib/workspace";

// Data of app/(platform)/(dashboard)/layout.tsx; also feeds the select-org page's WorkspaceProvider.
export const loadDashboard = async (userId: string | null) => {
  const [appearance, personalOrgId] = await Promise.all([
    getUserAppearance(userId),
    userId ? resolvePersonalOrgId(userId) : null,
  ]);
  const currentSemester = personalOrgId
    ? pickCurrentSemester(await getOrSeedSemesters(personalOrgId))
    : null;

  return { appearance, personalOrgId, currentSemesterId: currentSemester?.id ?? null } as const;
};
