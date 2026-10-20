"use client";

import type { ChartPoint } from "../_types";
import { BarList } from "./bar-list";
import { EmptyState } from "./empty-state";

export const ListDistributionChart = ({
  data,
  hasCards,
}: {
  data: ChartPoint[];
  hasCards: boolean;
}) => {
  if (!data.some((item) => item.count > 0)) {
    return (
      <EmptyState label={hasCards ? "Chưa có danh sách nào có thẻ." : "Bảng chưa có thẻ."} />
    );
  }

  return (
    <BarList
      items={data.map((item, index) => ({
        key: item.id ?? `${item.name}-${index}`,
        name: item.name,
        segments: [{ label: "Số thẻ", value: item.count, className: "bg-gradient-to-r from-violet-400 to-violet-600" }],
      }))}
    />
  );
};
