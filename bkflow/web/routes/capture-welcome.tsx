import { Link } from "react-router";
import { MousePointerClick, Sparkles, Highlighter } from "lucide-react";

import { CAPTURE_SITES } from "@/lib/capture/extension";
import { tr } from "@/lib/i18n";

import { useTitle } from "../lib/use-title";

/** Opened by the extension right after it is installed. */
export default function CaptureWelcomeRoute() {
  useTitle(tr("captureWelcome.title"));
  const sites = CAPTURE_SITES.join(", ");
  const steps = [
    { icon: Highlighter, title: tr("captureWelcome.step1Title"), body: tr("captureWelcome.step1Body", { sites }) },
    { icon: MousePointerClick, title: tr("captureWelcome.step2Title"), body: tr("captureWelcome.step2Body") },
    { icon: Sparkles, title: tr("captureWelcome.step3Title"), body: tr("captureWelcome.step3Body") },
  ];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{tr("captureWelcome.title")}</h1>
            <p className="text-sm text-neutral-500">{tr("captureWelcome.subtitle")}</p>
          </div>
        </div>

        <ol className="space-y-4">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-neutral-900">{index + 1}. {title}</p>
                <p className="text-sm text-neutral-500">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          {tr("captureWelcome.reloadNote")}{" "}
          <Link to="/privacy" className="underline">{tr("privacy.title")}</Link>
        </p>

        <Link
          to="/my/today"
          className="flex h-10 w-full items-center justify-center rounded-lg bg-violet-600 text-sm font-medium text-white hover:bg-violet-700"
        >
          {tr("capturePage.openUniflow")}
        </Link>
      </div>
    </main>
  );
}
