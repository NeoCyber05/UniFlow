import type { CSSProperties } from "react";
import { z } from "zod";
import { BACKGROUND_IDS, BACKGROUNDS } from "../../constants/appearance";

const color = z.string().regex(/^#[0-9a-f]{6}$/i).nullable();
export const PageStyleSchema = z.object({
  fontFamily: z.enum(["sans", "serif", "mono"]).default("sans"),
  fontSize: z.union([z.literal(14), z.literal(16), z.literal(18), z.literal(20), z.literal(24)]).default(16),
  lineHeight: z.union([z.literal(1.4), z.literal(1.7), z.literal(2), z.literal(2.3)]).default(1.7),
  width: z.enum(["compact", "normal", "wide", "full"]).default("normal"),
  padding: z.enum(["small", "normal", "large"]).default("normal"),
  background: z.enum(["inherit", ...BACKGROUND_IDS]).default("inherit"),
  paperColor: color.default(null),
  textColor: color.default(null),
});
export type PageStyle = z.infer<typeof PageStyleSchema>;
export const DEFAULT_PAGE_STYLE = PageStyleSchema.parse({});
export const readPageStyle = (value: unknown): PageStyle => {
  const result = PageStyleSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_PAGE_STYLE;
};
// A page without its own paper follows the app theme (light or dark).
export const hasCustomPaper = (style: PageStyle) => style.background !== "inherit" || Boolean(style.paperColor);

export const pageStyleCss = (style: PageStyle): CSSProperties => ({
  ...BACKGROUNDS.find(background => background.id === style.background)?.style,
  ...(style.paperColor ? { backgroundColor: style.paperColor, backgroundImage: "none" } : {}),
  color: style.textColor ?? (hasCustomPaper(style) ? "#1f2937" : undefined),
  fontFamily: { sans: "var(--font-sans), sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "ui-monospace, Consolas, monospace" }[style.fontFamily],
  fontSize: `${style.fontSize}px`, lineHeight: style.lineHeight,
  maxWidth: { compact: "640px", normal: "800px", wide: "1000px", full: "100%" }[style.width],
  padding: { small: "clamp(1rem, 3vw, 1.5rem)", normal: "clamp(1rem, 4vw, 3rem)", large: "clamp(1rem, 6vw, 5rem)" }[style.padding],
});
