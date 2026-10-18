// Ngày lịch theo giờ Việt Nam (UTC+7, không DST). Server có thể chạy UTC nên tự tính.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export type VNDay = {
  year: number;
  /** 0-based như Date */
  month: number;
  day: number;
};

export const getVNDay = (date: Date): VNDay => {
  const local = new Date(date.getTime() + VN_OFFSET_MS);

  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
  };
};

export const addVNDays = (value: VNDay, days: number): VNDay => {
  const shifted = new Date(Date.UTC(value.year, value.month, value.day + days));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
};

/** 23:59:59.999 giờ VN của ngày đó, dưới dạng Date (UTC). */
export const getEndOfVNDay = (value: VNDay): Date =>
  new Date(Date.UTC(value.year, value.month, value.day, 23, 59, 59, 999) - VN_OFFSET_MS);

/** 0 = Chủ nhật … 6 = Thứ Bảy */
export const getVNWeekday = (value: VNDay): number =>
  new Date(Date.UTC(value.year, value.month, value.day)).getUTCDay();

export const getVNDayKey = (value: VNDay): string =>
  `${value.year}-${String(value.month + 1).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;

export const isSameVNDay = (a: Date, b: Date): boolean =>
  getVNDayKey(getVNDay(a)) === getVNDayKey(getVNDay(b));

export const formatVNShortDate = (date: Date): string => {
  const value = getVNDay(date);

  return `${value.day}/${value.month + 1}`;
};

/** 00:00:00.000 giờ VN của ngày đó, dưới dạng Date (UTC). */
export const getStartOfVNDay = (value: VNDay): Date =>
  new Date(Date.UTC(value.year, value.month, value.day) - VN_OFFSET_MS);
