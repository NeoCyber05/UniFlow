"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlarmClock,
  Bell,
  Download,
  Info,
  Keyboard,
  Laptop,
  Languages,
  Check,
  Palette,
  Play,
  PlugZap,
  Settings,
  Volume2,
  VolumeX,
  User,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppearancePanel } from "./appearance-panel";
import { NotificationChannels } from "./notification-channels";
import { useAppearance } from "@/components/providers/appearance-provider";
import { useSettingsModal, type SettingsTab } from "@/hooks/use-settings-modal";
import { useUser } from "@/web/lib/auth";
import { LOCALES, tr, useLocale } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages/vi";
import {
  getDesktopReminderState,
  enableDesktopReminders,
  disableDesktopReminders,
  type DesktopReminderState,
} from "@/web/lib/desktop-notifications";
import {
  getDefaultReminder,
  isSoundEnabled,
  playChime,
  setDefaultReminder,
  setSoundEnabled as saveSoundEnabled,
} from "@/web/lib/local-prefs";

const LEAD_OPTIONS: { value: string; labelKey: MessageKey }[] = [
  { value: "none", labelKey: "settings.lead.none" },
  { value: "15", labelKey: "settings.lead.m15" },
  { value: "60", labelKey: "settings.lead.h1" },
  { value: "1440", labelKey: "settings.lead.d1" },
  { value: "2880", labelKey: "settings.lead.d2" },
];

const TABS: { id: SettingsTab; labelKey: MessageKey; icon: typeof Palette }[] = [
  { id: "appearance", labelKey: "settings.tab.appearance", icon: Palette },
  { id: "notifications", labelKey: "settings.tab.notifications", icon: Bell },
  { id: "shortcuts", labelKey: "settings.tab.shortcuts", icon: Keyboard },
  { id: "language", labelKey: "settings.tab.language", icon: Languages },
  { id: "account", labelKey: "settings.tab.account", icon: User },
];

