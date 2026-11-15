"use client";

import { AlarmClock, AlertTriangle, ListChecks, type LucideIcon, Mail, NotebookPen, PlugZap } from "lucide-react";
import { useMemo, useState } from "react";

import { useConnectedApps } from "@/hooks/use-connected-apps";
import { useSettingsModal } from "@/hooks/use-settings-modal";
import { homeSourceAction } from "@/lib/ai/assistant/home-action";
import { intlDateFormat, tr } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages/vi";
import { cn } from "@/lib/utils";
import { useView } from "@/web/lib/use-view";

import type { AssistantHomeView } from "./api";
import { Composer, type ComposerSubmit } from "./composer";

const SummaryChip = ({ tone, label, onClick }: { tone: "amber" | "rose" | "muted"; label: string; onClick: () => void }) => (
  <button type="button" onClick={onClick}
    className="glass-row inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium hover:border-primary focus-visible:outline-2 focus-visible:outline-ring">
    <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", tone === "amber" ? "bg-amber-500" : tone === "rose" ? "bg-rose-500" : "bg-muted-foreground/40")} />
    {label}
  </button>
);

/**
 * Màn chào của cuộc trò chuyện mới: một câu hỏi, tóm tắt gọn hôm nay/quá hạn, ô nhập và ba gợi ý.
 * Bấm gợi ý chỉ điền vào ô nhập, không ghi dữ liệu.
 */
export const AssistantHome = ({ enabled, busy, onSubmit, initialInput = "", noDestination = false }: {
  enabled: boolean;
  busy: boolean;
  onSubmit: (input: ComposerSubmit) => void;
  initialInput?: string;
  /** Chưa có bảng đích hợp lệ: không gửi được, hướng dẫn tạo danh sách việc. */
  noDestination?: boolean;
}) => {
  const [input, setInput] = useState(initialInput);
  const now = useMemo(() => new Date(), []);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const { data: summary, isError } = useView<AssistantHomeView>(`/assistant/home?tz=${encodeURIComponent(timeZone)}`);
  const inventory = useConnectedApps();
  const source = homeSourceAction({
    configured: inventory.data?.configured === true,
    gmailConnected: inventory.data?.apps.gmail === true,
    // Đang tải lại hoặc lỗi: không mời đọc Gmail dựa trên cache cũ.
    inventoryReady: inventory.isSuccess && !inventory.isFetching,
  });
  const fill = (text: string) => {
    setInput(text);
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("[data-assistant-composer]")?.focus());
  };
  const home = summary && "dueToday" in summary ? summary : null;
  const canSend = enabled && !noDestination;

  const suggestions: { icon: LucideIcon; label: MessageKey; prompt: MessageKey }[] = [
    { icon: ListChecks, label: "assistant.home.s.today", prompt: "assistant.home.s.todayPrompt" },
    source === "gmail"
      ? { icon: Mail, label: "assistant.home.s.gmail", prompt: "assistant.home.s.gmailPrompt" }
      : { icon: NotebookPen, label: "assistant.home.s.capture", prompt: "assistant.home.s.capturePrompt" },
    { icon: AlarmClock, label: "assistant.home.s.remind", prompt: "assistant.home.s.remindPrompt" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-4 py-10 sm:py-16">
      <header className="space-y-1 text-center">
        <p className="glass-row mx-auto w-fit rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{intlDateFormat({ weekday: "long", day: "numeric", month: "long" }).format(now)}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{tr("assistant.home.heading")}</h1>
      </header>

      <section aria-label={tr("assistant.home.todayTitle")} className="flex min-h-8 flex-wrap justify-center gap-2">
        {home ? (
          <>
            <SummaryChip
              tone={home.dueToday.count ? "amber" : "muted"}
              label={home.dueToday.count ? tr("assistant.home.dueToday", { count: home.dueToday.count }) : tr("assistant.home.dueTodayNone")}
              onClick={() => fill(tr("assistant.home.ask.today"))}
            />
            <SummaryChip
              tone={home.overdue.count ? "rose" : "muted"}
              label={home.overdue.count ? tr("assistant.home.overdue", { count: home.overdue.count }) : tr("assistant.home.overdueNone")}
              onClick={() => fill(tr("assistant.home.ask.overdue"))}
            />
          </>
        ) : isError ? (
          <p className="glass-row flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground"><AlertTriangle aria-hidden="true" className="size-3.5" />{tr("assistant.home.loadError")}</p>
        ) : (
          <div className="flex gap-2" aria-hidden="true">
            {[0, 1].map((index) => <div key={index} className="glass-row h-8 w-36 animate-pulse rounded-full" />)}
          </div>
        )}
      </section>

      {!enabled ? <p role="status" className="w-full max-w-[48rem] rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">{tr("aiAssistant.missingApiKey")}</p> : null}
      {enabled && noDestination ? <p role="status" className="glass-row w-full max-w-[48rem] rounded-xl px-4 py-3 text-sm">{tr("assistant.home.noDestination")}</p> : null}

      <div className="w-full max-w-[48rem]">
        <Composer value={input} onChange={setInput} onSubmit={onSubmit} busy={busy} disabled={!canSend} size="large" autoFocus />
      </div>

      <section aria-label={tr("assistant.home.suggestions")} className="flex w-full max-w-[48rem] flex-wrap justify-center gap-2">
        {suggestions.map(({ icon: Icon, label, prompt }) => (
          <button key={label} type="button" disabled={!canSend} onClick={() => fill(tr(prompt))}
            className="glass-row inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60">
            <Icon aria-hidden="true" className="size-3.5 text-primary" />{tr(label)}
          </button>
        ))}
        {source === "capture" ? (
          <button type="button" onClick={() => useSettingsModal.getState().onOpen("connections")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
            <PlugZap aria-hidden="true" className="size-3.5" />{tr("assistant.home.connectSources")}
          </button>
        ) : null}
      </section>

      <p className="glass-row rounded-full px-2.5 py-0.5 text-center text-[11px] text-muted-foreground">{tr("assistant.composer.reviewNote")}</p>
    </div>
  );
};
