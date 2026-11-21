import { useRef, type ComponentPropsWithRef } from "react";

import type { splitCaptureKeywords } from "@/lib/capture/text-keywords";
import { cn } from "@/lib/utils";

type KeywordInputProps = Omit<ComponentPropsWithRef<"input">, "onScroll"> & {
  parts: ReturnType<typeof splitCaptureKeywords>;
  textClassName: string;
};

export function CaptureKeywordInput({ parts, textClassName, className, ...input }: KeywordInputProps) {
  const backdrop = useRef<HTMLDivElement>(null);

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={backdrop}
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-transparent forced-colors:hidden", textClassName)}
      >
        {parts.map((part, index) => part.kind ? (
          <mark key={index} className={cn("rounded-sm text-transparent",
            part.kind === "course" ? "bg-violet-500/20" : "bg-amber-500/25",
          )}>{part.text}</mark>
        ) : part.text)}
      </div>
      <input
        {...input}
        onScroll={(event) => {
          if (backdrop.current) backdrop.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
        className={cn("relative block w-full bg-transparent outline-none placeholder:font-normal placeholder:text-neutral-400", textClassName)}
      />
    </div>
  );
}
