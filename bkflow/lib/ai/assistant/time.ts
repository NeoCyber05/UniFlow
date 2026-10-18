/**
 * Múi giờ mặc định của hệ thống khi người dùng không chỉ định hoặc múi giờ không hợp lệ.
 * Đặt mặc định theo giờ Việt Nam (UTC+7).
 */
const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * Danh sách tên thứ trong tuần bằng tiếng Việt, chỉ mục tương ứng 0=Chủ Nhật đến 6=Thứ Bảy.
 */
const VI_WEEKDAYS = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

/**
 * Chuẩn hóa và kiểm tra tính hợp lệ của chuỗi định danh múi giờ (IANA Time Zone Identifier).
 *
 * @param timeZone - Chuỗi định danh múi giờ IANA (ví dụ: "Asia/Ho_Chi_Minh", "America/New_York"). Có thể là null hoặc undefined.
 * @returns Tên múi giờ IANA hợp lệ. Trả về `DEFAULT_TIME_ZONE` ("Asia/Ho_Chi_Minh") nếu tham số rỗng hoặc không được hỗ trợ bởi Intl API.
 *
 * @example
 * resolveTimeZone("Asia/Tokyo") // => "Asia/Tokyo"
 * resolveTimeZone("Invalid/Zone") // => "Asia/Ho_Chi_Minh"
 */
export const resolveTimeZone = (timeZone?: string | null): string => {
  if (!timeZone) {
    return DEFAULT_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
};

/**
 * Cấu trúc các thành phần ngày giờ đã được bóc tách theo múi giờ địa phương.
 */
type ZonedParts = {
  /** Năm dương lịch (ví dụ: 2026) */
  year: number;
  /** Tháng trong năm [1..12] */
  month: number;
  /** Ngày trong tháng [1..31] */
  day: number;
  /** Giờ trong ngày định dạng 24h [0..23] */
  hour: number;
  /** Phút trong giờ [0..59] */
  minute: number;
  /** Thứ trong tuần [0..6] (0 = Chủ Nhật, 1 = Thứ Hai, ..., 6 = Thứ Bảy) */
  weekday: number;
};

/**
 * Trích xuất các thành phần ngày, tháng, năm, giờ, phút, thứ của một thời điểm `Date`
 * tương ứng với múi giờ cụ thể bằng cách sử dụng `Intl.DateTimeFormat`.
 *
 * @param date - Đối tượng `Date` đại diện cho mốc thời gian tuyệt đối.
 * @param timeZone - Chuỗi múi giờ IANA hợp lệ (ví dụ: "Asia/Ho_Chi_Minh").
 * @returns Đối tượng {@link ZonedParts} chứa các giá trị số nguyên đã chuyển đổi sang giờ địa phương.
 *
 * @throws {RangeError} Nếu `timeZone` không phải là định danh IANA hợp lệ.
 */
export const getZonedParts = (date: Date, timeZone: string): ZonedParts => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: weekdayIndex,
  };
};

/**
 * Tính toán độ lệch thời gian (Offset) bằng mili-giây giữa múi giờ chỉ định so với UTC
 * tại thời điểm `date` được cung cấp (tự động tính đến Giờ mùa hè - DST nếu có).
 *
 * @param date - Thời điểm xem xét để tính offset.
 * @param timeZone - Chuỗi múi giờ IANA cần tính độ lệch.
 * @returns Số mili-giây chênh lệch so với UTC (Ví dụ UTC+7 trả về `7 * 3600 * 1000 = 25_200_000`).
 */
export const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const truncated = Math.floor(date.getTime() / 60_000) * 60_000;

  return asUtc - truncated;
};

/**
 * Định dạng độ lệch thời gian dạng mili-giây thành chuỗi chuẩn ISO (ví dụ: `"+07:00"`, `"-05:00"`).
 *
 * @param offsetMs - Số mili-giây chênh lệch so với UTC.
 * @returns Chuỗi định dạng `+HH:mm` hoặc `-HH:mm`.
 */
