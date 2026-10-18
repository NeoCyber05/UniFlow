"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CoursePoint } from "../_types";
import { chartTickStyle, formatAxisName, getScrollableChartHeight } from "../_lib/chart-formatters";
import { ChartScrollFrame } from "./chart-scroll-frame";
import { CustomTooltip } from "./custom-tooltip";
import { EmptyState } from "./empty-state";

export const CourseWorkloadChart = ({ data }: { data: CoursePoint[] }) => {
  const hasData = data.some((item) => item.completed + item.open + item.overdue > 0);

  if (!hasData) {
    return <EmptyState label="Chưa có thẻ nào gắn môn học." />;
  }

  return (
    <ChartScrollFrame height={getScrollableChartHeight(data.length)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={chartTickStyle} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tickFormatter={formatAxisName}
            tickLine={false}
            axisLine={false}
            tick={chartTickStyle}
          />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            content={(props) => <CustomTooltip {...props} />}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="completed" name="Hoàn thành" stackId="course" fill="#10b981" barSize={16} />
          <Bar dataKey="open" name="Đang mở" stackId="course" fill="#3b82f6" barSize={16} />
          <Bar dataKey="overdue" name="Quá hạn" stackId="course" fill="#f43f5e" radius={[0, 6, 6, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </ChartScrollFrame>
  );
};
