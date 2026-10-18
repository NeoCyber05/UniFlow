export const COURSE_COLOR_KEYS = [
  "violet",
  "sky",
  "emerald",
  "amber",
  "rose",
  "indigo",
  "teal",
  "orange",
  "fuchsia",
  "lime",
] as const;

export type CourseColorKey = (typeof COURSE_COLOR_KEYS)[number];

export type CourseColorStyle = {
  /** Chấm tròn nhỏ */
  dot: string;
  /** Viền trái card kanban */
  stripe: string;
  /** Tag/chip nền sáng */
  chip: string;
  /** Thanh timeline ở trạng thái thường */
  timelineTone: string;
  /** Ô lịch ở trạng thái thường */
  calendarTone: string;
  /** Màu cho chart */
  hex: string;
};

export const COURSE_COLORS: Record<CourseColorKey, CourseColorStyle> = {
  violet: {
    dot: "bg-violet-500",
    stripe: "border-l-violet-500",
    chip: "bg-violet-50 text-violet-700 ring-violet-200",
    timelineTone: "border-violet-300 bg-violet-100 text-violet-900",
    calendarTone: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
    hex: "#8b5cf6",
  },
  sky: {
    dot: "bg-sky-500",
    stripe: "border-l-sky-500",
    chip: "bg-sky-50 text-sky-700 ring-sky-200",
    timelineTone: "border-sky-300 bg-sky-100 text-sky-900",
    calendarTone: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
    hex: "#0ea5e9",
  },
  emerald: {
    dot: "bg-emerald-500",
    stripe: "border-l-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    timelineTone: "border-emerald-300 bg-emerald-100 text-emerald-900",
    calendarTone: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    hex: "#10b981",
  },
  amber: {
    dot: "bg-amber-500",
    stripe: "border-l-amber-500",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    timelineTone: "border-amber-300 bg-amber-100 text-amber-900",
    calendarTone: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    hex: "#f59e0b",
  },
  rose: {
    dot: "bg-rose-500",
    stripe: "border-l-rose-500",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    timelineTone: "border-rose-300 bg-rose-100 text-rose-900",
    calendarTone: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
    hex: "#f43f5e",
  },
  indigo: {
    dot: "bg-indigo-500",
    stripe: "border-l-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    timelineTone: "border-indigo-300 bg-indigo-100 text-indigo-900",
    calendarTone: "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100",
    hex: "#6366f1",
  },
  teal: {
    dot: "bg-teal-500",
    stripe: "border-l-teal-500",
    chip: "bg-teal-50 text-teal-700 ring-teal-200",
    timelineTone: "border-teal-300 bg-teal-100 text-teal-900",
    calendarTone: "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100",
    hex: "#14b8a6",
  },
  orange: {
    dot: "bg-orange-500",
    stripe: "border-l-orange-500",
    chip: "bg-orange-50 text-orange-700 ring-orange-200",
    timelineTone: "border-orange-300 bg-orange-100 text-orange-900",
    calendarTone: "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100",
    hex: "#f97316",
  },
  fuchsia: {
    dot: "bg-fuchsia-500",
    stripe: "border-l-fuchsia-500",
    chip: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
    timelineTone: "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900",
    calendarTone: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100",
    hex: "#d946ef",
  },
  lime: {
    dot: "bg-lime-500",
    stripe: "border-l-lime-500",
    chip: "bg-lime-50 text-lime-700 ring-lime-200",
    timelineTone: "border-lime-300 bg-lime-100 text-lime-900",
    calendarTone: "border-lime-200 bg-lime-50 text-lime-800 hover:bg-lime-100",
    hex: "#84cc16",
  },
};

export const isCourseColorKey = (value: string): value is CourseColorKey =>
  (COURSE_COLOR_KEYS as readonly string[]).includes(value);

export const getCourseColor = (key: string | null | undefined) =>
  COURSE_COLORS[key && isCourseColorKey(key) ? key : "violet"];

/** Màu đầu tiên chưa dùng; hết thì quay vòng. */
export const pickNextCourseColor = (usedColors: string[]): CourseColorKey =>
  COURSE_COLOR_KEYS.find((key) => !usedColors.includes(key)) ??
  COURSE_COLOR_KEYS[usedColors.length % COURSE_COLOR_KEYS.length];

/** Nhãn ngắn hiển thị trên chip/tag: mã HP nếu có, không thì tên. */
export const getCourseShortLabel = (course: { name: string; code: string | null }) =>
  course.code || course.name;