export const formatOffset = (offsetMs: number): string => {
  const totalMinutes = Math.round(offsetMs / 60_000);
  const sign = totalMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(totalMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");

  return `${sign}${hours}:${minutes}`;
};

/**
 * Xác định thời điểm bắt đầu ngày (00:00:00.000) theo múi giờ địa phương chứa `date`,
 * có thể tịnh tiến thêm một số ngày bằng tham số `addDays`.
 *
 * @param date - Thời điểm mốc để xác định ngày.
 * @param timeZone - Chuỗi múi giờ IANA.
 * @param addDays - Số ngày cộng thêm hoặc trừ đi (mặc định là 0).
 * @returns Đối tượng `Date` tại thời điểm 00:00:00 theo giờ địa phương của ngày tương ứng.
 */
export const getZonedDayStart = (date: Date, timeZone: string, addDays = 0): Date => {
  const parts = getZonedParts(date, timeZone);
  const utcMidnight = Date.UTC(parts.year, parts.month - 1, parts.day + addDays);
  const offset = getTimeZoneOffsetMs(new Date(utcMidnight), timeZone);

  return new Date(utcMidnight - offset);
};

/**
 * Xác định thời điểm bắt đầu tuần (Thứ Hai lúc 00:00:00) theo múi giờ địa phương chứa `date`.
 *
 * @remarks
 * Hệ thống sử dụng quy ước tuần học tập bắt đầu từ Thứ Hai (Monday-based week) phù hợp với lịch học sinh viên.
 *
 * @param date - Thời điểm xem xét trong tuần.
 * @param timeZone - Chuỗi múi giờ IANA.
 * @returns Đối tượng `Date` đại diện cho 00:00 Thứ Hai của tuần đó.
 */
export const getZonedWeekStart = (date: Date, timeZone: string): Date => {
  const { weekday } = getZonedParts(date, timeZone);
  const daysSinceMonday = (weekday + 6) % 7;

  return getZonedDayStart(date, timeZone, -daysSinceMonday);
};

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Định dạng một đối tượng `Date` thành chuỗi hiển thị tiếng Việt thân thiện với người dùng
 * kèm theo thứ, ngày/tháng/năm và giờ:phút theo múi giờ địa phương.
 *
 * @param date - Thời điểm cần định dạng (có thể null hoặc undefined).
 * @param timeZone - Chuỗi múi giờ IANA.
 * @returns Chuỗi định dạng ví dụ `"Thứ Sáu, 16/10/2026 23:59"`, hoặc `null` nếu `date` là null/undefined.
 */
export const formatZonedDateTime = (date: Date | null | undefined, timeZone: string): string | null => {
  if (!date) {
    return null;
  }

  const parts = getZonedParts(date, timeZone);

  return `${VI_WEEKDAYS[parts.weekday]}, ${pad(parts.day)}/${pad(parts.month)}/${parts.year} ${pad(parts.hour)}:${pad(parts.minute)}`;
};

/**
 * Định dạng thời điểm thành chuỗi ISO 8601 kèm theo offset múi giờ địa phương.
 *
 * @remarks
 * Định dạng này rất quan trọng để đưa vào prompt cho LLM hoặc truyền giữa API để tránh
 * việc LLM tự giả định múi giờ UTC hoặc nhầm lẫn múi giờ người dùng.
 *
 * @param date - Thời điểm cần định dạng.
 * @param timeZone - Chuỗi múi giờ IANA của người dùng.
 * @returns Chuỗi ISO 8601 đầy đủ (ví dụ: `"2026-10-16T23:59:00+07:00"`).
 */
export const formatIsoWithOffset = (date: Date, timeZone: string): string => {
  const parts = getZonedParts(date, timeZone);
  const offset = formatOffset(getTimeZoneOffsetMs(date, timeZone));

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:00${offset}`;
};

/**
 * Sinh bảng tra cứu lịch tham chiếu cho `days` ngày tiếp theo (mặc định 14 ngày)
 * để inject trực tiếp vào System Prompt của Agent.
 *
 * @remarks
 * Bảng tra cứu này giúp Agent suy luận chính xác các từ ngữ chỉ thời gian tương đối
 * trong tiếng Việt như: "thứ Sáu tuần sau", "hôm nay", "ngày mai", "cuối tuần này"
 * mà không bị nhầm lẫn ngày tháng do chênh lệch múi giờ.
 *
 * @param now - Thời điểm hiện tại làm mốc.
 * @param timeZone - Chuỗi múi giờ IANA của người dùng.
 * @param days - Số ngày cần sinh lịch tham chiếu (mặc định 14 ngày).
 * @returns Chuỗi markdown liệt kê từng ngày kèm nhãn nhận biết (ví dụ: " (hôm nay)").
 */
export const buildCalendarReference = (now: Date, timeZone: string, days = 14): string => {
  const lines: string[] = [];

  for (let index = 0; index < days; index += 1) {
    const dayStart = getZonedDayStart(now, timeZone, index);
    const parts = getZonedParts(new Date(dayStart.getTime() + 12 * 3_600_000), timeZone);
    const label = index === 0 ? " (hôm nay)" : index === 1 ? " (ngày mai)" : "";

    lines.push(
      `- ${VI_WEEKDAYS[parts.weekday]} ${pad(parts.day)}/${pad(parts.month)}/${parts.year} → ${parts.year}-${pad(parts.month)}-${pad(parts.day)}${label}`,
    );
  }

  return lines.join("\n");
};

/**
 * Phân tích cú pháp (parse) một chuỗi ISO 8601 thành đối tượng `Date` an toàn.
 *
 * @param value - Chuỗi ngày tháng ISO cần phân tích.
 * @returns Đối tượng `Date` hợp lệ nếu parse thành công; trả về `null` nếu chuỗi không hợp lệ hoặc sinh `NaN`.
 */
export const parseIsoDateTime = (value: string): Date | null => {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Khởi tạo đối tượng `Date` từ các trường ngày giờ cụ thể tương ứng với múi giờ chỉ định.
 *
 * @param year - Năm (ví dụ: 2026).
 * @param month - Tháng [1..12].
 * @param day - Ngày trong tháng [1..31].
 * @param hour - Giờ trong ngày [0..23].
 * @param minute - Phút trong giờ [0..59].
 * @param timeZone - Chuỗi múi giờ IANA.
 * @returns Đối tượng `Date` tuyệt đối tương ứng với mốc thời gian địa phương đã cho.
 */
export const buildZonedDate = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);

  return new Date(utcGuess - offset);
};

/**
 * Tính toán mốc thời gian chính xác tại một giờ:phút cụ thể trên một ngày tịnh tiến `addDays`
 * tính từ ngày cơ sở `baseDate` theo múi giờ địa phương.
 *
 * @remarks
 * Hàm này phục vụ cho công cụ lập lịch lặp lại (Recurring Tasks) của Agent,
 * ví dụ: tính mốc 05:00 sáng mỗi ngày cho 7 ngày kế tiếp.
 *
 * @param baseDate - Ngày làm mốc tính toán.
 * @param timeZone - Chuỗi múi giờ IANA.
 * @param addDays - Số ngày bù tính từ ngày mốc (0 = hôm nay, 1 = ngày mai...).
 * @param hour - Giờ đích cần đặt [0..23].
 * @param minute - Phút đích cần đặt [0..59].
 * @returns Đối tượng `Date` chính xác tại thời điểm yêu cầu.
 */
export const getZonedTimeOnDay = (
  baseDate: Date,
  timeZone: string,
  addDays: number,
  hour: number,
  minute: number,
): Date => {
  const dayStart = getZonedDayStart(baseDate, timeZone, addDays);
  const parts = getZonedParts(new Date(dayStart.getTime() + 12 * 3_600_000), timeZone);

  return buildZonedDate(parts.year, parts.month, parts.day, hour, minute, timeZone);
};

/**
 * Lấy chỉ mục thứ trong tuần (0=Chủ Nhật, 1=Thứ Hai, ..., 6=Thứ Bảy) theo múi giờ địa phương.
 *
 * @param date - Mốc thời gian xem xét.
 * @param timeZone - Chuỗi múi giờ IANA.
 * @returns Chỉ mục số nguyên từ 0 đến 6.
 */
export const getWeekdayIndex = (date: Date, timeZone: string): number =>
  getZonedParts(date, timeZone).weekday;

/**
 * Lấy tên gọi tiếng Việt của thứ trong tuần (ví dụ: "Thứ Hai", "Chủ Nhật") theo múi giờ địa phương.
 *
 * @param date - Mốc thời gian xem xét.
 * @param timeZone - Chuỗi múi giờ IANA.
 * @returns Chuỗi tên thứ bằng tiếng Việt.
 */
export const getWeekdayName = (date: Date, timeZone: string): string =>
  VI_WEEKDAYS[getWeekdayIndex(date, timeZone)];

