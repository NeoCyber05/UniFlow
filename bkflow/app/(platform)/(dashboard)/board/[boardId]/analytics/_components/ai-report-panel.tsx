"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Effect } from "@animate-ui/react/primitives/effects/effect";
import {
  blur,
  scale,
  spring,
  transition,
  useShouldReduceMotion,
  useTempoTransition,
} from "@animate-ui/react/utils/motion";
import { AlertTriangle, Check, CheckCircle2, Clipboard, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { generateAiBoardReport } from "@/actions/ai/generate-ai-board-report";
import type { AiBoardReport } from "@/actions/ai/generate-ai-board-report/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";
import { intlDateFormat, tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { ReportRange } from "../_types";
import { formatReportMarkdown, getReportRangeLabel } from "../_lib/ai-report-markdown";
import { ChartPanel } from "./chart-panel";
import { ReportBullets } from "./report-bullets";

const RANGES: ReportRange[] = ["7d", "30d"];

const RangeToggle = ({
  value,
  onChange,
  disabled,
}: {
  value: ReportRange;
  onChange: (range: ReportRange) => void;
  disabled: boolean;
}) => {
  const selectionSpring = useTempoTransition(spring.selection);

  return (
    <div role="radiogroup" aria-label={tr("analytics.ai.rangeAria")} className="inline-flex h-9 rounded-xl bg-neutral-100 p-1">
      {RANGES.map((item) => (
        <button
          key={item}
          type="button"
          role="radio"
          aria-checked={value === item}
          onClick={() => onChange(item)}
          disabled={disabled}
          className={cn(
            "relative rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-50",
            value === item ? "text-violet-700" : "text-neutral-500 hover:text-neutral-800",
          )}
        >
          {value === item && (
            <motion.span
              layoutId="ai-report-range"
              className="absolute inset-0 rounded-lg bg-white shadow-xs"
              transition={selectionSpring}
            />
          )}
          <span className="relative">{getReportRangeLabel(item)}</span>
        </button>
      ))}
    </div>
  );
};

const CopyButton = ({ onCopy }: { onCopy: () => Promise<boolean> }) => {
  const [copied, setCopied] = useState(false);
  const reduce = useShouldReduceMotion();
  const swap = useTempoTransition(transition.swap);
  const pressSpring = useTempoTransition(spring.press);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const hidden = { opacity: 0, filter: blur.icon, transform: `scale(${reduce ? 1 : scale.icon})` };
  const shown = { opacity: 1, filter: "blur(0px)", transform: "scale(1)" };

  return (
    <motion.button
      type="button"
      onClick={async () => setCopied(await onCopy())}
      initial={{ transform: "scale(1)" }}
      whileTap={{ transform: reduce ? "scale(1)" : `scale(${scale.press})` }}
      transition={pressSpring}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 shadow-xs transition-colors hover:bg-neutral-50 hover:text-neutral-900"
    >
      <span className="relative h-3.5 w-3.5">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={copied ? "check" : "copy"}
            className="absolute inset-0"
            initial={hidden}
            animate={shown}
            exit={{ ...hidden, transition: swap }}
            transition={swap}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5" />}
          </motion.span>
        </AnimatePresence>
      </span>
      {copied ? tr("analytics.ai.copied") : tr("analytics.ai.copy")}
    </motion.button>
  );
};

const ReportSkeleton = () => (
  <div aria-busy className="space-y-4">
    <div className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
      <Skeleton className="h-4 w-32 bg-violet-100" />
      <Skeleton className="h-4 w-full bg-violet-100/80" />
      <Skeleton className="h-4 w-4/5 bg-violet-100/80" />
      <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14 rounded-xl bg-white/80" />
        ))}
      </div>
    </div>
    <div className="grid gap-3 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-neutral-200/70 p-4">
          <Skeleton className="h-8 w-1/2 bg-neutral-100" />
          <Skeleton className="h-3.5 w-full bg-neutral-100" />
          <Skeleton className="h-3.5 w-5/6 bg-neutral-100" />
          <Skeleton className="h-3.5 w-2/3 bg-neutral-100" />
        </div>
      ))}
    </div>
    <p className="flex items-center justify-center gap-2 text-xs font-medium text-violet-700">
      <RefreshCw className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
      {tr("analytics.ai.generatingSkeleton")}
    </p>
  </div>
);

