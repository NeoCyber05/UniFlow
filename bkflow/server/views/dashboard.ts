import { getUserAppearance } from "@/lib/appearance";

export const loadDashboard = async (userId: string | null) => {
  const appearance = await getUserAppearance(userId);

  return { appearance } as const;
};