export const SettingsDialog = () => {
  const { isOpen, activeTab, onClose, setTab } = useSettingsModal();
  const appearance = useAppearance();
  const { user } = useUser();
  const { locale, setLocale } = useLocale();

  // Desktop notification state
  const [reminderState, setReminderState] = useState<DesktopReminderState | null>(null);
  const [busyReminder, setBusyReminder] = useState(false);

  // Tùy chọn theo thiết bị; nơi đọc: notification-toasts (âm thanh), card-date-popover (nhắc mặc định), start-screen-setting (màn hình khởi động).
  const [soundEnabled, setSoundEnabled] = useState(isSoundEnabled);
  const [reminderAdvance, setReminderAdvance] = useState(getDefaultReminder);

  const refreshNotificationState = useCallback(() => {
    getDesktopReminderState().then(setReminderState, () => setReminderState("unsupported"));
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshNotificationState();
    }
  }, [isOpen, refreshNotificationState]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    saveSoundEnabled(next);
    if (next) playChime();
    toast.success(next ? tr("settings.toast.soundOn") : tr("settings.toast.soundOff"));
  };

  const handleReminderAdvanceChange = (value: string) => {
    setReminderAdvance(value);
    setDefaultReminder(value);
    toast.success(tr("settings.toast.leadUpdated"));
  };

  const toggleDesktopPush = async () => {
    setBusyReminder(true);
    try {
      if (reminderState === "enabled") {
        await disableDesktopReminders();
        toast.info(tr("settings.toast.pushOff"));
      } else {
        const result = await enableDesktopReminders();
        if (result.state === "enabled") {
          toast.success(tr("settings.toast.pushOn"));
        } else if (result.state === "denied") {
          toast.error(tr("settings.toast.pushBlocked"));
        } else {
          toast.error(tr("settings.toast.pushConnectFail"));
        }
      }
    } catch {
      toast.error(tr("settings.toast.pushError"));
    } finally {
      setBusyReminder(false);
      refreshNotificationState();
    }
  };

  const handleExportData = () => {
    try {
      const exportObject = {
        app: "UniFlow",
        version: "2.4.0",
        exportedAt: new Date().toISOString(),
        user: {
          id: user?.id,
          name: user?.fullName,
          email: user?.primaryEmailAddress?.emailAddress,
        },
        appearance: {
          accent: appearance.accent,
          background: appearance.background,
          pageStyle: appearance.pageStyle,
        },
        preferences: {
          defaultReminder: reminderAdvance,
          soundEnabled,
        },
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `uniflow-backup-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success(tr("settings.toast.exportOk"));
    } catch {
      toast.error(tr("settings.toast.exportFail"));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] sm:max-h-[85vh] w-[95vw] sm:max-w-4xl p-0 overflow-hidden flex flex-col bg-background border-border/80 shadow-2xl">
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white shadow-xs">
              <Settings aria-hidden="true" className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">{tr("settings.title")}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {tr("settings.description")}
              </DialogDescription>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1 -mb-1 no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                    isActive
                      ? "text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {tr(tab.labelKey)}
                  {isActive && (
                    <motion.div
                      layoutId="settings-active-tab"
                      className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20 -z-10"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Tab Body */}
        {/* relative: giữ input sr-only (radio chủ đề) trong vùng cuộn, tránh focus làm cuộn cả hộp thoại */}
        <div className="relative min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === "appearance" && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <AppearancePanel />
              </motion.div>
            )}

            {activeTab === "notifications" && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Push Notification Panel */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Laptop className="size-4 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">
                          {tr("settings.push.title")}
                        </h4>
                        {reminderState === "enabled" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            {tr("settings.push.active")}
                          </Badge>
                        ) : reminderState === "denied" ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                            {tr("settings.push.blocked")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                            {tr("settings.push.off")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {tr("settings.push.desc")}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant={reminderState === "enabled" ? "outline" : "default"}
                      size="sm"
                      disabled={busyReminder || reminderState === "unsupported"}
                      onClick={toggleDesktopPush}
                      className="shrink-0 cursor-pointer"
                    >
                      {busyReminder
                        ? tr("settings.common.processing")
                        : reminderState === "enabled"
                        ? tr("settings.push.disable")
                        : tr("settings.push.enable")}
                    </Button>
                  </div>

                  {reminderState === "denied" && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2">
                      <Info className="size-4 shrink-0 mt-0.5" />
                      <span>
                        {tr("settings.push.blockedHelp")}
                      </span>
                    </div>
                  )}
                </div>

                {/* External integrations */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <PlugZap className="size-4 text-primary" aria-hidden="true" />
                      {tr("settings.channels.title")}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{tr("settings.channels.desc")}</p>
                  </div>
                  <NotificationChannels />
                </div>

                {/* Default reminder lead */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <AlarmClock className="size-4 text-primary" aria-hidden="true" />
                      {tr("settings.lead.title")}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{tr("settings.lead.desc")}</p>
                  </div>

                  <div role="radiogroup" aria-label={tr("settings.lead.title")} className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {LEAD_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={reminderAdvance === opt.value}
                        onClick={() => handleReminderAdvanceChange(opt.value)}
                        className={`rounded-xl border p-2.5 text-xs font-medium transition-all cursor-pointer ${
                          reminderAdvance === opt.value
                            ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                            : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        {tr(opt.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sound alert */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      {soundEnabled ? (
                        <Volume2 className="size-4 text-primary" />
                      ) : (
                        <VolumeX className="size-4 text-muted-foreground" />
                      )}
                      {tr("settings.sound.title")}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {tr("settings.sound.desc")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={playChime}
                      className="flex items-center gap-1.5 cursor-pointer text-xs"
                      title={tr("settings.sound.previewTitle")}
                    >
                      <Play className="size-3 text-primary" />
                      {tr("settings.sound.preview")}
                    </Button>
                    <Button
                      type="button"
                      variant={soundEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={toggleSound}
                      className="cursor-pointer text-xs"
                    >
                      {soundEnabled ? tr("settings.common.on") : tr("settings.common.off")}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "shortcuts" && (
              <motion.div
                key="shortcuts"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Keyboard Shortcuts Table */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Keyboard className="size-4 text-primary" />
                    {tr("settings.shortcuts.title")}
                  </h4>
                  <div className="divide-y divide-border/50 text-xs">
                    {[
                      { key: "⌘ / Ctrl + K", desc: tr("settings.shortcuts.search") },
                      { key: "⌘ / Ctrl + B", desc: tr("settings.shortcuts.sidebar") },
                      { key: "T", desc: tr("settings.shortcuts.today") },
                      { key: "L", desc: tr("settings.shortcuts.calendar") },
                      { key: "N", desc: tr("settings.shortcuts.newTask") },
                      { key: "Esc", desc: tr("settings.shortcuts.close") },
                    ].map((sc) => (
                      <div key={sc.key} className="py-2.5 flex items-center justify-between">
                        <span className="text-muted-foreground">{sc.desc}</span>
                        <kbd className="rounded-md border border-border/80 bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-2xs">
                          {sc.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Capture Extension Guide */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-amber-500" />
                    <h4 className="text-sm font-semibold text-foreground">
                      {tr("settings.capture.title")}
                    </h4>
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Chrome Extension
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tr("settings.capture.p1")} <strong>Microsoft Teams</strong>, <strong>BK E-learning</strong>, {tr("settings.capture.or")} <strong>Messenger</strong>{tr("settings.capture.p2")}
                  </p>
                  <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                    💡 {tr("settings.capture.folder1")} <code className="font-mono text-primary">extensions/uniflow-capture</code> {tr("settings.capture.folder2")}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "language" && (
              <motion.div
                key="language"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Languages className="size-4 text-primary" />
                      {tr("settings.language.title")}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tr("settings.language.description")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {LOCALES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setLocale(item.id);
                          toast.success(tr("settings.language.saved"));
                        }}
                        className={`flex items-center justify-between rounded-xl border p-3 text-sm font-medium transition-all cursor-pointer ${
                          locale === item.id
                            ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                            : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        {item.label}
                        {locale === item.id && <Check className="size-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "account" && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Account Profile Card */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs flex items-center gap-4">
                  <div className="size-14 rounded-full overflow-hidden bg-violet-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {user?.imageUrl ? (
                      <img src={user.imageUrl} alt={user.fullName || "Avatar"} className="size-full object-cover" />
                    ) : (
                      user?.fullName?.[0]?.toUpperCase() || "U"
                    )}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground truncate">
                      {user?.fullName || tr("settings.account.fallbackName")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.primaryEmailAddress?.emailAddress || tr("settings.account.noEmail")}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-500/30">
                        {tr("settings.account.badge")}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{tr("settings.account.cloudSync")}</span>
                    </div>
                  </div>
                </div>

                {/* Data Backup & Export */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Download className="size-4 text-primary" />
                    {tr("settings.backup.title")}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tr("settings.backup.desc")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportData}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    {tr("settings.backup.button")}
                  </Button>
                </div>

                {/* App Version Info */}
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center text-xs text-muted-foreground">
                  {tr("settings.footer.version")}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};
