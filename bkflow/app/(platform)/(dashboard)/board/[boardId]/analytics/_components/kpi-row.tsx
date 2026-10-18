"use client";

import { ProgressSummary } from "@/components/stats/progress-summary";

import type { Kpis } from "../_types";

export const KpiRow = ({ kpis }: { kpis: Kpis }) => (
  <ProgressSummary
    totalCards={kpis.totalCards}
    completedCards={kpis.completedCards}
    overdueCards={kpis.overdueCards}
    unscheduledCards={kpis.unscheduledCards}
  />
);
