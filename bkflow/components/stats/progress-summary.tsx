import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type Tone = "danger" | "warning" | "info";

type Signal = {
  label: string;
  value: number;
  tone: Tone;
  activeHint: string;
  idleHint: string;
};

type ProgressSummaryProps = {
  totalCards: number;
  completedCards: number;
  overdueCards: number;
  unscheduledCards: number;
  /** Cards due within the next 7 days. Omit to hide the cell. */
  dueSoonCards?: number;
  className?: string;
};

const toneClassName: Record<Tone, { value: string; dot: string }> = {
  danger: { value: "text-rose-600", dot: "bg-rose-500" },
  warning: { value: "text-amber-600", dot: "bg-amber-500" },
  info: { value: "text-violet-700", dot: "bg-violet-500" },
};

export const ProgressSummary = ({
  totalCards,
  completedCards,
  overdueCards,
  unscheduledCards,
  dueSoonCards,
  className,
}: ProgressSummaryProps) => {
  const completionRate = totalCards === 0
    ? 0
    : Math.round((completedCards / totalCards) * 100);
  const remaining = totalCards - completedCards;

  const signals: Signal[] = [
    {
      label: "Quá hạn",
      value: overdueCards,
      tone: "danger",
      activeHint: "Cần xử lý trước",
      idleHint: "Không có việc trễ",
    },
    ...(dueSoonCards === undefined
      ? []
      : [{
          label: "Đến hạn 7 ngày tới",
          value: dueSoonCards,
          tone: "info" as const,
          activeHint: "Lên kế hoạch tuần này",
          idleHint: "Tuần này khá nhẹ",
        }]),
    {
      label: "Chưa có hạn",
      value: unscheduledCards,
      tone: "warning",
      activeHint: "Nên đặt deadline",
      idleHint: "Tất cả đã có hạn",
    },
  ];

  return (
    <section
      aria-label="Tiến độ công việc"
      className={cn(
        "grid overflow-hidden rounded-xl border border-neutral-200 bg-white md:grid-cols-[minmax(0,1.6fr)_repeat(var(--signal-count),minmax(0,1fr))]",
        className,
      )}
      style={{ "--signal-count": signals.length } as CSSProperties}
    >
      <div className="p-4 sm:p-5">
        <p className="text-sm text-neutral-500">Tiến độ chung</p>
        <p className="mt-1 text-neutral-900">
          <span className="text-3xl font-semibold tabular-nums">{completedCards}</span>
          <span className="text-lg text-neutral-400 tabular-nums">/{totalCards}</span>
          <span className="ml-2 text-sm text-neutral-500">việc đã xong</span>
        </p>
        <div
          role="progressbar"
          aria-valuenow={completionRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tỷ lệ hoàn thành"
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-500 tabular-nums">
          {totalCards === 0
            ? "Chưa có việc nào để theo dõi"
            : remaining === 0
              ? `${completionRate}% · Đã xong hết`
              : `${completionRate}% · Còn ${remaining} việc`}
        </p>
      </div>

      <div className="grid grid-cols-[repeat(var(--signal-count),minmax(0,1fr))] border-t border-neutral-100 md:contents">
        {signals.map(({ label, value, tone, activeHint, idleHint }) => {
          const isActive = value > 0;

          return (
            <div
              key={label}
              className="border-l border-neutral-100 p-4 first:border-l-0 sm:p-5 md:first:border-l"
            >
              <p className="flex items-center gap-1.5 text-sm leading-tight text-neutral-500">
                {isActive && (
                  <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", toneClassName[tone].dot)} />
                )}
                <span>{label}</span>
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold tabular-nums",
                  isActive ? toneClassName[tone].value : "text-neutral-300",
                )}
              >
                {value}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {isActive ? activeHint : idleHint}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
