"use client";

import type { ReactNode } from "react";
import { Effect } from "@animate-ui/react/primitives/effects/effect";
import { ReducedMotionConfig } from "@animate-ui/react/utils/motion";
import { BarChart3, PieChart, Users } from "lucide-react";

import type { BoardAnalyticsViewProps } from "../_types";
import { AiReportPanel } from "./ai-report-panel";
import { ChartPanel } from "./chart-panel";
import { CourseWorkloadChart } from "./course-workload-chart";
import { KpiRow } from "./kpi-row";
import { ListDistributionChart } from "./list-distribution-chart";
import { OverdueCardsPanel } from "./overdue-cards-panel";
import { ScheduleHealthChart } from "./schedule-health-chart";
import { WorkloadChart } from "./workload-chart";

// Bento cells come in one after the other: fade + 8px rise on spring.entrance, 70ms apart.
const Cell = ({ index, className, children }: { index: number; className?: string; children: ReactNode }) => (
  <Effect fade slide={{ offset: 8 }} delay={index * 70} className={className}>
    {children}
  </Effect>
);

export const BoardAnalyticsView = ({
  boardId,
  kpis,
  listDistribution,
  workload,
  scheduleHealth,
  insights,
  boardType,
  courseBreakdown,
}: BoardAnalyticsViewProps) => {
  const hasCards = kpis.totalCards > 0;

  return (
    <div className="h-full overflow-y-auto bg-black/30 p-4 font-sans styled-scrollbar sm:p-6">
      <ReducedMotionConfig remount>
        <div className="mx-auto grid w-full max-w-7xl gap-4 pb-8 lg:grid-cols-3">
          <Cell index={0} className="lg:col-span-3">
            <KpiRow kpis={kpis} />
          </Cell>

          <Cell index={1} className="lg:col-span-2">
            <ChartPanel
              title="Phân bổ theo danh sách"
              description="Số thẻ trong từng danh sách"
              icon={BarChart3}
            >
              <ListDistributionChart data={listDistribution} hasCards={hasCards} />
            </ChartPanel>
          </Cell>

          <Cell index={2}>
            <OverdueCardsPanel overdueCards={insights.overdueCards} />
          </Cell>

          <Cell index={3} className="lg:col-span-2">
            {boardType === "WORKSPACE" ? (
              <ChartPanel
                title="Khối lượng theo danh mục"
                description="Hoàn thành, đang mở, quá hạn theo từng môn"
                icon={BarChart3}
              >
                <CourseWorkloadChart data={courseBreakdown} />
              </ChartPanel>
            ) : (
              <ChartPanel
                title="Khối lượng thành viên"
                description="Số lượt được giao thẻ"
                icon={Users}
              >
                <WorkloadChart data={workload} />
              </ChartPanel>
            )}
          </Cell>

          <Cell index={4}>
            <ChartPanel
              title="Trạng thái hạn"
              description="Thẻ theo tình trạng deadline"
              icon={PieChart}
            >
              <ScheduleHealthChart kpis={kpis} data={scheduleHealth} />
            </ChartPanel>
          </Cell>

          <Cell index={5} className="lg:col-span-3">
            <AiReportPanel boardId={boardId} />
          </Cell>
        </div>
      </ReducedMotionConfig>
    </div>
  );
};
