"use client";

import { useId, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ReducedMotionConfig,
  spring,
  transition,
  useShouldReduceMotion,
  useTempoTransition,
} from "@animate-ui/react/utils/motion";
import {
  AlarmClock,
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Flame,
  GaugeCircle,
  GraduationCap,
  Scale,
  Rows3,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import {
  busiestDay,
  completionStreak,
  donutArcs,
  type AssistantChart as AssistantChartData,
  type ChartKind,
} from "@/lib/ai/assistant/chart-data";
import { getCourseColor } from "@/lib/courses/course-colors";
import { formatDayMonth, intlDateFormat, tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AssistantChartOutput = { ok: true; action: "chart"; chart: AssistantChartData };

export const isChartOutput = (output: unknown): output is AssistantChartOutput =>
  (output as { action?: string } | null)?.action === "chart" && Boolean((output as { chart?: unknown }).chart);

type Chart<K extends ChartKind> = Extract<AssistantChartData, { kind: K }>;

const ICONS: Record<ChartKind, LucideIcon> = {
  course_workload: GraduationCap,
  status: GaugeCircle,
  list_distribution: Rows3,
  daily_progress: TrendingUp,
  deadline_load: CalendarDays,
  next_deadlines: AlarmClock,
  week_compare: Scale,
};

// Màu cố định chứ không theo accent: accent đổi được và có thể trùng màu "hoàn thành".
const PALETTE =
  "[--series-done:#1baf7a] [--series-open:#2a78d6] [--series-late:#e34948] [--series-soon:#eda100] [--series-none:#a3a3a3] " +
  "dark:[--series-done:#199e70] dark:[--series-open:#3987e5] dark:[--series-late:#e66767] dark:[--series-soon:#c98500] dark:[--series-none:#7c7c85]";

const SERIES = {
  done: "var(--series-done)",
  open: "var(--series-open)",
  late: "var(--series-late)",
  soon: "var(--series-soon)",
  none: "var(--series-none)",
};

const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

// Khoá "YYYY-MM-DD" là ngày theo múi giờ người dùng: đọc lại ở UTC để không lệch ngày.
const dateOf = (key: string) => new Date(`${key}T12:00:00.000Z`);
const dayLabel = (key: string) => formatDayMonth(dateOf(key), "UTC");
const weekday = (key: string, style: "long" | "short") => intlDateFormat({ weekday: style, timeZone: "UTC" }).format(dateOf(key));
// 01/01/2024 là Thứ Hai: dùng để in hàng tiêu đề lịch theo ngôn ngữ người dùng.
const WEEK_KEYS = [1, 2, 3, 4, 5, 6, 7].map((day) => `2024-01-0${day}`);

const defaultTitle = (chart: AssistantChartData) =>
  chart.kind === "daily_progress" || chart.kind === "deadline_load"
    ? tr(`aiAssistant.chart.title.${chart.kind}` as const, { days: chart.days })
    : tr(`aiAssistant.chart.title.${chart.kind}` as const);

const describe = (chart: AssistantChartData) => {
  const usesPeriod = chart.kind === "course_workload" || chart.kind === "status" || chart.kind === "list_distribution";
  return [
    usesPeriod ? tr(`aiAssistant.chart.period.${chart.period}` as const) : null,
    chart.query ? tr("aiAssistant.chart.query", { query: chart.query }) : null,
  ].filter(Boolean).join(" · ");
};

const Empty = ({ label }: { label: string }) => (
  <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">{label}</p>
);

/** Câu trả lời đặt lên đầu: đọc xong dòng này là đủ, hình bên dưới chỉ để nhìn rõ hơn. */
const Headline = ({ text, hint, warn }: { text: string; hint?: string; warn?: boolean }) => (
  <div className="mb-3">
    <p className="text-[15px] font-semibold leading-snug text-foreground">{text}</p>
    {hint ? (
      <p className="mt-1 flex items-center gap-1.5 text-xs leading-4 text-muted-foreground">
        {warn ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: SERIES.late }} aria-hidden /> : null}
        {hint}
      </p>
    ) : null}
  </div>
);

const DONUT_RADIUS = 15.915; // chu vi ≈ 100, dasharray đọc thẳng theo phần trăm

type Arc = { key: string; start: number; length: number; color: string };

