import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  compareHustSemesters,
  getCurrentHustSemesterCode,
  getSemesterDefaultDates,
  parseSemesterCode,
} from "@/lib/semesters";
import type { Semester } from "@prisma/client";

/**
 * Danh sách các học kỳ chuẩn HUST mẫu khởi tạo cho sinh viên
 */
export const DEFAULT_HUST_SEMESTER_CODES = [
  "2024.1",
  "2024.2",
  "2024.6",
  "2025.1",
  "2025.2",
  "2025.6",
  "2026.1",
  "2026.2",
  "2026.6",
  "2027.1",
];

/**
 * Khởi tạo tự động danh sách học kỳ chuẩn Bách Khoa cho một tổ chức / không gian làm việc
 */
export const seedDefaultHustSemesters = async (orgId: string): Promise<Semester[]> => {
  const currentCode = getCurrentHustSemesterCode();

  // Kiểm tra các học kỳ đã tồn tại
  const existing = await db.semester.findMany({
    where: { orgId },
    select: { title: true },
  });
  const existingTitles = new Set(existing.map((s) => s.title));

  const toCreate = DEFAULT_HUST_SEMESTER_CODES.filter((code) => !existingTitles.has(code));

  if (toCreate.length > 0) {
    const hasCurrent = await db.semester.count({
      where: { orgId, isCurrent: true },
    });

    for (const code of toCreate) {
      const parsed = parseSemesterCode(code);
      if (!parsed) continue;

      const dates = getSemesterDefaultDates(parsed.year, parsed.term);
      const isCurrent = hasCurrent === 0 && code === currentCode;

      await db.semester.create({
        data: {
          orgId,
          title: code,
          startDate: dates.startDate,
          endDate: dates.endDate,
          isCurrent,
        },
      });
    }
  }

  const allSemesters = await db.semester.findMany({
    where: { orgId },
  });

  return allSemesters.sort(compareHustSemesters);
};

/**
 * Lấy danh sách học kỳ của org, nếu chưa có thì tự động khởi tạo bộ học kỳ HUST
 */
export const getOrSeedSemesters = cache(async (orgId: string): Promise<Semester[]> => {
  const semesters = await db.semester.findMany({
    where: { orgId },
    orderBy: { startDate: "desc" },
  });

  if (semesters.length === 0) {
    try {
      return await seedDefaultHustSemesters(orgId);
    } catch (error) {
      console.error("[GET_OR_SEED_SEMESTERS]", error);
      return [];
    }
  }

  return semesters.sort(compareHustSemesters);
});
