import { catalogCourseId, HUST_COURSES } from "@/lib/courses/hust-catalog";
import { toSearchKey } from "@/lib/my-tasks/parse-quick-add";

const MAX_CANDIDATES = 5;

const wordList = (text: string) =>
  text.split(/[\s,.;:!?/()\-–]+/).map(toSearchKey).filter(Boolean);

/** Cụm hai từ liền nhau ("tieng nhat") + từ đơn. */
const termsOf = (text: string) => {
  const words = wordList(text);
  return { words: new Set(words), pairs: new Set(words.slice(1).map((word, index) => `${words[index]} ${word}`)) };
};

// Bỏ phần tên tiếng Anh trong ngoặc: ít gặp trong câu tiếng Việt, gây trùng nhiễu
const stripEnglish = (name: string) => name.replace(/\s*\([^)]*\)/g, "");

const CATALOG = HUST_COURSES.map((course) => ({ ...course, name: stripEnglish(course.name), terms: termsOf(stripEnglish(course.name)) }));

// Bỏ dấu nên "chợ" = "cho", "tập" khớp cả "bài tập" lẫn "thực tập": từ đơn chỉ tính khi chỉ một môn có
const UNIQUE_WORDS = (() => {
  const counts = new Map<string, number>();
  for (const course of CATALOG) for (const word of course.terms.words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return new Set([...counts].filter(([word, count]) => count === 1 && word.length >= 3).map(([word]) => word));
})();

/**
 * Môn danh mục có từ trùng với rawText (mã hoặc từ trong tên), nhiều từ trùng xếp trước.
 * Chỉ gửi những môn này cho AI thay vì cả danh mục để tiết kiệm token.
 */
export const pickCatalogCandidates = (rawText: string, boardCourses: { code: string | null }[]) => {
  const text = termsOf(rawText);
  const used = new Set(boardCourses.flatMap((course) => (course.code ? [course.code.toUpperCase()] : [])));

  return CATALOG
    .filter((course) => !used.has(course.code.toUpperCase()))
    .map((course) => {
      const score = text.words.has(toSearchKey(course.code))
        ? 100
        : 2 * [...course.terms.pairs].filter((pair) => text.pairs.has(pair)).length +
          [...course.terms.words].filter((word) => UNIQUE_WORDS.has(word) && text.words.has(word)).length;
      return { id: catalogCourseId(course.code), name: course.name, code: course.code, score };
    })
    .filter((course) => course.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map(({ id, name, code }) => ({ id, name, code }));
};
