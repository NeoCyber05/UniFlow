"use client";

import { AlertTriangle, CalendarClock, ChevronRight, ImagePlus, type LucideIcon, Search, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import { AiLogo } from "@/components/ai-assistant/ai-logo";
import { intlDateFormat, tr } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages/vi";
import { cn } from "@/lib/utils";
import { useView } from "@/web/lib/use-view";

import type { AssistantBoard, AssistantHomeView } from "./api";
import { Composer, type ComposerSubmit } from "./composer";
import { ScopeSelect } from "./scope-select";

const SUGGESTIONS: { icon: LucideIcon; category: MessageKey; example: MessageKey }[] = [
  { icon: Search, category: "assistant.home.cat.lookup", example: "assistant.home.ex.lookup" },
  { icon: CalendarClock, category: "assistant.home.cat.plan", example: "assistant.home.ex.plan" },
  { icon: ImagePlus, category: "assistant.home.cat.import", example: "assistant.home.ex.import" },
  { icon: TrendingUp, category: "assistant.home.cat.chart", example: "assistant.home.ex.chart" },
];

const greetingKey = (hour: number): MessageKey =>
  hour < 11 ? "assistant.home.morning" : hour < 14 ? "assistant.home.noon" : hour < 18 ? "assistant.home.afternoon" : "assistant.home.evening";

const formatTime = (iso: string) => intlDateFormat({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const daysLate = (iso: string, now: Date) => Math.max(1, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));

const SummaryRow = ({ dot, icon: Icon, title, detail, detailClass, onClick }: {
  dot?: string; icon?: LucideIcon; title: string; detail?: string; detailClass?: string; onClick: () => void;
}) => (
  <li>
    <button type="button" onClick={onClick}
      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
      {Icon ? <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", detailClass)} /> : <span aria-hidden="true" className={cn("ml-0.5 size-2 shrink-0 rounded-full", dot)} />}
      <span className="flex min-w-0 flex-1 flex-col gap-x-3 sm:flex-row sm:items-baseline">
        <span className="shrink-0 text-sm font-semibold">{title}</span>
        {detail ? <span className={cn("min-w-0 truncate text-xs text-muted-foreground", detailClass)}>{detail}</span> : null}
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  </li>
);

/** Màn chào của cuộc trò chuyện mới: lời chào theo buổi, "Hôm nay của bạn", ô nhập có phạm vi và 4 nhóm gợi ý. */
export const AssistantHome = ({ boards, boardId, onBoardChange, enabled, busy, onSubmit, initialInput = "" }: {
  boards: AssistantBoard[];
  boardId: string | null;
  onBoardChange: (boardId: string) => void;
  enabled: boolean;
  busy: boolean;
  onSubmit: (input: ComposerSubmit) => void;
  initialInput?: string;
}) => {
  const [input, setInput] = useState(initialInput);
  const now = useMemo(() => new Date(), []);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const { data: summary, isError } = useView<AssistantHomeView>(`/assistant/home?tz=${encodeURIComponent(timeZone)}`);
  const fill = (text: string) => {
    setInput(text);
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("[data-assistant-composer]")?.focus());
  };
  const home = summary && "dueToday" in summary ? summary : null;
  const doneDiff = home ? home.done.thisWeek - home.done.lastWeek : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex items-center gap-3">
        <AiLogo className="size-10" />
        <div>
          <p className="text-sm text-muted-foreground">{intlDateFormat({ weekday: "long", day: "numeric", month: "long" }).format(now)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{tr(greetingKey(now.getHours()))}</h1>
        </div>
      </header>

      <section aria-labelledby="assistant-today" className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <h2 id="assistant-today" className="text-sm font-semibold">{tr("assistant.home.todayTitle")}</h2>
          {home ? <span className="text-xs tabular-nums text-muted-foreground">{tr("assistant.home.updatedAt", { time: formatTime(home.now) })}</span> : null}
        </div>
        {home ? (
          <ul className="divide-y">
            <SummaryRow
              dot={home.dueToday.count ? "bg-amber-500" : "bg-muted-foreground/40"}
              title={home.dueToday.count ? tr("assistant.home.dueToday", { count: home.dueToday.count }) : tr("assistant.home.dueTodayNone")}
              detail={home.dueToday.first ? tr("assistant.home.earliest", { time: formatTime(home.dueToday.first.dueAt), title: home.dueToday.first.title }) : undefined}
              onClick={() => fill(tr("assistant.home.ask.today"))}
            />
            <SummaryRow
              dot={home.overdue.count ? "bg-rose-500" : "bg-muted-foreground/40"}
              title={home.overdue.count ? tr("assistant.home.overdue", { count: home.overdue.count }) : tr("assistant.home.overdueNone")}
              detail={home.overdue.first ? tr("assistant.home.lateBy", { title: home.overdue.first.title, days: daysLate(home.overdue.first.dueAt, now) }) : undefined}
              detailClass={home.overdue.count ? "text-rose-600 dark:text-rose-400" : undefined}
              onClick={() => fill(tr("assistant.home.ask.overdue"))}
            />
            <SummaryRow
              icon={doneDiff > 0 ? TrendingUp : doneDiff < 0 ? TrendingDown : Trophy}
              title={tr("assistant.home.doneWeek", { count: home.done.thisWeek })}
              detail={doneDiff > 0 ? tr("assistant.home.doneMore", { count: doneDiff }) : doneDiff < 0 ? tr("assistant.home.doneLess", { count: -doneDiff }) : tr("assistant.home.doneSame")}
              detailClass={doneDiff > 0 ? "text-emerald-700 dark:text-emerald-400" : doneDiff < 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}
              onClick={() => fill(tr("assistant.home.ask.week"))}
            />
          </ul>
        ) : isError ? (
          <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground"><AlertTriangle className="size-4" />{tr("assistant.home.loadError")}</p>
        ) : (
          <div className="space-y-px" aria-hidden="true">
            {[0, 1, 2].map((index) => <div key={index} className="h-11 animate-pulse bg-muted/50" />)}
          </div>
        )}
      </section>

      {!enabled ? <p role="status" className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">{tr("aiAssistant.missingApiKey")}</p> : null}

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={onSubmit}
        busy={busy}
        disabled={!enabled}
        size="large"
        autoFocus
        footer={<ScopeSelect boards={boards} value={boardId} onChange={onBoardChange} disabled={busy} />}
      />

      <section aria-label={tr("assistant.home.suggestions")} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {SUGGESTIONS.map(({ icon: Icon, category, example }) => (
          <button key={category} type="button" disabled={!enabled} onClick={() => fill(tr(example))}
            className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-500/5 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              <Icon aria-hidden="true" className="size-3.5" />{tr(category)}
            </span>
            <span className="text-sm leading-snug text-foreground/90">{tr(example)}</span>
          </button>
        ))}
      </section>
    </div>
  );
};