const Ring = ({ arcs, label, active = null, onHover, thickness = 4.4, children, className }: {
  arcs: Arc[];
  label: string;
  active?: number | null;
  onHover?: (index: number | null) => void;
  thickness?: number;
  children: ReactNode;
  className: string;
}) => {
  const reduceMotion = useShouldReduceMotion();
  const draw = useTempoTransition(spring.progress);
  const highlight = useTempoTransition(spring.highlight);

  return (
    <div className={cn("relative shrink-0", className)}>
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label={label}>
        <circle cx="21" cy="21" r={DONUT_RADIUS} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        {arcs.map((arc, index) =>
          arc.length > 0 ? (
            <motion.circle
              key={arc.key}
              cx="21"
              cy="21"
              r={DONUT_RADIUS}
              fill="none"
              stroke={arc.color}
              strokeDashoffset={-arc.start}
              initial={reduceMotion ? false : { strokeDasharray: "0 100" }}
              animate={{
                strokeDasharray: `${arc.length} ${100 - arc.length}`,
                strokeWidth: active === index ? thickness + 1 : thickness,
                opacity: active === null || active === index ? 1 : 0.35,
              }}
              transition={{ default: highlight, strokeDasharray: { ...draw, delay: index * 0.06 } }}
              onMouseEnter={() => onHover?.(index)}
              onMouseLeave={() => onHover?.(null)}
            />
          ) : null,
        )}
      </svg>
      {children}
    </div>
  );
};

const STATUS_SERIES = [
  { key: "analytics.scheduleHealth.completed", color: SERIES.done },
  { key: "analytics.scheduleHealth.inProgress", color: SERIES.open },
  { key: "analytics.scheduleHealth.overdue", color: SERIES.late },
  { key: "analytics.scheduleHealth.noDue", color: SERIES.none },
] as const;

