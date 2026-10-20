import type { CSSProperties } from "react";

export type CalendarGridSize = {
  /** Tỉ lệ độ rộng 7 cột ngày (mặc định 1 mỗi cột). */
  cols: number[];
  /** Chiều cao tối thiểu (px) theo chỉ số hàng tuần. */
  rows: Record<number, number>;
};

export const DEFAULT_GRID_COLS = [1, 1, 1, 1, 1, 1, 1];
export const MIN_GRID_COL_WEIGHT = 0.4;
export const MIN_GRID_ROW_HEIGHT = 80;
export const MAX_GRID_ROW_HEIGHT = 900;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Kéo ranh giới giữa cột boundary-1 và boundary; tổng độ rộng hai cột giữ nguyên. */
export const resizeGridColumns = (cols: number[], boundary: number, deltaWeight: number) => {
  const pair = cols[boundary - 1] + cols[boundary];
  const left = clamp(cols[boundary - 1] + deltaWeight, MIN_GRID_COL_WEIGHT, pair - MIN_GRID_COL_WEIGHT);
  const next = [...cols];

  next[boundary - 1] = left;
  next[boundary] = pair - left;
  return next;
};

export const clampGridRowHeight = (height: number) => clamp(Math.round(height), MIN_GRID_ROW_HEIGHT, MAX_GRID_ROW_HEIGHT);

/** Dữ liệu localStorage là đầu vào không tin cậy: sai dạng thì về mặc định. */
export const parseGridSize = (raw: string | null): CalendarGridSize => {
  try {
    const parsed = JSON.parse(raw ?? "null") as Partial<CalendarGridSize> | null;
    const cols = Array.isArray(parsed?.cols) &&
      parsed.cols.length === 7 &&
      parsed.cols.every((weight) => typeof weight === "number" && weight >= MIN_GRID_COL_WEIGHT && weight <= 7)
      ? parsed.cols
      : DEFAULT_GRID_COLS;
    const rows: Record<number, number> = {};

    for (const [key, value] of Object.entries(parsed?.rows ?? {})) {
      if (typeof value === "number" && Number.isFinite(value)) rows[Number(key)] = clampGridRowHeight(value);
    }

    return { cols, rows };
  } catch {
    return { cols: DEFAULT_GRID_COLS, rows: {} };
  }
};

/** CSS vars cho lưới: --cal-cols (grid-template-columns) và --cal-x0..7 (mép trái tích luỹ, %). */
export const getGridStyle = (cols: number[]) => {
  const total = cols.reduce((sum, weight) => sum + weight, 0);
  const style: Record<string, string> = {
    "--cal-cols": cols.map((weight) => `minmax(0,${weight}fr)`).join(" "),
  };
  let edge = 0;

  for (let index = 0; index <= 7; index += 1) {
    style[`--cal-x${index}`] = `${(edge / total) * 100}%`;
    edge += cols[index] ?? 0;
  }

  return style as CSSProperties;
};

/** Vị trí ngang cho dải từ cột start tới end (gồm cả end); fallback = 7 cột đều. */
export const getGridColumnSpanStyle = (start: number, end: number): CSSProperties => {
  const left = `var(--cal-x${start}, ${(start / 7) * 100}%)`;
  const right = `var(--cal-x${end + 1}, ${((end + 1) / 7) * 100}%)`;

  return { left, width: `calc(${right} - ${left})` };
};
