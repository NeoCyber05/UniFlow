"use client";

import type { CalendarGridSizeControls } from "../../_hooks/use-calendar-grid-size";

const BOUNDARIES = [1, 2, 3, 4, 5, 6];

type ColumnResizeHandlesProps = {
  grid: CalendarGridSizeControls;
};

/** Thanh kéo giữa các cột ngày (desktop). Kéo để co giãn, double-click để chia đều. */
export const ColumnResizeHandles = ({ grid }: ColumnResizeHandlesProps) => (
  <>
    {BOUNDARIES.map((boundary) => (
      <span
        key={boundary}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Co giãn cột ngày ${boundary} và ${boundary + 1}`}
        title="Kéo để co giãn cột, nhấp đúp để chia đều"
        tabIndex={0}
        onPointerDown={(event) => grid.startColumnResize(event, boundary)}
        onKeyDown={(event) => grid.handleColumnKeyDown(event, boundary)}
        onDoubleClick={grid.resetColumns}
        style={{ left: `var(--cal-x${boundary})` }}
        className="absolute inset-y-0 z-[5] hidden w-2 -translate-x-1/2 cursor-col-resize touch-none rounded-full transition-colors hover:bg-violet-300/60 focus-visible:bg-violet-400/60 focus-visible:outline-none md:block"
      />
    ))}
  </>
);

type RowResizeHandleProps = {
  grid: CalendarGridSizeControls;
  weekIndex: number;
};

/** Thanh kéo ở đáy hàng tuần (desktop). Kéo để đổi chiều cao, double-click để về mặc định. */
export const RowResizeHandle = ({ grid, weekIndex }: RowResizeHandleProps) => (
  <span
    role="separator"
    aria-orientation="horizontal"
    aria-label={`Co giãn chiều cao tuần ${weekIndex + 1}`}
    title="Kéo để đổi chiều cao, nhấp đúp để về mặc định"
    tabIndex={0}
    onPointerDown={(event) => grid.startRowResize(event, weekIndex)}
    onKeyDown={(event) => grid.handleRowKeyDown(event, weekIndex)}
    onDoubleClick={() => grid.resetRow(weekIndex)}
    className="absolute inset-x-0 -bottom-1 z-[15] hidden h-2 cursor-row-resize touch-none rounded-full transition-colors hover:bg-violet-300/60 focus-visible:bg-violet-400/60 focus-visible:outline-none md:block"
  />
);
