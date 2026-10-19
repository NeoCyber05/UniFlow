import {
  addVNDays,
  formatVNShortDate,
  getEndOfVNDay,
  getVNDay,
  getVNDayKey,
  getVNWeekday,
  type VNDay,
} from "./vn-day";

export type QuickAddCourse = { id: string; name: string; code: string | null };
export type QuickAddMember = { userId: string; userName: string };

export type QuickAddToken = {
  kind: "course" | "assignee" | "important" | "due";
  label: string;
};

export type ParsedQuickAdd = {
  title: string;
  courseId: string | null;
  assigneeUserIds: string[];
  isImportant: boolean;
  /** 23:59 VN của ngày @…; giữ cho caller cũ. Caller mới dùng deadlineOn (hạn chỉ-ngày). */
  dueDate: Date | null;
  /** Ngày hạn YYYY-MM-DD (giờ VN) của token @…, không gắn giờ. */
  deadlineOn: string | null;
  /** Chip xem trước dưới ô nhập */
  tokens: QuickAddToken[];
};

type ParseQuickAddOptions = {
  courses?: QuickAddCourse[];
  members?: QuickAddMember[];
  now?: Date;
};

const WEEKDAY_TOKENS: Record<string, number> = {
  cn: 0,
  t2: 1,
  t3: 2,
  t4: 3,
  t5: 4,
  t6: 5,
  t7: 6,
};

export const toSearchKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const matchCourse = (raw: string, courses: QuickAddCourse[]) => {
  const key = toSearchKey(raw);

  if (!key) return null;

  const byCode = courses.filter((course) => course.code && toSearchKey(course.code) === key);

  if (byCode.length === 1) return byCode[0];

  const byName = courses.filter((course) => toSearchKey(course.name).startsWith(key));

  return byName.length === 1 ? byName[0] : null;
};

const matchMember = (raw: string, members: QuickAddMember[]) => {
  const key = toSearchKey(raw);

  if (!key) return null;

  const matched = members.filter((member) =>
    member.userName.split(/\s+/).some((word) => toSearchKey(word).startsWith(key)),
  );

  return matched.length === 1 ? matched[0] : null;
};

const isValidDayOfMonth = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day)).getUTCDate() === day;

const parseDueToken = (raw: string, now: Date): VNDay | null => {
  const key = raw.toLowerCase();
  const today = getVNDay(now);

  if (key === "nay" || key === "homnay") {
    return today;
  }

  if (key === "mai") {
    return addVNDays(today, 1);
  }

  if (key in WEEKDAY_TOKENS) {
    const diff = (WEEKDAY_TOKENS[key] - getVNWeekday(today) + 7) % 7;

    return addVNDays(today, diff);
  }

  const match = key.match(/^(\d{1,2})\/(\d{1,2})$/);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;

  if (month < 0 || month > 11 || day < 1) return null;

  let year = today.year;

  if (!isValidDayOfMonth(year, month, day)) return null;

  // Ngày đã qua trong năm nay → hiểu là năm sau
  if (Date.UTC(year, month, day) < Date.UTC(today.year, today.month, today.day)) {
    year += 1;

    if (!isValidDayOfMonth(year, month, day)) return null;
  }

  return { year, month, day };
};

const setSingleToken = (tokens: QuickAddToken[], token: QuickAddToken) => {
  const index = tokens.findIndex((item) => item.kind === token.kind);

  if (index === -1) {
    tokens.push(token);
  } else {
    tokens[index] = token;
  }
};

/**
 * Tách token khỏi chuỗi thêm nhanh. Token không nhận dạng được giữ nguyên trong tiêu đề.
 * `#môn` (mã khớp chính xác, hoặc tiền tố tên khớp duy nhất), `+tên` (đầu từ, khớp duy nhất),
 * `!` đứng riêng, `@nay|mai|t2..t7|cn|dd/mm` → hạn 23:59 giờ VN.
 */
export const parseQuickAdd = (
  input: string,
  { courses = [], members = [], now = new Date() }: ParseQuickAddOptions = {},
): ParsedQuickAdd => {
  const titleWords: string[] = [];
  const assigneeUserIds: string[] = [];
  const tokens: QuickAddToken[] = [];
  let courseId: string | null = null;
  let dueDay: VNDay | null = null;
  let isImportant = false;

  for (const word of input.trim().split(/\s+/).filter(Boolean)) {
    if (word === "!") {
      isImportant = true;
      setSingleToken(tokens, { kind: "important", label: "Quan trọng" });
      continue;
    }

    const prefix = word[0];
    const body = word.slice(1);

    if (prefix === "#" && body) {
      const course = matchCourse(body, courses);

      if (course) {
        courseId = course.id;
        setSingleToken(tokens, { kind: "course", label: course.code ?? course.name });
        continue;
      }
    }

    if (prefix === "+" && body) {
      const member = matchMember(body, members);

      if (member) {
        if (!assigneeUserIds.includes(member.userId)) {
          assigneeUserIds.push(member.userId);
          tokens.push({ kind: "assignee", label: member.userName });
        }
        continue;
      }
    }

    if (prefix === "@" && body) {
      const parsed = parseDueToken(body, now);

      if (parsed) {
        dueDay = parsed;
        setSingleToken(tokens, { kind: "due", label: formatVNShortDate(getEndOfVNDay(parsed)) });
        continue;
      }
    }

    titleWords.push(word);
  }

  return {
    title: titleWords.join(" "),
    courseId,
    assigneeUserIds,
    isImportant,
    dueDate: dueDay ? getEndOfVNDay(dueDay) : null,
    deadlineOn: dueDay ? getVNDayKey(dueDay) : null,
    tokens,
  };
};
