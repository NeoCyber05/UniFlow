"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import {
  DEFAULT_GRID_COLS,
  clampGridRowHeight,
  getGridStyle,
  parseGridSize,
  resizeGridColumns,
  type CalendarGridSize,
} from "@/lib/calendar/calendar-grid-size";

import type { ViewMode } from "../_types";

const storageKey = (mode: ViewMode) => `calendar-grid-size:${mode}`;

const readGridSize = (mode: ViewMode) => {
  try {
    return parseGridSize(localStorage.getItem(storageKey(mode)));
  } catch {
    return parseGridSize(null);
  }
};

const writeGridSize = (mode: ViewMode, size: CalendarGridSize) => {
  try {
    localStorage.setItem(storageKey(mode), JSON.stringify(size));
  } catch {
    // Không lưu được (private mode...) thì chỉ giữ trong phiên.
  }
};

/** Co giãn độ rộng từng cột ngày và chiều cao từng hàng tuần; lưu theo chế độ xem trong trình duyệt. */
export const useCalendarGridSize = (viewMode: ViewMode) => {
  const [loadedMode, setLoadedMode] = useState(viewMode);
  const [size, setSize] = useState(() => readGridSize(viewMode));
  const sizeRef = useRef(size);

  if (loadedMode !== viewMode) {
    setLoadedMode(viewMode);
    setSize(readGridSize(viewMode));
  }

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const update = (next: CalendarGridSize, persist: boolean) => {
    sizeRef.current = next;
    setSize(next);
    if (persist) writeGridSize(viewMode, next);
  };

  const trackPointer = (
    event: PointerEvent<HTMLElement>,
    onMove: (moveEvent: globalThis.PointerEvent) => void,
  ) => {
    const handle = event.currentTarget;
    const pointerId = event.pointerId;

    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(pointerId);

    const stop = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      writeGridSize(viewMode, sizeRef.current);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  const startColumnResize = (event: PointerEvent<HTMLElement>, boundary: number) => {
    const width = event.currentTarget.parentElement?.getBoundingClientRect().width;

    if (!width || event.button !== 0) return;

    const startX = event.clientX;
    const startCols = sizeRef.current.cols;
    const total = startCols.reduce((sum, weight) => sum + weight, 0);

    trackPointer(event, (moveEvent) => {
      const deltaWeight = ((moveEvent.clientX - startX) / width) * total;
      update({ ...sizeRef.current, cols: resizeGridColumns(startCols, boundary, deltaWeight) }, false);
    });
  };

  const startRowResize = (event: PointerEvent<HTMLElement>, weekIndex: number) => {
    const height = event.currentTarget.parentElement?.getBoundingClientRect().height;

    if (!height || event.button !== 0) return;

    const startY = event.clientY;

    trackPointer(event, (moveEvent) => {
      update({
        ...sizeRef.current,
        rows: { ...sizeRef.current.rows, [weekIndex]: clampGridRowHeight(height + moveEvent.clientY - startY) },
      }, false);
    });
  };

  const handleColumnKeyDown = (event: KeyboardEvent<HTMLElement>, boundary: number) => {
    const step = event.key === "ArrowLeft" ? -0.1 : event.key === "ArrowRight" ? 0.1 : 0;

    if (!step) return;
    event.preventDefault();
    update({ ...sizeRef.current, cols: resizeGridColumns(sizeRef.current.cols, boundary, step) }, true);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLElement>, weekIndex: number) => {
    const step = event.key === "ArrowUp" ? -20 : event.key === "ArrowDown" ? 20 : 0;
    const height = event.currentTarget.parentElement?.getBoundingClientRect().height;

    if (!step || !height) return;
    event.preventDefault();
    update({
      ...sizeRef.current,
      rows: { ...sizeRef.current.rows, [weekIndex]: clampGridRowHeight((sizeRef.current.rows[weekIndex] ?? height) + step) },
    }, true);
  };

  const resetColumns = () => update({ ...sizeRef.current, cols: DEFAULT_GRID_COLS }, true);

  const resetRow = (weekIndex: number) => {
    const rows = { ...sizeRef.current.rows };
    delete rows[weekIndex];
    update({ ...sizeRef.current, rows }, true);
  };

  return {
    gridStyle: getGridStyle(size.cols),
    rowHeights: size.rows,
    startColumnResize,
    startRowResize,
    handleColumnKeyDown,
    handleRowKeyDown,
    resetColumns,
    resetRow,
  };
};

export type CalendarGridSizeControls = ReturnType<typeof useCalendarGridSize>;
