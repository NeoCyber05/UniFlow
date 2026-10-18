import { db } from "@/lib/db";
import { readPageStyle } from "@/lib/notes/page-style";
import {
  type Appearance,
  DEFAULT_ACCENT,
  DEFAULT_APPEARANCE,
  DEFAULT_BACKGROUND,
  isAccentId,
  isBackgroundId,
} from "@/constants/appearance";

export const getUserAppearance = async (userId: string | null): Promise<Appearance> => {
  if (!userId) {
    return DEFAULT_APPEARANCE;
  }

  try {
    const preference = await db.userPreference.findUnique({
      where: { userId },
      select: { accent: true, background: true, pageStyle: true },
    });

    return {
      accent: isAccentId(preference?.accent) ? preference.accent : DEFAULT_ACCENT,
      background: isBackgroundId(preference?.background) ? preference.background : DEFAULT_BACKGROUND,
      pageStyle: readPageStyle(preference?.pageStyle),
    };
  } catch (error) {
    // Appearance is cosmetic — never block the dashboard on it
    console.error("[GET_USER_APPEARANCE]", error);
    return DEFAULT_APPEARANCE;
  }
};