const EmptyReport = () => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-violet-200 bg-gradient-to-b from-violet-50/60 to-white px-6 py-8 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md">
      <Sparkles className="h-6 w-6" />
    </span>
    <h3 className="mt-4 text-sm font-semibold text-neutral-900">{tr("analytics.ai.emptyTitle")}</h3>
    <p className="mt-1 max-w-md text-sm text-neutral-500">
      {tr("analytics.ai.emptyDesc")}
    </p>
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {[
        { label: tr("analytics.ai.pillCompleted"), icon: CheckCircle2, className: "text-emerald-600" },
        { label: tr("analytics.ai.pillRisks"), icon: AlertTriangle, className: "text-rose-600" },
        { label: tr("analytics.ai.pillActions"), icon: Lightbulb, className: "text-violet-600" },
      ].map(({ label, icon: Icon, className }) => (
        <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
          <Icon className={cn("h-3.5 w-3.5", className)} />
          {label}
        </span>
      ))}
    </div>
  </div>
);

export const AiReportPanel = ({
  boardId,
}: {
  boardId: string;
}) => {
  const [range, setRange] = useState<ReportRange>("7d");
  const [report, setReport] = useState<AiBoardReport | null>(null);
  const [reportRange, setReportRange] = useState<ReportRange>("7d");
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [panelError, setPanelError] = useState("");
  const reduce = useShouldReduceMotion();
  const pressSpring = useTempoTransition(spring.press);

  const { execute, isLoading } = useAction(generateAiBoardReport, {
    onSuccess: (data) => {
      setReport(data);
      setReportRange(range);
      setGeneratedAt(new Date());
      setPanelError("");
    },
    onError: (error) => {
      setPanelError(error);
      toast.error(error);
    },
  });

  const handleGenerate = () => {
    setPanelError("");
    execute({
      boardId,
      range,
    });
  };

  const handleCopy = async () => {
    if (!report) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(formatReportMarkdown(report, reportRange));
      return true;
    } catch {
      toast.error(tr("analytics.ai.copyError"));
      return false;
    }
  };

  return (
    <ChartPanel
      title={tr("analytics.ai.panelTitle")}
      description={tr("analytics.ai.panelDesc")}
      icon={Sparkles}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <RangeToggle value={range} onChange={setRange} disabled={isLoading} />
          <motion.button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            initial={{ transform: "scale(1)" }}
            whileTap={{ transform: reduce ? "scale(1)" : `scale(${scale.press})` }}
            transition={pressSpring}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-700 px-4 text-xs font-semibold text-white shadow-sm transition-shadow hover:shadow-md disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isLoading
              ? tr("analytics.ai.generatingButton")
              : report
                ? tr("analytics.ai.regenerateButton")
                : tr("analytics.ai.generateButton")}
          </motion.button>
        </div>
      }
    >
      {isLoading ? (
        <ReportSkeleton />
      ) : (
        <div className="space-y-4">
          {panelError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {panelError}
            </div>
          )}

          {!report && !panelError && <EmptyReport />}

          {report && (
            // Keyed so a regenerated report comes in again: fade, 8px rise, out of a light blur.
            <Effect key={generatedAt?.getTime()} fade slide={{ offset: 8 }} blur={{ initialBlur: 4 }} className="space-y-4">
              <section className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white p-5">
                <Sparkles aria-hidden className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 text-violet-100" />
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      {tr("analytics.ai.overviewBadge", { range: getReportRangeLabel(reportRange) })}
                    </span>
                    {generatedAt && (
                      <span className="text-xs text-neutral-500">
                        {tr("analytics.ai.generatedAt", {
                          time: intlDateFormat({ hour: "2-digit", minute: "2-digit" }).format(generatedAt),
                        })}
                      </span>
                    )}
                  </div>
                  <CopyButton onCopy={handleCopy} />
                </div>
                <p className="relative mt-3 max-w-4xl text-[15px] leading-7 text-neutral-800">
                  {report.summary}
                </p>

                {report.metrics.length > 0 && (
                  <dl className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
                    {report.metrics.map((metric) => (
                      <div key={`${metric.label}-${metric.value}`} className="rounded-xl border border-white bg-white/80 px-3 py-2.5 shadow-xs backdrop-blur-sm">
                        <dt className="text-xs text-neutral-500">{metric.label}</dt>
                        <dd className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">{metric.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>

              <div className="grid gap-3 lg:grid-cols-3">
                <ReportBullets
                  title={tr("analytics.ai.sectionCompleted")}
                  items={report.completed}
                  tone="success"
                  icon={CheckCircle2}
                  emptyLabel={tr("analytics.ai.emptyCompleted")}
                />
                <ReportBullets
                  title={tr("analytics.ai.sectionRisks")}
                  items={report.risks}
                  tone="danger"
                  icon={AlertTriangle}
                  emptyLabel={tr("analytics.ai.emptyRisks")}
                />
                <ReportBullets
                  title={tr("analytics.ai.sectionActions")}
                  items={report.actions}
                  tone="accent"
                  icon={Lightbulb}
                  emptyLabel={tr("analytics.ai.emptyActions")}
                  numbered
                />
              </div>
            </Effect>
          )}
        </div>
      )}
    </ChartPanel>
  );
};
