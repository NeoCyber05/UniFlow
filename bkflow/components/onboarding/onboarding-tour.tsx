"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, GraduationCap, Highlighter, Sparkles, Zap } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CAPTURE_EXTENSION_URL, CAPTURE_SITES } from "@/lib/capture/extension";
import { cn } from "@/lib/utils";
import { getCaptureExtensionVersion } from "@/web/lib/capture-bridge";
import { useAuth } from "@/web/lib/auth";

const STORAGE_PREFIX = "uniflow:onboarding:v1:";

const STEPS = [
  {
    icon: GraduationCap,
    tone: "bg-violet-50 text-violet-600",
    title: "Chào mừng đến UniFlow",
    body: "Mỗi học kỳ là một bảng, mỗi môn là một nhóm việc. Bài tập, hạn nộp và ghi chú của bạn nằm chung một chỗ.",
  },
  {
    icon: Zap,
    tone: "bg-amber-50 text-amber-600",
    title: "Thêm việc thật nhanh",
    body: "Gõ vào ô “Thêm việc”: #môn để chọn môn, @mai, @t6 hoặc @15/10 để đặt hạn, ! để đánh dấu quan trọng. Câu thường như “nộp báo cáo 17h thứ 6” AI cũng hiểu.",
  },
  {
    icon: CalendarDays,
    tone: "bg-sky-50 text-sky-600",
    title: "Lịch và nhắc hạn",
    body: "Xem việc theo lịch, kéo thả để dời ngày. Bật nhắc hạn để nhận thông báo trước khi tới hạn.",
  },
  {
    icon: Sparkles,
    tone: "bg-fuchsia-50 text-fuchsia-600",
    title: "Để AI làm phần khó",
    body: "Dán ghi chú dài vào Smart Capture (✨), AI tách thành từng việc. Trợ lý AI giúp bạn hỏi đáp và sắp xếp công việc.",
  },
  {
    icon: Highlighter,
    tone: "bg-emerald-50 text-emerald-600",
    title: "Bắt việc từ tin nhắn",
    body: `Cài UniFlow Capture: trên ${CAPTURE_SITES.join(", ")} (bản web), bôi đen tin của thầy cô rồi bấm “Thêm vào UniFlow”. AI điền sẵn hạn nộp cho bạn.`,
  },
] as const;

const readSeen = (key: string) => {
  try {
    return localStorage.getItem(key) === "done";
  } catch {
    return true; // storage blocked: don't nag on every page load
  }
};

const markSeen = (key: string) => {
  try {
    localStorage.setItem(key, "done");
  } catch {
    // ignore: the tour simply shows again next time
  }
};

/** First-login walkthrough; shown once per account on this browser. */
export const OnboardingTour = () => {
  const { userId } = useAuth();
  const storageKey = `${STORAGE_PREFIX}${userId}`;
  const [open, setOpen] = useState(() => Boolean(userId) && !readSeen(storageKey));
  const [step, setStep] = useState(0);

  if (!userId) return null;

  const close = () => {
    markSeen(storageKey);
    setOpen(false);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const extensionInstalled = Boolean(getCaptureExtensionVersion());

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="flex flex-col items-center gap-4 px-6 pb-2 pt-8 text-center">
          <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", current.tone)}>
            <Icon className="h-7 w-7" />
          </span>
          <div className="space-y-2">
            <DialogTitle className="text-lg font-semibold">{current.title}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">{current.body}</DialogDescription>
          </div>

          {isLast && (
            extensionInstalled ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Bạn đã cài UniFlow Capture
              </p>
            ) : CAPTURE_EXTENSION_URL ? (
              <a
                href={CAPTURE_EXTENSION_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Cài UniFlow Capture cho Edge
              </a>
            ) : null
          )}
        </div>

        <div className="flex justify-center gap-1.5 py-4" aria-hidden>
          {STEPS.map((item, index) => (
            <span key={item.title} className={cn("h-1.5 rounded-full transition-all", index === step ? "w-5 bg-violet-600" : "w-1.5 bg-neutral-200")} />
          ))}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <button type="button" onClick={close} className="text-sm text-muted-foreground hover:text-foreground">
            Bỏ qua
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-100">
                Quay lại
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (isLast ? close() : setStep(step + 1))}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              {isLast ? "Bắt đầu" : "Tiếp"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
