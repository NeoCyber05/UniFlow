/** Nhãn hiển thị của task (Label/CardLabel), dùng chung list, board card và detail. */
export type TaskLabel = { id: string; title: string; color: string };

export const DEFAULT_LABEL_COLOR = "#94a3b8";

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Chỉ cho phép hex; mọi giá trị khác về màu mặc định (không đưa chuỗi lạ vào style). */
export const safeLabelColor = (color: string): string =>
  HEX_COLOR.test(color) ? color : DEFAULT_LABEL_COLOR;

/** Màu chữ đọc được trên nền nhãn. */
export const getLabelTextColor = (color: string): "#171717" | "#ffffff" => {
  let hex = safeLabelColor(color).slice(1);
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#171717" : "#ffffff";
};

/** Bỏ ID trùng (giữ thứ tự), không gộp theo title. */
export const partitionTaskLabels = (labels: TaskLabel[], limit: number) => {
  const seen = new Set<string>();
  const unique = labels.filter((label) => !seen.has(label.id) && seen.add(label.id));
  const n = Math.max(0, limit);
  return { visible: unique.slice(0, n), hidden: unique.slice(n) };
};
