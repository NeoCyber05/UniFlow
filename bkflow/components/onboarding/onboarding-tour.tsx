"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { CheckCircle2 } from "lucide-react";

import { ONBOARDING_ART } from "@/components/onboarding/onboarding-art";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CAPTURE_EXTENSION_URL, CAPTURE_SITES } from "@/lib/capture/extension";
import { cn } from "@/lib/utils";
import { getCaptureExtensionVersion } from "@/web/lib/capture-bridge";
import { useAuth } from "@/web/lib/auth";

const STORAGE_PREFIX = "uniflow:onboarding:v1:";

const STEPS = [
  {
    title: "onboarding.welcomeTitle",
    body: "onboarding.welcomeBody",
  },
  {
    title: "onboarding.quickAddTitle",
    body: "onboarding.quickAddBody",
  },
  {
    title: "onboarding.calendarTitle",
    body: "onboarding.calendarBody",
  },
  {
    title: "onboarding.aiTitle",
    body: "onboarding.aiBody",
  },
  {
    title: "onboarding.captureTitle",
    body: "onboarding.captureBody",
    params: { sites: CAPTURE_SITES.join(", ") },
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
  const Art = ONBOARDING_ART[step];
  const isLast = step === STEPS.length - 1;
  const extensionInstalled = Boolean(getCaptureExtensionVersion());

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="flex flex-col items-center gap-4 px-6 pb-2 pt-10 text-center">
          <div className="flex h-44 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-violet-50 to-violet-100/60 ring-1 ring-inset ring-violet-100">
            <Art key={step} className="h-full w-auto p-2" />
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-lg font-semibold">{current.title}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">{current.body}</DialogDescription>
          </div>

          {isLast && (
            extensionInstalled ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> {tr("onboarding.installed")}
              </p>
            ) : CAPTURE_EXTENSION_URL ? (
              <a
                href={CAPTURE_EXTENSION_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                {tr("onboarding.captureEdge")}
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
            {tr("onboarding.skip")}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-100">
                {tr("common.back")}
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (isLast ? close() : setStep(step + 1))}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              {isLast ? tr("onboarding.start") : tr("onboarding.next")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
