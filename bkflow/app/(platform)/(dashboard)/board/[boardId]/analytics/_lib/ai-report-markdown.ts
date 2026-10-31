import type { AiBoardReport } from "@/actions/ai/generate-ai-board-report/types";
import { tr } from "@/lib/i18n";

import type { ReportRange } from "../_types";

export const getReportRangeLabel = (range: ReportRange): string =>
  range === "7d" ? tr("analytics.range.7d") : tr("analytics.range.30d");

export const formatReportMarkdown = (report: AiBoardReport, range: ReportRange) => {
  const section = (title: string, items: string[]) => [
    `## ${title}`,
    ...items.map((item) => `- ${item}`),
  ].join("\n");

  const rangeLabel = getReportRangeLabel(range);

  return [
    `# ${tr("analytics.markdown.heading", { range: rangeLabel })}`,
    "",
    `## ${tr("analytics.markdown.overview")}`,
    report.summary,
    "",
    section(tr("analytics.markdown.metrics"), report.metrics.map((metric) => `${metric.label}: ${metric.value}`)),
    "",
    section(tr("analytics.ai.sectionCompleted"), report.completed),
    "",
    section(tr("analytics.ai.sectionRisks"), report.risks),
    "",
    section(tr("analytics.ai.sectionActions"), report.actions),
  ].join("\n");
};
