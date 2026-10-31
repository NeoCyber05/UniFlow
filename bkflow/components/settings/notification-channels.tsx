"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tr } from "@/lib/i18n";
import type { ExtraMessageKey } from "@/lib/i18n/messages/vi-extra";
import { cn } from "@/lib/utils";

type ChannelId = "telegram" | "slack" | "teams" | "discord";
type Connected = { id: string; channel: ChannelId; label: string };
type ChannelsResponse = { channels: Connected[]; telegramLink: string | null };

// Logo đặt ở public/<id>.svg; thiếu file thì hiện chữ cái đầu trên nền màu thương hiệu.
const APPS: { id: ChannelId; name: string; descKey: ExtraMessageKey; color: string; help?: string }[] = [
  { id: "telegram", name: "Telegram", descKey: "channels.telegram.desc", color: "#229ED9" },
  {
    id: "slack", name: "Slack", descKey: "channels.slack.desc", color: "#4A154B",
    help: "https://api.slack.com/messaging/webhooks",
  },
  {
    id: "teams", name: "Microsoft Teams", descKey: "channels.teams.desc", color: "#5059C9",
    help: "https://support.microsoft.com/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498",
  },
  {
    id: "discord", name: "Discord", descKey: "channels.discord.desc", color: "#5865F2",
    help: "https://support.discord.com/hc/articles/228383668",
  },
];

const AppLogo = ({ id, name, color }: { id: ChannelId; name: string; color: string }) => {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-white text-sm font-bold text-white"
      style={failed ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    >
      {failed ? name[0] : <img src={`/${id}.svg`} alt="" className="size-6 object-contain" onError={() => setFailed(true)} />}
    </span>
  );
};

const WebhookForm = ({ channel, help, onDone }: { channel: ChannelId; help?: string; onDone: () => void }) => {
  const inputId = useId();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/notification-channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, url }),
      });
      if (!res.ok) {
        setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? tr("channels.connectError"));
        return;
      }
      toast.success(tr("channels.connectedToast"));
      onDone();
    } catch {
      setError(tr("channels.connectErrorRetry"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 pt-3">
      <label htmlFor={inputId} className="text-xs font-medium text-foreground">{tr("channels.webhookUrlLabel")}</label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="url"
          required
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="h-9 text-xs"
        />
        <Button type="submit" size="sm" disabled={busy || !url} className="h-9 shrink-0 cursor-pointer">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-label={tr("channels.connectingAria")} /> : tr("channels.save")}
        </Button>
      </div>
      {error && <p id={`${inputId}-error`} role="alert" className="text-[11px] text-destructive">{error}</p>}
      {help && (
        <a href={help} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
          {tr("channels.howToGetWebhook")} <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      )}
    </form>
  );
};

export const NotificationChannels = () => {
  const query = useQuery({
    queryKey: ["notification-channels"],
    queryFn: async (): Promise<ChannelsResponse> => {
      const res = await fetch("/api/notification-channels");
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    staleTime: 0,
  });
  const data = query.data ?? null;
  const failed = query.isError;
  const refresh = query.refetch;
  const [open, setOpen] = useState<ChannelId | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const disconnect = async (row: Connected) => {
    setRemoving(row.id);
    try {
      const res = await fetch("/api/notification-channels", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.info(tr("channels.disconnectedToast"));
      await refresh();
    } catch {
      toast.error(tr("channels.disconnectErrorToast"));
    } finally {
      setRemoving(null);
    }
  };

  if (failed) {
    return (
      <p className="text-xs text-muted-foreground">
        {tr("channels.loadError")}{" "}
        <button type="button" onClick={() => void refresh()} className="cursor-pointer text-primary hover:underline">{tr("channels.retry")}</button>
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {APPS.map((app) => {
        const rows = data?.channels.filter((row) => row.channel === app.id) ?? [];
        const isTelegram = app.id === "telegram";
        const unavailable = isTelegram && data !== null && !data.telegramLink;

        return (
          <div key={app.id} className={cn("rounded-xl border border-border/60 bg-muted/20 p-3", open === app.id && "sm:col-span-2")}>
            <div className="flex items-start gap-3">
              <AppLogo id={app.id} name={app.name} color={app.color} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{app.name}</p>
                  {rows.length > 0 && (
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      {tr("channels.connectedBadge")}
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {unavailable ? tr("channels.telegramUnconfigured") : tr(app.descKey)}
                </p>
              </div>
              {data === null ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label={tr("channels.loadingAria")} />
              ) : isTelegram ? (
                data.telegramLink && (
                  <Button asChild size="sm" variant="outline" className="h-8 shrink-0 text-xs">
                    <a href={data.telegramLink} target="_blank" rel="noreferrer" onClick={() => setOpen("telegram")}>
                      {rows.length ? tr("channels.addChat") : tr("channels.connect")}
                    </a>
                  </Button>
                )
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setOpen(open === app.id ? null : app.id)}
                  aria-expanded={open === app.id}
                  className="h-8 shrink-0 cursor-pointer text-xs"
                >
                  {open === app.id ? tr("channels.cancel") : rows.length ? tr("channels.addChannel") : tr("channels.connect")}
                </Button>
              )}
            </div>

            {rows.length > 0 && (
              <ul className="mt-2 space-y-1">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 rounded-lg bg-background/70 px-2.5 py-1.5 text-[11px]">
                    <span className="truncate font-mono text-muted-foreground">{row.label}</span>
                    <button
                      type="button"
                      onClick={() => void disconnect(row)}
                      disabled={removing === row.id}
                      className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                    >
                      {removing === row.id ? tr("channels.removing") : tr("channels.disconnect")}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {open === app.id && isTelegram && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-background/70 p-2.5 text-[11px] text-muted-foreground">
                <span>{tr("channels.telegramInstructionPrefix")}<strong>Start</strong>{tr("channels.telegramInstructionSuffix")}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => void refresh()} className="h-7 shrink-0 cursor-pointer gap-1 text-xs">
                  <RefreshCw className="size-3" aria-hidden="true" /> {tr("channels.check")}
                </Button>
              </div>
            )}
            {open === app.id && !isTelegram && (
              <WebhookForm channel={app.id} help={app.help} onDone={() => { setOpen(null); void refresh(); }} />
            )}
          </div>
        );
      })}
    </div>
  );
};
