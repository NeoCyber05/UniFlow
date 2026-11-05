"use client";

import { BarChart3, CalendarRange, Columns3, PieChart, TrendingUp, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartPanel } from "@/app/(platform)/(dashboard)/board/[boardId]/analytics/_components/chart-panel";
import { CourseWorkloadChart } from "@/app/(platform)/(dashboard)/board/[boardId]/analytics/_components/course-workload-chart";
import { CustomTooltip } from "@/app/(platform)/(dashboard)/board/[boardId]/analytics/_components/custom-tooltip";
import { ListDistributionChart } from "@/app/(platform)/(dashboard)/board/[boardId]/analytics/_components/list-distribution-chart";
import { ScheduleHealthChart } from "@/app/(platform)/(dashboard)/board/[boardId]/analytics/_components/schedule-health-chart";
import type { AssistantChart as AssistantChartData, ChartKind } from "@/lib/ai/assistant/chart-data";
import { formatDayMonth, tr } from "@/lib/i18n";

export type AssistantChartOutput = { ok: true; action: "chart"; chart: AssistantChartData };

export const isChartOutput = (output: unknown): output is AssistantChartOutput =>
  (output as { action?: string } | null)?.action === "chart" && Boolean((output as { chart?: unknown }).chart);

const ICONS: Record<ChartKind, LucideIcon> = {
  course_workload: BarChart3,
  status: PieChart,
  list_distribution: Columns3,
  daily_progress: TrendingUp,
  deadline_load: CalendarRange,
};

const AXIS_TICK = { fontSize: 10, fill: "#a3a3a3" };
const COLORS = { created: "#a78bfa", completed: "#10b981", open: "#3b82f6" };

// Khoá "YYYY-MM-DD" là ngày theo múi giờ người dùng: đọc lại ở UTC để không lệch ngày.
const dayLabel = (key: string) => formatDayMonth(new Date(`${key}T12:00:00.000Z`), "UTC");

const defaultTitle = (chart: AssistantChartData) =>
  chart.kind === "daily_progress" || chart.kind === "deadline_load"
    ? tr(`aiAssistant.chart.title.${chart.kind}` as const, { days: chart.days })
    : tr(`aiAssistant.chart.title.${chart.kind}` as const);

const describe = (chart: AssistantChartData) =>
  [
    chart.kind === "daily_progress" || chart.kind === "deadline_load" ? null : tr(`aiAssistant.chart.period.${chart.period}` as const),
    chart.query ? tr("aiAssistant.chart.query", { query: chart.query }) : null,
    tr("aiAssistant.chart.cards", { count: chart.matchedCards }),
  ].filter(Boolean).join(" · ");

const Legend = ({ items }: { items: { label: string; color: string }[] }) => (
  <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
    {items.map((item) => (
      <span key={item.label} className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
        {item.label}
      </span>
    ))}
  </div>
);

const DailyBars = ({ rows, series, stacked }: {
  rows: Record<string, number | string>[];
  series: { key: string; label: string; color: string }[];
  stacked?: boolean;
}) => (
  <div>
    <Legend items={series} />
    <div className="h-[170px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={10} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} width={24} />
          <Tooltip content={(props) => <CustomTooltip {...props} />} cursor={{ fill: "rgba(139, 92, 246, 0.06)" }} isAnimationActive={false} />
          {series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              fill={item.color}
              stackId={stacked ? "day" : undefined}
              radius={stacked && index < series.length - 1 ? 0 : [3, 3, 0, 0]}
              maxBarSize={18}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const Empty = ({ label }: { label: string }) => (
  <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-6 text-center text-xs text-neutral-500">{label}</p>
);

const ChartBody = ({ chart }: { chart: AssistantChartData }) => {
  if (chart.matchedCards === 0) return <Empty label={tr("aiAssistant.chart.empty")} />;

  switch (chart.kind) {
    case "course_workload":
      return <CourseWorkloadChart data={chart.items} compact />;
    case "list_distribution":
      return <ListDistributionChart data={chart.items} hasCards compact />;
    case "status": {
      const [completedCards, , overdueCards, unscheduledCards] = chart.items.map((item) => item.value);
      return (
        <ScheduleHealthChart
          data={chart.items}
          kpis={{ totalCards: chart.matchedCards, completedCards, overdueCards, unscheduledCards, completionRate: chart.completionRate }}
        />
      );
    }
    case "daily_progress": {
      if (chart.totals.created + chart.totals.completed === 0) return <Empty label={tr("aiAssistant.chart.emptyRange")} />;
      return (
        <DailyBars
          rows={chart.points.map((point) => ({ label: dayLabel(point.date), created: point.created, completed: point.completed }))}
          series={[
            { key: "created", label: `${tr("aiAssistant.chart.created")} · ${chart.totals.created}`, color: COLORS.created },
            { key: "completed", label: `${tr("aiAssistant.chart.completed")} · ${chart.totals.completed}`, color: COLORS.completed },
          ]}
        />
      );
    }
    case "deadline_load": {
      const upcoming = chart.points.reduce((sum, point) => sum + point.open + point.completed, 0);
      return (
        <div className="space-y-2">
          {chart.overdue > 0 ? (
            <p className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
              ⚠️ {tr("aiAssistant.chart.overdue", { count: chart.overdue })}
            </p>
          ) : null}
          {upcoming === 0 ? (
            <Empty label={tr("aiAssistant.chart.emptyRange")} />
          ) : (
            <DailyBars
              stacked
              rows={chart.points.map((point) => ({ label: dayLabel(point.date), open: point.open, completed: point.completed }))}
              series={[
                { key: "completed", label: tr("aiAssistant.chart.completed"), color: COLORS.completed },
                { key: "open", label: tr("aiAssistant.chart.open"), color: COLORS.open },
              ]}
            />
          )}
        </div>
      );
    }
  }
};

/** Biểu đồ do Trợ lý vẽ trong khung chat: dùng lại khung và component của trang Thống kê. */
export const AssistantChart = ({ chart }: { chart: AssistantChartData }) => (
  <ChartPanel
    title={chart.title ?? defaultTitle(chart)}
    description={describe(chart)}
    icon={ICONS[chart.kind]}
    className="h-auto rounded-xl p-3.5 shadow-none hover:shadow-none"
  >
    <ChartBody chart={chart} />
  </ChartPanel>
);
