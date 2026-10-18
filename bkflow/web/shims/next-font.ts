// next/font has no SPA equivalent: fonts come from @fontsource (web/main.tsx) and globals.css.
// Returns empty class/style so call sites keep working; per-page fonts (e.g. marketing heading font) fall back to inherited.
const font = () => ({ className: "", style: {}, variable: "" });

export const Inter = font;
export const Geist_Mono = font;
export default font;
