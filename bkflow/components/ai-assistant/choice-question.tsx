"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ChoiceOutput } from "@/lib/ai/assistant/choice-tool";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Câu hỏi lại có lựa chọn bấm được (công cụ askChoice). Chọn rồi bấm Tiếp tục để gửi câu trả lời;
 * "Trả lời khác…" đưa con trỏ về ô nhập.
 */
export const ChoiceQuestion = ({ output, answered, onReply }: { output: ChoiceOutput; answered: boolean; onReply?: (text: string) => void }) => {
  const [selected, setSelected] = useState(0);
  const name = useId();
  const disabled = answered || !onReply;

  return (
    <fieldset className="space-y-2 rounded-xl border bg-card p-3 text-card-foreground" disabled={disabled}>
      <legend className="sr-only">{output.question}</legend>
      <p className="text-sm font-medium">{output.question}</p>
      <div className="space-y-1.5">
        {output.options.map((option, index) => (
          <label
            key={`${option.label}-${index}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
              selected === index && !answered ? "border-violet-400 bg-violet-500/5" : "hover:bg-muted/60",
              disabled && "cursor-default opacity-70",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={selected === index}
              onChange={() => setSelected(index)}
              className="mt-1 size-3.5 accent-violet-600"
            />
            <span className="min-w-0">
              <span className="block break-words text-sm font-medium">{option.label}</span>
              {option.detail ? <span className="block break-words text-xs text-muted-foreground">{option.detail}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {answered ? (
        <p className="text-xs text-muted-foreground">{tr("assistant.choice.answered")}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" size="sm" disabled={disabled} onClick={() => onReply?.(output.options[selected]?.reply ?? output.options[0].reply)}>
            {tr("assistant.choice.continue")}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={disabled}
            onClick={() => document.querySelector<HTMLTextAreaElement>("[data-assistant-composer]")?.focus()}>
            {tr("assistant.choice.other")}
          </Button>
        </div>
      )}
    </fieldset>
  );
};
