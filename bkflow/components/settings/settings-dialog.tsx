"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  CalendarCheck,
  Clock,
  Download,
  Flame,
  Info,
  Keyboard,
  Laptop,
  Palette,
  Play,
  SlidersHorizontal,
  Target,
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
import { useAppearance } from "@/components/providers/appearance-provider";
import { useSettingsModal, type SettingsTab } from "@/hooks/use-settings-modal";
import { useUser } from "@/web/lib/auth";
import {
  getDesktopReminderState,
  enableDesktopReminders,
  disableDesktopReminders,
  type DesktopReminderState,
} from "@/web/lib/desktop-notifications";

const playChimeSound = () => {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.1);
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.45);
  } catch {
    // audio context blocked or unsupported
  }
};

const TABS: { id: SettingsTab; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Giao diện", icon: Palette },
  { id: "workflow", label: "Kế hoạch & Học tập", icon: CalendarCheck },
  { id: "notifications", label: "Thông báo & Nhắc việc", icon: Bell },
  { id: "shortcuts", label: "Phím tắt & Tiện ích", icon: Keyboard },
  { id: "account", label: "Tài khoản & Dữ liệu", icon: User },
];

export const SettingsDialog = () => {
  const { isOpen, activeTab, onClose, setTab } = useSettingsModal();
  const appearance = useAppearance();
  const { user } = useUser();


  // Desktop notification state
  const [reminderState, setReminderState] = useState<DesktopReminderState | null>(null);
  const [busyReminder, setBusyReminder] = useState(false);

  // Sound toggle (local preference)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("uniflow-sound") !== "disabled";
  });

  // Default reminder advance minutes (local preference)
  const [reminderAdvance, setReminderAdvance] = useState(() => {
    if (typeof window === "undefined") return "60";
    return localStorage.getItem("uniflow-reminder-lead") || "60";
  });

  // Workflow preferences (local preference)
  const [dailyGoal, setDailyGoal] = useState(() => {
    if (typeof window === "undefined") return "5";
    return localStorage.getItem("uniflow-daily-goal") || "5";
  });

  const [autoRollover, setAutoRollover] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("uniflow-auto-rollover") !== "disabled";
  });

  const [startOfWeek, setStartOfWeek] = useState(() => {
    if (typeof window === "undefined") return "monday";
    return localStorage.getItem("uniflow-start-of-week") || "monday";
  });

  const [defaultScreen, setDefaultScreen] = useState(() => {
    if (typeof window === "undefined") return "today";
    return localStorage.getItem("uniflow-default-screen") || "today";
  });

  const [listDensity, setListDensity] = useState(() => {
    if (typeof window === "undefined") return "standard";
    return localStorage.getItem("uniflow-list-density") || "standard";
  });

  // Daily study digest notifications
  const [morningReminder, setMorningReminder] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("uniflow-morning-reminder") !== "disabled";
  });

  const [eveningReminder, setEveningReminder] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("uniflow-evening-reminder") !== "disabled";
  });

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
    localStorage.setItem("uniflow-sound", next ? "enabled" : "disabled");
    if (next) playChimeSound();
    toast.success(next ? "Đã bật âm thanh nhắc việc" : "Đã tắt âm thanh nhắc việc");
  };

  const handleReminderAdvanceChange = (mins: string) => {
    setReminderAdvance(mins);
    localStorage.setItem("uniflow-reminder-lead", mins);
    toast.success("Đã cập nhật thời gian nhắc trước hạn");
  };

  const handleDailyGoalChange = (goal: string) => {
    setDailyGoal(goal);
    localStorage.setItem("uniflow-daily-goal", goal);
    toast.success(`Đã đặt mục tiêu ${goal} việc hoàn thành mỗi ngày`);
  };

  const toggleAutoRollover = () => {
    const next = !autoRollover;
    setAutoRollover(next);
    localStorage.setItem("uniflow-auto-rollover", next ? "enabled" : "disabled");
    toast.success(next ? "Đã bật tự động dời việc quá hạn sang Hôm nay" : "Đã tắt tự động dời việc quá hạn");
  };

  const handleStartOfWeekChange = (val: string) => {
    setStartOfWeek(val);
    localStorage.setItem("uniflow-start-of-week", val);
    toast.success(`Đã đặt ngày đầu tuần là ${val === "monday" ? "Thứ Hai" : "Chủ Nhật"}`);
  };

  const handleDefaultScreenChange = (val: string) => {
    setDefaultScreen(val);
    localStorage.setItem("uniflow-default-screen", val);
    toast.success("Đã lưu màn hình khởi động mặc định");
  };

  const handleListDensityChange = (val: string) => {
    setListDensity(val);
    localStorage.setItem("uniflow-list-density", val);
    toast.success(`Đã chuyển mật độ danh sách sang ${val === "standard" ? "Tiêu chuẩn" : "Tinh gọn"}`);
  };

  const toggleMorningReminder = () => {
    const next = !morningReminder;
    setMorningReminder(next);
    localStorage.setItem("uniflow-morning-reminder", next ? "enabled" : "disabled");
    toast.success(next ? "Đã bật nhắc điểm danh sáng (07:30)" : "Đã tắt nhắc điểm danh sáng");
  };

  const toggleEveningReminder = () => {
    const next = !eveningReminder;
    setEveningReminder(next);
    localStorage.setItem("uniflow-evening-reminder", next ? "enabled" : "disabled");
    toast.success(next ? "Đã bật nhắc tổng kết tối (21:30)" : "Đã tắt nhắc tổng kết tối");
  };

  const toggleDesktopPush = async () => {
    setBusyReminder(true);
    try {
      if (reminderState === "enabled") {
        await disableDesktopReminders();
        toast.info("Đã tắt thông báo trên máy này");
      } else {
        const result = await enableDesktopReminders();
        if (result.state === "enabled") {
          toast.success("Đã bật thông báo trên máy này thành công!");
        } else if (result.state === "denied") {
          toast.error("Trình duyệt đang chặn quyền thông báo");
        } else {
          toast.error("Không thể kết nối đến máy chủ thông báo");
        }
      }
    } catch {
      toast.error("Lỗi khi thay đổi cài đặt thông báo");
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
          dailyGoal,
          autoRollover,
          startOfWeek,
          defaultScreen,
          listDensity,
          reminderAdvance,
          soundEnabled,
          morningReminder,
          eveningReminder,
        },
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `uniflow-backup-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Đã xuất dữ liệu thành công");
    } catch {
      toast.error("Không thể xuất dữ liệu");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] sm:max-h-[85vh] w-[95vw] sm:max-w-4xl p-0 overflow-hidden flex flex-col bg-background/95 backdrop-blur-xl border-border/80 shadow-2xl">
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white shadow-xs">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">Cài đặt</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Tùy chỉnh giao diện, kế hoạch học tập, thông báo và không gian làm việc UniFlow
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
                  {tab.label}
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
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

            {activeTab === "workflow" && (
              <motion.div
                key="workflow"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Daily Goal Setting */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Target className="size-4 text-primary" />
                        Mục tiêu học tập hàng ngày
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Đặt số lượng công việc muốn hoàn thành mỗi ngày để duy trì chuỗi học tập (Streak)
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[11px] gap-1">
                      <Flame className="size-3 text-amber-500" />
                      Chuỗi học tập
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { goal: "3", label: "3 việc / ngày", desc: "Nhẹ nhàng, việc cốt lõi" },
                      { goal: "5", label: "5 việc / ngày", desc: "Tiêu chuẩn (Khuyên dùng)" },
                      { goal: "7", label: "7 việc / ngày", desc: "Nỗ lực cao, mùa thi" },
                    ].map((item) => (
                      <button
                        key={item.goal}
                        type="button"
                        onClick={() => handleDailyGoalChange(item.goal)}
                        className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                          dailyGoal === item.goal
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border/60 bg-muted/20 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <p className="text-xs font-semibold">{item.label}</p>
                        <p className="text-[10px] mt-0.5 text-muted-foreground">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto Rollover Tasks */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="size-4 text-primary" />
                      Tự động dời việc quá hạn sang Hôm nay
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-lg">
                      Khi mở ứng dụng vào ngày mới, tự động đưa các việc chưa xong của ngày hôm trước vào danh sách &quot;Hôm nay&quot; để bạn không bỏ lỡ bài tập.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={autoRollover ? "default" : "outline"}
                    size="sm"
                    onClick={toggleAutoRollover}
                    className="shrink-0 cursor-pointer"
                  >
                    {autoRollover ? "Đang bật" : "Đã tắt"}
                  </Button>
                </div>

                {/* Start of Week & Default Screen Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Start of week */}
                  <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <CalendarCheck className="size-4 text-primary" />
                        Ngày bắt đầu tuần
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Áp dụng cho giao diện Lịch và kế hoạch tuần
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "monday", label: "Thứ Hai (HUST)" },
                        { id: "sunday", label: "Chủ Nhật" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleStartOfWeekChange(item.id)}
                          className={`rounded-xl border p-2.5 text-xs font-medium transition-all cursor-pointer ${
                            startOfWeek === item.id
                              ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                              : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Task list density */}
                  <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <SlidersHorizontal className="size-4 text-primary" />
                        Mật độ hiển thị danh sách
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Độ thoáng của các thẻ bài tập và công việc
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "standard", label: "Tiêu chuẩn" },
                        { id: "compact", label: "Tinh gọn" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleListDensityChange(item.id)}
                          className={`rounded-xl border p-2.5 text-xs font-medium transition-all cursor-pointer ${
                            listDensity === item.id
                              ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                              : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Default screen on launch */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Màn hình khởi động mặc định
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Màn hình hiển thị đầu tiên khi bạn mở UniFlow
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "today", label: "Hôm nay", desc: "/my/today" },
                      { id: "courses", label: "Học phần", desc: "/my/courses" },
                      { id: "board", label: "Bảng học kỳ", desc: "/board" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleDefaultScreenChange(item.id)}
                        className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                          defaultScreen === item.id
                            ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                            : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
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
                          Thông báo trình duyệt & thiết bị
                        </h4>
                        {reminderState === "enabled" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            Đang hoạt động
                          </Badge>
                        ) : reminderState === "denied" ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                            Bị chặn
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                            Chưa bật
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Nhận chuông báo và popup nhắc hạn công việc, đồ án và lịch thi ngay cả khi đã đóng tab UniFlow.
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
                        ? "Đang xử lý…"
                        : reminderState === "enabled"
                        ? "Tắt thông báo"
                        : "Bật thông báo"}
                    </Button>
                  </div>

                  {reminderState === "denied" && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2">
                      <Info className="size-4 shrink-0 mt-0.5" />
                      <span>
                        Trình duyệt đang chặn quyền gửi thông báo. Hãy bấm vào biểu tượng ổ khóa bên cạnh thanh địa chỉ URL để cấp quyền &quot;Thông báo&quot; cho UniFlow.
                      </span>
                    </div>
                  )}
                </div>

                {/* Reminder Lead Time */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Thời gian nhắc trước hạn</h4>
                      <p className="text-xs text-muted-foreground">
                        Chọn thời điểm UniFlow gửi thông báo nhắc bạn trước khi đến hạn chót (Deadline)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { mins: "15", label: "Trước 15 phút" },
                      { mins: "60", label: "Trước 1 giờ" },
                      { mins: "1440", label: "Trước 1 ngày" },
                      { mins: "2880", label: "Trước 2 ngày" },
                    ].map((opt) => (
                      <button
                        key={opt.mins}
                        type="button"
                        onClick={() => handleReminderAdvanceChange(opt.mins)}
                        className={`rounded-xl border p-2.5 text-xs font-medium transition-all cursor-pointer ${
                          reminderAdvance === opt.mins
                            ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                            : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Daily Digest Reminders (Morning & Evening) */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="size-4 text-primary" />
                      Lịch điểm danh & tổng kết ngày
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Nhận thông báo tóm tắt lịch học buổi sáng và rà soát bài tập buổi tối
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Điểm danh sáng (07:30)</p>
                        <p className="text-[11px] text-muted-foreground">Nhắc các môn học và deadline trong ngày</p>
                      </div>
                      <Button
                        type="button"
                        variant={morningReminder ? "default" : "outline"}
                        size="sm"
                        onClick={toggleMorningReminder}
                        className="h-8 text-xs shrink-0 cursor-pointer"
                      >
                        {morningReminder ? "Bật" : "Tắt"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Tổng kết tối (21:30)</p>
                        <p className="text-[11px] text-muted-foreground">Kiểm tra việc hoàn thành và bài vở ngày mai</p>
                      </div>
                      <Button
                        type="button"
                        variant={eveningReminder ? "default" : "outline"}
                        size="sm"
                        onClick={toggleEveningReminder}
                        className="h-8 text-xs shrink-0 cursor-pointer"
                      >
                        {eveningReminder ? "Bật" : "Tắt"}
                      </Button>
                    </div>
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
                      Âm thanh nhắc nhở
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Phát âm thanh nhẹ nhàng chuông 2 nốt khi công việc đến hạn
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={playChimeSound}
                      className="flex items-center gap-1.5 cursor-pointer text-xs"
                      title="Nghe thử âm thanh chuông báo"
                    >
                      <Play className="size-3 text-primary" />
                      Nghe thử
                    </Button>
                    <Button
                      type="button"
                      variant={soundEnabled ? "default" : "outline"}
                      size="sm"
                      onClick={toggleSound}
                      className="cursor-pointer text-xs"
                    >
                      {soundEnabled ? "Đang bật" : "Đã tắt"}
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
                    Phím tắt hữu ích
                  </h4>
                  <div className="divide-y divide-border/50 text-xs">
                    {[
                      { key: "⌘ / Ctrl + K", desc: "Mở thanh tìm kiếm toàn không gian UniFlow" },
                      { key: "⌘ / Ctrl + B", desc: "Ẩn / Hiện thanh điều hướng Sidebar" },
                      { key: "T", desc: "Chuyển nhanh về màn hình 'Hôm nay'" },
                      { key: "L", desc: "Chuyển nhanh sang chế độ 'Lịch'" },
                      { key: "N", desc: "Mở ô nhập nhanh công việc mới" },
                      { key: "Esc", desc: "Đóng cửa sổ hoặc chi tiết thẻ hiện tại" },
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
                      Tiện ích UniFlow Quick Capture
                    </h4>
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Chrome Extension
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Bôi đen tin nhắn giao bài tập từ giảng viên hoặc nhóm đồ án trên <strong>Microsoft Teams</strong>, <strong>BK E-learning</strong>, hay <strong>Messenger</strong>, sau đó nhấn phím tắt hoặc chuột phải để AI tự động trích xuất hạn chót và môn học vào UniFlow.
                  </p>
                  <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                    💡 Bạn có thể kiểm tra tiện ích tại thư mục <code className="font-mono text-primary">extensions/uniflow-capture</code> trong bộ cài đặt.
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
                      {user?.fullName || "Sinh viên Bách Khoa"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.primaryEmailAddress?.emailAddress || "Chưa thiết lập email"}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-500/30">
                        Sinh viên HUST
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">• Đồng bộ đám mây</span>
                    </div>
                  </div>
                </div>

                {/* Data Backup & Export */}
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs space-y-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Download className="size-4 text-primary" />
                    Sao lưu & Xuất dữ liệu
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tải về bản sao lưu dự phòng toàn bộ cấu hình giao diện, kế hoạch học tập và thông tin cá nhân của bạn dưới định dạng JSON chuẩn.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportData}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    Xuất dữ liệu (.json)
                  </Button>
                </div>

                {/* App Version Info */}
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center text-xs text-muted-foreground">
                  UniFlow Student Planner v2.4 (HUST Edition) • Giữ nhịp học tập Bách Khoa
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};
