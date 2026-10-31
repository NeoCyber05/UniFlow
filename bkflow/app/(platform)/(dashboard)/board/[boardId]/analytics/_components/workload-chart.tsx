"use client";

import { tr } from "@/lib/i18n";

import type { ChartPoint } from "../_types";
import { BarList } from "./bar-list";
import { EmptyState } from "./empty-state";

export const WorkloadChart = ({ data }: { data: ChartPoint[] }) => {
  if (!data.some((item) => item.count > 0)) {
    return <EmptyState label={tr("analytics.memberWorkload.empty")} />;
  }

  const segmentLabel = tr("analytics.memberWorkload.segmentLabel");

  return (
    <BarList
      items={[...data]
        .sort((left, right) => right.count - left.count)
        .map((item, index) => ({
          key: item.id ?? `${item.name}-${index}`,
          name: item.id === "personal" && item.name === "Cá nhân" ? tr("analytics.personal") : item.name,
          segments: [{ label: segmentLabel, value: item.count, className: "bg-gradient-to-r from-teal-400 to-teal-600" }],
        }))}
    />
  );
};
