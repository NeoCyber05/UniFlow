/**
 * Tiện ích và quy chuẩn định dạng học kỳ Đại học Bách Khoa Hà Nội (HUST):
 * Định dạng chuẩn: YYYY.1 | YYYY.2 | YYYY.6
 * - YYYY.1: Học kỳ 1 (Kỳ Thu, bắt đầu từ 01/09/YYYY đến 31/01/YYYY+1)
 * - YYYY.2: Học kỳ 2 (Kỳ Xuân, bắt đầu từ 01/02/YYYY+1 đến 30/06/YYYY+1)
 * - YYYY.6: Học kỳ hè / phụ (Kỳ Hè, bắt đầu từ 01/07/YYYY+1 đến 31/08/YYYY+1)
 */

export type SemesterTerm = "1" | "2" | "6";

export const SEMESTER_CODE_REGEX = /^(\d{4})\.(1|2|6)$/;

export type ParsedSemester = {
  year: number;
  term: SemesterTerm;
  fullCode: string;
};

/**
 * Kiểm tra và phân tích cú pháp mã học kỳ (VD: "2025.1", "2025.2", "2025.6")
 */
export const parseSemesterCode = (code: string): ParsedSemester | null => {
  if (!code) return null;
  const match = code.trim().match(SEMESTER_CODE_REGEX);
  if (!match) return null;

  return {
    year: parseInt(match[1], 10),
    term: match[2] as SemesterTerm,
    fullCode: `${match[1]}.${match[2]}`,
  };
};

/**
 * Tính toán ngày bắt đầu và kết thúc chuẩn theo lịch đào tạo Bách Khoa
 */
export const getSemesterDefaultDates = (year: number, term: SemesterTerm) => {
  if (term === "1") {
    return {
      startDate: new Date(year, 8, 1), // 01/09/YYYY
      endDate: new Date(year + 1, 0, 31, 23, 59, 59), // 31/01/YYYY+1
    };
  }

  if (term === "2") {
    return {
      startDate: new Date(year + 1, 1, 1), // 01/02/YYYY+1
      endDate: new Date(year + 1, 5, 30, 23, 59, 59), // 30/06/YYYY+1
    };
  }

  // term === "6" (Kỳ hè)
  return {
    startDate: new Date(year + 1, 6, 1), // 01/07/YYYY+1
    endDate: new Date(year + 1, 7, 31, 23, 59, 59), // 31/08/YYYY+1
  };
};

/**
 * Lấy nhãn mô tả thân thiện cho học kỳ
 * VD: "2025.1" -> "2025.1 • Kỳ 1"
 *     "2025.2" -> "2025.2 • Kỳ 2"
 *     "2025.6" -> "2025.6 • Kỳ hè"
 */
export const formatSemesterLabel = (title: string): string => {
  const parsed = parseSemesterCode(title);
  if (!parsed) return title;

  const { term } = parsed;
  if (term === "1") return `${parsed.fullCode} (Kỳ 1)`;
  if (term === "2") return `${parsed.fullCode} (Kỳ 2)`;
  if (term === "6") return `${parsed.fullCode} (Kỳ hè)`;

  return title;
};

/**
 * Lấy tên gọi ngắn của kỳ: "Kỳ 1", "Kỳ 2", "Kỳ hè"
 */
export const getSemesterTermName = (term: SemesterTerm): string => {
  if (term === "1") return "Kỳ 1";
  if (term === "2") return "Kỳ 2";
  if (term === "6") return "Kỳ hè";
  return "";
};

/**
 * Tự động xác định mã học kỳ HUST đang diễn ra dựa theo thời gian thực
 */
export const getCurrentHustSemesterCode = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (0: Jan, 8: Sep, ...)

  if (month >= 8) {
    // Tháng 9 - 12: Kỳ 1 năm nay (YYYY.1)
    return `${year}.1`;
  }
  if (month === 0) {
    // Tháng 1: Vẫn thuộc Kỳ 1 năm trước ((YYYY-1).1)
    return `${year - 1}.1`;
  }
  if (month >= 1 && month <= 5) {
    // Tháng 2 - 6: Kỳ 2 năm trước ((YYYY-1).2)
    return `${year - 1}.2`;
  }
  // Tháng 7 - 8: Kỳ hè năm trước ((YYYY-1).6)
  return `${year - 1}.6`;
};

/**
 * Danh sách gợi ý các kỳ học Bách Khoa thông dụng quanh năm hiện tại
 */
export const getSuggestedHustSemesters = (referenceDate: Date = new Date()): string[] => {
  const currentCode = getCurrentHustSemesterCode(referenceDate);
  const parsed = parseSemesterCode(currentCode);
  const baseYear = parsed ? parsed.year : referenceDate.getFullYear();

  const semesters: string[] = [];
  // Gợi ý từ năm (baseYear - 2) đến (baseYear + 1)
  for (let y = baseYear - 2; y <= baseYear + 1; y++) {
    semesters.push(`${y}.1`, `${y}.2`, `${y}.6`);
  }

  return semesters;
};

/**
 * Hàm so sánh sắp xếp học kỳ theo thứ tự thời gian (Mới nhất lên đầu)
 */
export const compareHustSemesters = <T extends { title: string; startDate: Date | string }>(
  a: T,
  b: T,
): number => {
  const parsedA = parseSemesterCode(a.title);
  const parsedB = parseSemesterCode(b.title);

  if (parsedA && parsedB) {
    if (parsedA.year !== parsedB.year) {
      return parsedB.year - parsedA.year;
    }
    const termWeight = (t: SemesterTerm) => (t === "6" ? 3 : t === "2" ? 2 : 1);
    return termWeight(parsedB.term) - termWeight(parsedA.term);
  }

  return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
};

/**
 * Học kỳ mặc định để mở: kỳ được đánh dấu hiện tại, nếu không có thì kỳ mới nhất
 */
export const pickCurrentSemester = <T extends { isCurrent: boolean; title: string; startDate: Date | string }>(
  semesters: T[],
): T | null => {
  return semesters.find((semester) => semester.isCurrent)
    ?? [...semesters].sort(compareHustSemesters)[0]
    ?? null;
};
