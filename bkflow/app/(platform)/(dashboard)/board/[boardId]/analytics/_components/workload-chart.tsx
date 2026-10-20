"use client";

import type { ChartPoint } from "../_types";
import { BarList } from "./bar-list";
import { EmptyState } from "./empty-state";

export const WorkloadChart = ({ data }: { data: ChartPoint[] }) => {
  if (!data.some((item) => item.count > 0)) {
    return <EmptyState label="Chưa có thẻ được giao cho thành viên." />;
  }

  return (
    <BarList
      items={[...data]
        .sort((left, right) => right.count - left.count)
        .map((item, index) => ({
          key: item.id ?? `${item.name}-${index}`,
          name: item.name,
          segments: [{ label: "Lượt giao", value: item.count, className: "bg-gradient-to-r from-teal-400 to-teal-600" }],
        }))}
    />
  );
};