const Status = ({ chart }: { chart: Chart<"status"> }) => {
  const [active, setActive] = useState<number | null>(null);
  const swap = useTempoTransition(transition.swap);

  const values = chart.items.map((item) => item.value);
  const [done, , overdue] = values;
  const total = values.reduce((sum, value) => sum + value, 0);
  const arcs = donutArcs(values).map((arc, index) => ({ ...arc, key: STATUS_SERIES[index].key, color: STATUS_SERIES[index].color }));
  const center = active === null
    ? { value: `${chart.completionRate}%`, label: tr("aiAssistant.chart.completed") }
    : { value: String(values[active]), label: tr(STATUS_SERIES[active].key) };

  return (
    <>
      <Headline
        text={tr("aiAssistant.chart.headline.status", { done, total })}
        hint={overdue > 0 ? tr("aiAssistant.chart.hint.overdue", { count: overdue }) : tr("aiAssistant.chart.hint.noOverdue")}
        warn={overdue > 0}
      />
      <div className="flex items-center gap-3">
        <Ring
          arcs={arcs}
          label={tr("aiAssistant.chart.completionRate", { rate: chart.completionRate })}
          active={active}
          onHover={setActive}
          className="h-28 w-28"
        >
          <motion.div
            key={active ?? "all"}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center"
            initial={{ opacity: 0, filter: "blur(2px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={swap}
          >
            <span className="text-xl font-semibold leading-6 tabular-nums text-foreground">{center.value}</span>
            <span className="max-w-full truncate text-[10px] leading-4 text-muted-foreground">{center.label}</span>
          </motion.div>
        </Ring>
        <ul className="min-w-0 flex-1 space-y-0.5">
          {values.map((value, index) => (
            <li
              key={STATUS_SERIES[index].key}
              className={cn("flex items-center justify-between gap-2 rounded-md px-1 py-1 text-xs transition-colors", active === index && "bg-muted/70")}
              onMouseEnter={() => value > 0 && setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_SERIES[index].color }} />
                <span className="truncate">{tr(STATUS_SERIES[index].key)}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">{value}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

/** Mỗi môn một vòng tiến độ: nhìn là biết môn nào sắp xong, môn nào còn nhiều. */
const CourseRings = ({ chart }: { chart: Chart<"course_workload"> }) => {
  const heaviest = chart.items[0];
  const left = (item: Chart<"course_workload">["items"][number]) => item.open + item.overdue;
  const courseName = (item: Chart<"course_workload">["items"][number]) =>
    item.id === "personal" && item.name === "Cá nhân" ? tr("analytics.personal") : item.name;

  return (
    <>
      <Headline
        text={heaviest && left(heaviest) > 0
          ? tr("aiAssistant.chart.headline.course", { name: courseName(heaviest), count: left(heaviest) })
          : tr("aiAssistant.chart.headline.courseDone")}
      />
      <ul className="grid max-h-[300px] grid-cols-1 gap-1.5 overflow-y-auto styled-scrollbar @[420px]:grid-cols-2">
        {chart.items.map((item) => {
          const total = item.completed + left(item);
          const percent = total === 0 ? 0 : Math.round((item.completed / total) * 100);

          return (
            <li key={item.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 p-2">
              <Ring
                arcs={[{ key: "done", start: 0, length: percent, color: SERIES.done }]}
                label={`${courseName(item)}: ${percent}%`}
                thickness={5}
                className="h-11 w-11"
              >
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-foreground">{percent}%</span>
              </Ring>
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-xs font-medium leading-4 text-foreground">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", getCourseColor(item.color).dot)} />
                  <span className="truncate" title={courseName(item)}>{courseName(item)}</span>
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-[11px] leading-4 text-muted-foreground">
                  {left(item) > 0 ? tr("aiAssistant.chart.course.left", { count: left(item) }) : tr("aiAssistant.chart.course.done")}
                  {item.overdue > 0 ? (
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: SERIES.late }} aria-hidden />
                      {tr("aiAssistant.chart.course.late", { count: item.overdue })}
                    </span>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
};

const MAX_DOTS = 24;

/** Mỗi việc là một chấm: đếm bằng mắt được, không cần đọc trục hay tỉ lệ. */
const ListDots = ({ chart }: { chart: Chart<"list_distribution"> }) => {
  const reveal = useTempoTransition(spring.entrance);
  const top = chart.items.reduce((best, item) => (item.count > best.count ? item : best), chart.items[0]);
  const perDot = Math.max(1, Math.ceil(top.count / MAX_DOTS));

  return (
    <>
      <Headline
        text={tr("aiAssistant.chart.headline.list", { name: top.name, count: top.count })}
        hint={perDot > 1 ? tr("aiAssistant.chart.hint.dot", { count: perDot }) : undefined}
      />
      <ul className="max-h-[300px] space-y-2.5 overflow-y-auto styled-scrollbar">
        {chart.items.map((item, index) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...reveal, delay: Math.min(index, 8) * 0.05 }}
          >
            <p className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground">{item.name}</span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">{item.count}</span>
            </p>
            <div className="flex min-h-2.5 flex-wrap gap-1">
              {Array.from({ length: Math.ceil(item.count / perDot) }, (_, dot) => (
                <span
                  key={dot}
                  className={cn("h-2.5 w-2.5 rounded-full bg-violet-500", item.id !== top.id && "opacity-45")}
                />
              ))}
            </div>
          </motion.li>
        ))}
      </ul>
    </>
  );
};

/** Cột từng ngày không trục, không lưới: chỉ hỏi "hôm nào làm được nhiều". */
const Rhythm = ({ chart }: { chart: Chart<"daily_progress"> }) => {
  const grow = useTempoTransition(spring.number);
  if (chart.totals.created + chart.totals.completed === 0) return <Empty label={tr("aiAssistant.chart.emptyRange")} />;

  const peak = busiestDay(chart.points, (point) => point.completed);
  const streak = completionStreak(chart.points);
  const net = chart.totals.created - chart.totals.completed;
  const hint = net > 0
    ? tr("aiAssistant.chart.hint.backlogUp", { count: net })
    : net < 0
      ? tr("aiAssistant.chart.hint.backlogDown", { count: -net })
      : tr("aiAssistant.chart.hint.backlogEven");

  return (
    <>
      <Headline text={tr("aiAssistant.chart.headline.progress", { days: chart.days, count: chart.totals.completed })} hint={hint} />
      {streak >= 2 ? (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-foreground">
          <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
          {tr("aiAssistant.chart.streak", { count: streak })}
        </p>
      ) : null}
      <div className="flex h-24 items-end gap-[3px] pt-4">
        {chart.points.map((point, index) => {
          const isToday = index === chart.points.length - 1;
          const isPeak = point.date === peak?.date;

          return (
            <div key={point.date} title={`${dayLabel(point.date)}: ${point.completed}`} className="relative flex h-full min-w-0 flex-1 items-end">
              {isPeak ? (
                <span
                  className="absolute inset-x-0 text-center text-[11px] font-semibold tabular-nums text-foreground"
                  style={{ bottom: "calc(100% + 2px)" }}
                >
                  {point.completed}
                </span>
              ) : null}
              <motion.div
                className="w-full rounded-t-[4px]"
                style={{
                  height: point.completed === 0 ? 3 : `${(point.completed / (peak?.count ?? 1)) * 100}%`,
                  backgroundColor: point.completed === 0 ? "var(--muted)" : tint(SERIES.done, isToday || isPeak ? 100 : 55),
                  originY: 1,
                }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ ...grow, delay: Math.min(index, 14) * 0.02 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between border-t border-border pt-1 text-[11px] text-muted-foreground">
        <span>{dayLabel(chart.points[0].date)}</span>
        <span>{tr("aiAssistant.chart.today")}</span>
      </div>
    </>
  );
};

const LOAD_LEVELS = [
  { max: 2, percent: 20, key: "aiAssistant.chart.load.light" },
  { max: 4, percent: 50, key: "aiAssistant.chart.load.medium" },
  { max: Infinity, percent: 100, key: "aiAssistant.chart.load.heavy" },
] as const;

/** Lịch tháng ai cũng đọc được: ô càng đậm là ngày càng nhiều deadline. */
const DeadlineCalendar = ({ chart }: { chart: Chart<"deadline_load"> }) => {
  const pop = useTempoTransition(spring.pop);
  const peak = busiestDay(chart.points, (point) => point.open);
  // Lùi về Thứ Hai để ngày rơi đúng cột của lịch.
  const blanks = chart.points.length > 0 ? (dateOf(chart.points[0].date).getUTCDay() + 6) % 7 : 0;
  const hint = chart.overdue > 0 ? tr("aiAssistant.chart.overdue", { count: chart.overdue }) : undefined;

  return (
    <>
      <Headline
        text={peak
          ? tr("aiAssistant.chart.headline.deadline", { day: weekday(peak.date, "long"), date: dayLabel(peak.date), count: peak.count })
          : tr("aiAssistant.chart.headline.deadlineEmpty", { days: chart.days })}
        hint={hint}
        warn={Boolean(hint)}
      />
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_KEYS.map((key) => (
          <span key={key} className="truncate text-[10px] leading-4 text-muted-foreground">{weekday(key, "short")}</span>
        ))}
        {Array.from({ length: blanks }, (_, index) => <span key={index} aria-hidden />)}
        {chart.points.map((point, index) => {
          const level = LOAD_LEVELS.find((item) => point.open <= item.max)!;
          const heavy = level.percent === 100;

          return (
            <motion.div
              key={point.date}
              title={`${dayLabel(point.date)}: ${point.open}`}
              className={cn(
                "flex h-11 flex-col items-center justify-center rounded-lg leading-none",
                point.open === 0 && "bg-muted/60",
                index === 0 && "ring-2 ring-foreground/40",
              )}
              style={point.open > 0 ? { backgroundColor: tint(SERIES.open, level.percent) } : undefined}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...pop, delay: Math.min(index, 14) * 0.02 }}
            >
              <span className={cn("text-[10px] tabular-nums", heavy && point.open > 0 ? "text-white/85" : "text-muted-foreground")}>
                {dateOf(point.date).getUTCDate()}
              </span>
              {point.open > 0 ? (
                <span className={cn("mt-0.5 text-sm font-semibold tabular-nums", heavy ? "text-white" : "text-foreground")}>{point.open}</span>
              ) : null}
            </motion.div>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center justify-end gap-3 text-[11px] text-muted-foreground">
        {LOAD_LEVELS.map((level) => (
          <span key={level.key} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: tint(SERIES.open, level.percent) }} />
            {tr(level.key)}
          </span>
        ))}
      </div>
    </>
  );
};

const countdown = (daysLeft: number) => {
  if (daysLeft < 0) return { label: tr("aiAssistant.chart.countdown.late", { count: -daysLeft }), color: SERIES.late };
  if (daysLeft === 0) return { label: tr("aiAssistant.chart.today"), color: SERIES.late };
  if (daysLeft === 1) return { label: tr("aiAssistant.chart.countdown.tomorrow"), color: SERIES.soon };
  return { label: tr("aiAssistant.chart.countdown.left", { count: daysLeft }), color: daysLeft <= 3 ? SERIES.soon : SERIES.open };
};

/** Danh sách đếm ngược: bấm vào là mở thẻ để làm luôn. */
const NextDeadlines = ({ chart, onOpenCard }: { chart: Chart<"next_deadlines">; onOpenCard: (cardId: string) => void }) => {
  const reveal = useTempoTransition(spring.entrance);
  if (chart.items.length === 0) return <Empty label={tr("aiAssistant.chart.headline.nextEmpty")} />;

  const more = chart.matchedCards - chart.items.length;

  return (
    <>
      <Headline
        text={tr("aiAssistant.chart.headline.next", { title: chart.items[0].title })}
        hint={more > 0 ? tr("aiAssistant.chart.hint.more", { count: more }) : undefined}
      />
      <ul className="-mx-1.5 space-y-0.5">
        {chart.items.map((item, index) => {
          const { label, color } = countdown(item.daysLeft);

          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...reveal, delay: index * 0.05 }}
            >
              <button
                type="button"
                onClick={() => onOpenCard(item.id)}
                className="group flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span
                  className="w-[4.5rem] shrink-0 rounded-md px-1 py-1 text-center text-[11px] font-semibold leading-4 text-foreground"
                  style={{ backgroundColor: tint(color, 18) }}
                >
                  {label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium leading-4 text-foreground">{item.title}</span>
                  {item.courseName ? <span className="block truncate text-[11px] leading-4 text-muted-foreground">{item.courseName}</span> : null}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
              </button>
            </motion.li>
          );
        })}
      </ul>
    </>
  );
};

/** Hai con số cạnh nhau: tuần này hơn hay kém tuần trước. */
const WeekCompare = ({ chart }: { chart: Chart<"week_compare"> }) => {
  const grow = useTempoTransition(spring.number);
  const { recent, previous } = chart;
  if (recent.completed + previous.completed + recent.created === 0) return <Empty label={tr("aiAssistant.chart.emptyRange")} />;

  const diff = recent.completed - previous.completed;
  const max = Math.max(1, recent.completed, previous.completed);
  const rows = [
    { key: "previous", label: tr("aiAssistant.chart.week.previous"), value: previous.completed, color: SERIES.none },
    { key: "recent", label: tr("aiAssistant.chart.week.recent"), value: recent.completed, color: SERIES.done },
  ];

  return (
    <>
      <Headline
        text={diff > 0
          ? tr("aiAssistant.chart.headline.weekUp", { count: diff })
          : diff < 0
            ? tr("aiAssistant.chart.headline.weekDown", { count: -diff })
            : tr("aiAssistant.chart.headline.weekSame", { count: recent.completed })}
        hint={recent.created > 0 ? tr("aiAssistant.chart.hint.weekCreated", { count: recent.created }) : undefined}
      />
      <ul className="space-y-2.5">
        {rows.map((row, index) => (
          <li key={row.key}>
            <p className="mb-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              {row.label}
              <span className="text-xl font-semibold leading-6 tabular-nums text-foreground">{row.value}</span>
            </p>
            <div className="h-3 overflow-hidden rounded-full bg-foreground/[0.07]">
              {/* Bề rộng cố định theo giá trị, thanh mọc ra bằng scaleX chứ không animate width. */}
              <motion.div
                className="h-full rounded-full"
                style={{ width: `${(row.value / max) * 100}%`, backgroundColor: row.color, originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ ...grow, delay: index * 0.08 }}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

const ChartBody = ({ chart, onOpenCard }: { chart: AssistantChartData; onOpenCard: (cardId: string) => void }) => {
  if (chart.matchedCards === 0 && chart.kind !== "next_deadlines") return <Empty label={tr("aiAssistant.chart.empty")} />;

  switch (chart.kind) {
    case "course_workload":
      return <CourseRings chart={chart} />;
    case "list_distribution":
      return <ListDots chart={chart} />;
    case "status":
      return <Status chart={chart} />;
    case "daily_progress":
      return <Rhythm chart={chart} />;
    case "deadline_load":
      return <DeadlineCalendar chart={chart} />;
    case "next_deadlines":
      return <NextDeadlines chart={chart} onOpenCard={onOpenCard} />;
    case "week_compare":
      return <WeekCompare chart={chart} />;
  }
};

const ChartCard = ({ chart, onOpenCard }: { chart: AssistantChartData; onOpenCard: (cardId: string) => void }) => {
  const entrance = useTempoTransition(spring.entrance);
  const titleId = useId();
  const Icon = ICONS[chart.kind];
  const description = describe(chart);

  return (
    <motion.section
      aria-labelledby={titleId}
      className={cn(PALETTE, "@container relative overflow-hidden rounded-xl border border-border bg-card p-3.5")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={entrance}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-violet-500/[0.08] to-transparent" />
      <header className="relative mb-2.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-300">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h3 id={titleId} className="min-w-0 truncate font-medium">{chart.title ?? defaultTitle(chart)}</h3>
        {description ? <span className="ml-auto shrink-0 truncate text-[11px]">{description}</span> : null}
      </header>
      <div className="relative">
        <ChartBody chart={chart} onOpenCard={onOpenCard} />
      </div>
    </motion.section>
  );
};

/** Thẻ trả lời trực quan trong khung chat: câu kết luận trước, hình quen thuộc sau, không trục không lưới. */
export const AssistantChart = ({ chart, onOpenCard }: { chart: AssistantChartData; onOpenCard: (cardId: string) => void }) => (
  <ReducedMotionConfig remount>
    <ChartCard chart={chart} onOpenCard={onOpenCard} />
  </ReducedMotionConfig>
);
