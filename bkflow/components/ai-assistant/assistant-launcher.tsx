import { Hint } from "@/components/hint";
import { tr } from "@/lib/i18n";

import { AiLogo } from "./ai-logo";

export const AssistantLauncher = ({ onOpen, busy, loading }: { onOpen?: () => void; busy?: boolean; loading?: boolean }) => (
  <Hint description={tr("aiAssistant.fabHint")} side="left" sideOffset={10}>
    <button
      type="button"
      onClick={onOpen}
      aria-label={loading ? tr("common.loading") : tr("aiAssistant.openAria")}
      aria-busy={loading}
      aria-disabled={loading}
      className="fixed bottom-5 right-5 z-[60] flex h-12 items-center justify-center gap-2 rounded-xl border border-violet-700 bg-violet-700 px-3 text-white shadow-sm transition-colors hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500"
    >
      <AiLogo className="size-7" />
      <span>AI</span>
      {(busy || loading) && <span className="absolute right-1 top-1 size-3 animate-pulse rounded-full bg-emerald-400 ring-2 ring-white" />}
    </button>
  </Hint>
);
