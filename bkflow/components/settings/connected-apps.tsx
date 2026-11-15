"use client";

import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConnectedApps, useConnectorCatalog } from "@/hooks/use-connected-apps";
import { useSettingsModal } from "@/hooks/use-settings-modal";
import { tr } from "@/lib/i18n";
import { filterCatalog, type CatalogFilter, type ConnectorCatalogItem } from "@/lib/connectors/catalog-shared";
import type { ExtraMessageKey } from "@/lib/i18n/messages/vi-extra";

const PAGE = 24;

/** App có adapter đọc: mô tả bản địa + màu logo; vẫn hiện khi danh mục lỗi nhưng inventory tải được. */
const SUPPORTED: Record<string, { name: string; descKey: ExtraMessageKey; color: string }> = {
  gmail: { name: "Gmail", descKey: "apps.gmail.desc", color: "#EA4335" },
  slack: { name: "Slack", descKey: "apps.slack.desc", color: "#4A154B" },
};

const send = (method: "POST" | "DELETE", app: string) =>
  fetch("/api/connectors", { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ app }) });

const Logo = ({ item }: { item: ConnectorCatalogItem }) => {
  const local = SUPPORTED[item.slug] ? `/${item.slug}.svg` : null;
  const [failed, setFailed] = useState(false);
  const src = local ?? item.logoUrl;
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-white text-sm font-bold text-white"
      style={failed || !src ? { backgroundColor: SUPPORTED[item.slug]?.color ?? "#64748b" } : undefined}
      aria-hidden="true"
    >
      {failed || !src
        ? item.name[0]?.toUpperCase()
        : <img src={src} alt="" loading="lazy" className="size-6 object-contain" onError={() => setFailed(true)} />}
    </span>
  );
};

export const ConnectedApps = () => {
  const inventory = useConnectedApps();
  const catalog = useConnectorCatalog();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  // Chặn double-click trước khi state kịp cập nhật: tránh mở hai tab OAuth.
  const busyRef = useRef<string | null>(null);

  const apps = inventory.data?.apps;
  const configured = inventory.data?.configured ?? true;
  const isConnected = (slug: string) => apps?.[slug] === true;

  const items = useMemo<ConnectorCatalogItem[]>(() => {
    if (catalog.data) return catalog.data.items;
    // Danh mục chưa có/lỗi: chỉ hiện các app có adapter để không mất trạng thái đã kết nối.
    return Object.entries(SUPPORTED).map(([slug, app]) => ({
      slug, name: app.name, description: "", logoUrl: null, taskReadSupported: true,
    }));
  }, [catalog.data]);

  const visible = filterCatalog(items, { query, filter, isConnected });

  const start = (slug: string) => {
    if (busyRef.current) return false;
    busyRef.current = slug;
    setBusy(slug);
    return true;
  };
  const finish = () => {
    busyRef.current = null;
    setBusy(null);
  };

  const connect = async (slug: string) => {
    if (!start(slug)) return;
    // Mở tab ngay trong lúc bấm để trình duyệt không chặn popup; có link rồi mới chuyển hướng.
    const tab = window.open("", "_blank");
    try {
      const res = await send("POST", slug);
      if (!res.ok) throw new Error(String(res.status));
      const { url } = (await res.json()) as { url: string };
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch {
      tab?.close();
      toast.error(tr("apps.connectError"));
    } finally {
      finish();
    }
  };

  const disconnect = async (slug: string) => {
    if (!start(slug)) return;
    try {
      const res = await send("DELETE", slug);
      if (!res.ok) throw new Error(String(res.status));
      toast.info(tr("channels.disconnectedToast"));
      await inventory.refetch();
    } catch {
      toast.error(tr("channels.disconnectErrorToast"));
    } finally {
      finish();
    }
  };

  const openAssistant = () => {
    // Đóng hộp thoại trước để không che trang đích.
    useSettingsModal.getState().onClose();
    navigate("/assistant");
  };

  const action = (item: ConnectorCatalogItem) => {
    if (!item.taskReadSupported) {
      return <span className="shrink-0 text-[11px] text-muted-foreground">{tr("apps.unsupported")}</span>;
    }
    if (busy === item.slug || inventory.isPending) {
      return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label={tr("channels.loadingAria")} />;
    }
    if (inventory.isError || !apps || !(item.slug in apps)) {
      return <span className="shrink-0 text-[11px] text-muted-foreground">{tr("apps.statusUnknown")}</span>;
    }
    if (isConnected(item.slug)) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0 cursor-pointer" aria-label={tr("apps.moreActions", { name: item.name })}>
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={openAssistant}>{tr("apps.openAssistant")}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => void disconnect(item.slug)}>{tr("channels.disconnect")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    if (!configured) return null;
    return (
      <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void connect(item.slug)} className="h-8 shrink-0 cursor-pointer text-xs">
        {tr("channels.connect")}
      </Button>
    );
  };

  const retry = (refetch: () => unknown) => (
    <button type="button" onClick={() => void refetch()} className="cursor-pointer text-primary hover:underline">{tr("channels.retry")}</button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setLimit(PAGE); }}
            placeholder={tr("apps.searchPlaceholder")}
            aria-label={tr("apps.searchPlaceholder")}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div role="radiogroup" aria-label={tr("apps.filterLabel")} className="flex rounded-lg border border-border/60 p-0.5 text-xs">
          {(["all", "connected"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              onClick={() => { setFilter(value); setLimit(PAGE); }}
              className={`cursor-pointer rounded-md px-2.5 py-1 ${filter === value ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tr(value === "all" ? "apps.filterAll" : "apps.filterConnected")}
            </button>
          ))}
        </div>
      </div>

      {inventory.isError && <p className="text-xs text-muted-foreground">{tr("apps.loadError")} {retry(inventory.refetch)}</p>}
      {inventory.data && !inventory.data.configured && <p className="text-xs text-muted-foreground">{tr("apps.unconfigured")}</p>}
      {catalog.isError && <p className="text-[11px] text-muted-foreground">{tr("apps.catalogError")} {retry(catalog.refetch)}</p>}
      {catalog.data && !catalog.data.complete && <p className="text-[11px] text-muted-foreground">{tr("apps.catalogPartial")}</p>}

      {visible.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {query.trim() ? tr("apps.noResults") : tr("apps.noneConnected")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.slice(0, limit).map((item) => (
            <li key={item.slug} className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex items-start gap-3">
                <Logo item={item} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                    {isConnected(item.slug) && (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        {tr("channels.connectedBadge")}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {SUPPORTED[item.slug] ? tr(SUPPORTED[item.slug].descKey) : item.description}
                  </p>
                </div>
                {action(item)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {visible.length > limit && (
        <div className="flex justify-center">
          <Button type="button" size="sm" variant="ghost" onClick={() => setLimit((n) => n + PAGE)} className="cursor-pointer text-xs">
            {tr("apps.showMore")}
          </Button>
        </div>
      )}
    </div>
  );
};
