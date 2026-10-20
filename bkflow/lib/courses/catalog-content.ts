import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { logger } from "@/lib/logger";

/** Đề cương một học phần, nguồn: data/hust-courses.md (chuyển từ PDF chương trình đào tạo). */
export type CourseSyllabus = {
  code: string;
  name: string;
  credits: number | null;
  evaluation: string | null;
  objectives: string | null;
  content: string | null;
};

type Field = "credits" | "evaluation" | "objectives" | "content" | null;

const COURSE_LINE = /^([A-Z]{2,4}\d{4}[A-Z]?)\s+(.+)$/;
// Nhãn đầu dòng → field; nhãn tiếng Anh/khác chỉ để ngắt field đang đọc
const LABELS: [RegExp, Field][] = [
  [/^Khối lượng/i, "credits"],
  [/^Tỷ lệ đánh giá/i, "evaluation"],
  [/^Mục tiêu/i, "objectives"],
  [/^Nội dung/i, "content"],
  [/^(Học phần|Objectives|Contents)/i, null],
];

/** Bỏ **, *, _, #, gạch đầu dòng và phần (tiếng Anh) trong ngoặc. */
const clean = (line: string) =>
  line.replace(/[*_#]/g, "").replace(/^\s*[-•]\s*/, "").replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, "").trim();

const afterColon = (line: string) => line.slice(line.indexOf(":") + 1).trim();

export const parseSyllabusMarkdown = (markdown: string): Map<string, CourseSyllabus> => {
  const courses = new Map<string, CourseSyllabus>();
  let current: CourseSyllabus | null = null;
  let field: Field = null;

  for (const raw of markdown.split(/\r?\n/)) {
    const line = clean(raw);
    if (!line) continue;
    const course = line.match(COURSE_LINE);
    if (course) {
      current = { code: course[1], name: course[2].trim(), credits: null, evaluation: null, objectives: null, content: null };
      courses.set(current.code, current);
      field = null;
      continue;
    }
    if (!current) continue;
    const label = LABELS.find(([pattern]) => pattern.test(line));
    if (label) {
      field = label[1];
      if (!field) continue;
      const value = afterColon(line);
      if (field === "credits") {
        current.credits = Number(value.match(/^(\d+)/)?.[1]) || null;
        field = null;
      } else {
        current[field] = value || null;
      }
      continue;
    }
    if (field === "objectives" || field === "content" || field === "evaluation") {
      current[field] = [current[field], line].filter(Boolean).join(" ");
    }
  }
  return courses;
};

let cache: Map<string, CourseSyllabus> | null = null;

export const getCourseSyllabus = (code: string): CourseSyllabus | null => {
  if (!cache) {
    try {
      // npm start/dev chạy trong bkflow/ nên cwd là gốc app
      cache = parseSyllabusMarkdown(readFileSync(path.join(process.cwd(), "data/hust-courses.md"), "utf8"));
    } catch (error) {
      logger.warn("[COURSE_SYLLABUS_LOAD_ERROR]", { errorMessage: error instanceof Error ? error.message : String(error) });
      cache = new Map();
    }
  }
  return cache.get(code.trim().toUpperCase()) ?? null;
};
