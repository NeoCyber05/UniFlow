"use client";

import { tr } from "@/lib/i18n";

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
      <EmptyState label={hasCards ? tr("analytics.listDist.emptyLists") : tr("analytics.listDist.emptyBoard")} />
    );
  }

  const segmentLabel = tr("analytics.listDist.segmentLabel");

  return (
    <BarList
      items={data.map((item, index) => ({
        key: item.id ?? `${item.name}-${index}`,
        name: item.name,
        segments: [{ label: segmentLabel, value: item.count, className: "bg-gradient-to-r from-violet-400 to-violet-600" }],
      }))}
    />
  );
};
