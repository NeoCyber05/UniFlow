"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CountingNumber } from "@animate-ui/react/primitives/texts/counting-number";

import { tr } from "@/lib/i18n";
import type { BoardMessageKey } from "@/lib/i18n/messages/vi-board";

import type { Kpis, SchedulePoint } from "../_types";
import { legendColors, scheduleGradients } from "../_lib/chart-formatters";
import { CustomTooltip } from "./custom-tooltip";
import { EmptyState } from "./empty-state";

const SCHEDULE_NAME_KEY_MAP: Record<string, BoardMessageKey> = {
  "Hoàn thành": "analytics.scheduleHealth.completed",
  "Đang làm": "analytics.scheduleHealth.inProgress",
  "Quá hạn": "analytics.scheduleHealth.overdue",
  "Chưa có hạn": "analytics.scheduleHealth.noDue",
};

export const ScheduleHealthChart = ({
  kpis,
  data,
}: {
  kpis: Kpis;
  data: SchedulePoint[];
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <EmptyState label={tr("analytics.scheduleHealth.empty")} />;
  }

  const localizedData = data.map((item) => {
    const key = SCHEDULE_NAME_KEY_MAP[item.name];
    return key ? { ...item, name: tr(key) } : item;
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <CountingNumber number={kpis.totalCards} className="text-2xl font-bold tabular-nums text-neutral-900" />
          <span className="mt-0.5 text-[11px] font-medium text-neutral-500">
            {tr("analytics.scheduleHealth.totalCards")}
          </span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="colorActive" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
              <linearGradient id="colorOverdue" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#fda4af" />
              </linearGradient>
              <linearGradient id="colorUnscheduled" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#737373" />
                <stop offset="100%" stopColor="#a3a3a3" />
              </linearGradient>
            </defs>
            <Pie
              data={localizedData}
              cx="50%"
              cy="50%"
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={84}
              paddingAngle={3}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
            >
              {localizedData.map((entry, index) => (
                <Cell key={entry.name} fill={scheduleGradients[index % scheduleGradients.length]} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => <CustomTooltip {...props} />}
              isAnimationActive={false}
              cursor={false}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="grid w-full grid-cols-2 gap-2">
        {localizedData.map((item, index) => (
          <li key={item.name} className="rounded-xl bg-neutral-50 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: legendColors[index] }} />
              <span className="truncate text-xs text-neutral-500">{item.name}</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900">
              {item.value}
              <span className="ml-1 text-xs font-normal text-neutral-400">
                · {Math.round((item.value / total) * 100)}%
              </span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};
