import type { QuickAddCourse } from "@/lib/my-tasks/parse-quick-add";

type CaptureTextPart = { text: string; kind?: "course" | "due" };

const relativeDay = /(?:hôm\s+nay|ngày\s+mai|(?:sáng|chiều|tối|đêm)\s+(?:nay|mai)|mai|mốt|thứ\s+[2-7]|chủ\s+nhật)/.source;
const clock = /(?:[01]?\d|2[0-3])(?:h(?:[0-5]\d)?|:[0-5]\d|\s+giờ(?:\s+[0-5]?\d(?:\s+phút)?)?)(?:\s+(?:sáng|trưa|chiều|tối|đêm)(?:\s+(?:nay|mai))?)?/.source;
const dateTag = /@(?:nay|mai|cn|t[2-7]|\d{1,2}\/\d{1,2})/.source;
const word = /[\p{L}\p{M}\p{N}_]/u.source;
const escapeRegex = (value: string) => value.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g, "\\$&");

// shortcut: highlights common Vietnamese time phrases, use analyzer spans if it starts returning source offsets.
export const splitCaptureKeywords = (text: string, courses: QuickAddCourse[] = []): CaptureTextPart[] => {
  const names = new Set(["DSA", ...courses.flatMap(({ code, name }) => [code, name])]);
  const course = [...names].filter((name): name is string => Boolean(name && name.trim().length >= 2))
    .map((name) => name.trim()).sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
  const deadline = [clock + "(?:\\s+" + relativeDay + ")?", relativeDay, dateTag].join("|");
  const keywords = new RegExp(`(?<!${word}|@)(?:(?<due>${deadline})|#?(?:${course}))(?!${word})`, "giu");
  const parts: CaptureTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(keywords)) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) });
    parts.push({ text: match[0], kind: match.groups?.due ? "due" : "course" });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
};
