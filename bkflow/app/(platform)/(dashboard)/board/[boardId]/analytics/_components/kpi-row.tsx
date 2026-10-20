"use client";

import { motion } from "motion/react";
import { spring, useTempoTransition } from "@animate-ui/react/utils/motion";
import { CountingNumber } from "@animate-ui/react/primitives/texts/counting-number";
import { AlertTriangle, CalendarX2, CircleDashed, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Kpis } from "../_types";

const RING_RADIUS = 42;

type Tone = "info" | "danger" | "warning";

const toneClassName: Record<Tone, { icon: string; value: string }> = {
  info: { icon: "bg-violet-50 text-violet-600", value: "text-neutral-900" },
  danger: { icon: "bg-rose-50 text-rose-600", value: "text-rose-600" },
  warning: { icon: "bg-amber-50 text-amber-600", value: "text-amber-600" },
};

const StatTile = ({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  tone: Tone;
  icon: LucideIcon;
}) => {
  const isActive = value > 0;

  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-neutral-500">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", isActive ? toneClassName[tone].icon : "bg-neutral-50 text-neutral-300")}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div>
        <CountingNumber
          number={value}
          className={cn("block text-3xl font-semibold tabular-nums", isActive ? toneClassName[tone].value : "text-neutral-300")}
        />
        <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      </div>
    </div>
  );
};

export const KpiRow = ({ kpis }: { kpis: Kpis }) => {
  const progressSpring = useTempoTransition(spring.progress);
  const ratio = kpis.totalCards === 0 ? 0 : kpis.completedCards / kpis.totalCards;
  const remaining = kpis.totalCards - kpis.completedCards;

  return (
    <section aria-label="Tiến độ công việc" className="grid gap-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]">
      <div className="flex items-center gap-5 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-xs sm:col-span-3 lg:col-span-1">
        <div
          role="progressbar"
          aria-valuenow={kpis.completionRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tỷ lệ hoàn thành"
          className="relative h-[104px] w-[104px] shrink-0"
        >
          <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90">
            <circle cx="52" cy="52" r={RING_RADIUS} fill="none" strokeWidth="10" className="stroke-neutral-100" />
            <motion.circle
              cx="52"
              cy="52"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className="stroke-violet-600"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: ratio, opacity: ratio === 0 ? 0 : 1 }}
              transition={progressSpring}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-neutral-900">
            <CountingNumber number={kpis.completionRate} className="tabular-nums" />%
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-neutral-500">Tiến độ chung</p>
          <p className="mt-1 text-neutral-900">
            <CountingNumber number={kpis.completedCards} className="text-3xl font-semibold tabular-nums" />
            <span className="text-lg text-neutral-400 tabular-nums">/{kpis.totalCards}</span>
            <span className="ml-2 text-sm text-neutral-500">việc đã xong</span>
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            {kpis.totalCards === 0
              ? "Chưa có việc nào để theo dõi"
              : remaining === 0
                ? "Đã xong hết, làm tốt lắm!"
                : `Còn ${remaining} việc đang mở`}
          </p>
        </div>
      </div>

      <StatTile
        label="Đang mở"
        value={remaining}
        hint={remaining > 0 ? "Việc chưa hoàn thành" : "Không còn việc mở"}
        tone="info"
        icon={CircleDashed}
      />
      <StatTile
        label="Quá hạn"
        value={kpis.overdueCards}
        hint={kpis.overdueCards > 0 ? "Cần xử lý trước" : "Không có việc trễ"}
        tone="danger"
        icon={AlertTriangle}
      />
      <StatTile
        label="Chưa có hạn"
        value={kpis.unscheduledCards}
        hint={kpis.unscheduledCards > 0 ? "Nên đặt deadline" : "Tất cả đã có hạn"}
        tone="warning"
        icon={CalendarX2}
      />
    </section>
  );
};
