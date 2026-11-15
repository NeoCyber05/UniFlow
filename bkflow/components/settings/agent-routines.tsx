"use client";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSettingsModal } from "@/hooks/use-settings-modal";
import { tr, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Routine = { id: string; title: string; prompt: string; minuteOfDay: number; weekdays: number[]; enabled: boolean; nextRunAt: string | null };

// Thứ Hai trước, Chủ Nhật cuối (0 = Chủ Nhật theo server).
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const pad = (value: number) => String(value).padStart(2, "0");
const timeOf = (minuteOfDay: number) => `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
// 15/11/2026 là Chủ Nhật: lấy tên thứ theo ngôn ngữ đang dùng, không cần thêm khóa dịch.
const dayName = (day: number, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 15 + day)));

const send = (method: "PATCH" | "DELETE", body: unknown) =>
  fetch("/api/routines", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/**
 * Lời nhắc đã đặt: chỉ xem / bật tắt / xóa. Lời nhắc mới do Trợ lý đặt (scheduleReminder);
 * lịch lặp tạo từ trước vẫn hiện đủ để người dùng quản lý.
 */
export const AgentRoutines = () => {
  const locale = useLocale((state) => state.locale);
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["routines"],
    queryFn: async (): Promise<Routine[]> => {
      const res = await fetch("/api/routines");
      if (!res.ok) throw new Error(String(res.status));
      return ((await res.json()) as { routines: Routine[] }).routines;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => query.state.data?.some((routine) => routine.enabled && routine.weekdays.length === 0) ? 60_000 : false,
  });

  const mutate = async (method: "PATCH" | "DELETE", body: unknown) => {
    const res = await send(method, body).catch(() => null);
    if (!res?.ok) toast.error(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? tr("routines.saveError"));
    await query.refetch();
  };

  const openAssistant = () => {
    useSettingsModal.getState().onClose();
    navigate("/assistant");
  };

  if (query.isError) {
    return (
      <p className="text-xs text-muted-foreground">
        {tr("routines.loadError")}{" "}
        <button type="button" onClick={() => void query.refetch()} className="cursor-pointer text-primary hover:underline">{tr("channels.retry")}</button>
      </p>
    );
  }

  const routines = query.data;

  return (
    <div className="space-y-3">
      {routines === undefined ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={tr("channels.loadingAria")} />
      ) : routines.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr("routines.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {routines.map((routine) => {
            const once = routine.weekdays.length === 0;
            const expired = !routine.nextRunAt || new Date(routine.nextRunAt).getTime() <= query.dataUpdatedAt;
            const status = !once ? tr("routines.recurringLegacy")
              : routine.enabled ? tr("routines.statusPending")
              : expired ? tr("routines.statusDone") : tr("routines.statusOff");
            const when = once
              ? routine.nextRunAt ? new Date(routine.nextRunAt).toLocaleString(locale) : tr("routines.once")
              : `${timeOf(routine.minuteOfDay)} · ${DAYS.filter((day) => routine.weekdays.includes(day)).map((day) => dayName(day, locale)).join(", ")}`;
            return (
              <li key={routine.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                <input
                  type="checkbox"
                  role="switch"
                  checked={routine.enabled}
                  // Lời nhắc một lần đã qua giờ không bật lại được.
                  disabled={!routine.enabled && once && expired}
                  onChange={(event) => void mutate("PATCH", { id: routine.id, enabled: event.target.checked })}
                  aria-label={tr("routines.toggle", { title: routine.title })}
                  className="size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold text-foreground", !routine.enabled && "text-muted-foreground")}>{routine.title}</p>
                  <p className="text-[11px] text-muted-foreground">{when} · {status}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void mutate("DELETE", { id: routine.id })}
                  aria-label={tr("routines.delete", { title: routine.title })}
                  className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Button type="button" size="sm" variant="outline" onClick={openAssistant} className="h-8 cursor-pointer text-xs">
        {tr("apps.openAssistant")}
      </Button>
    </div>
  );
};
