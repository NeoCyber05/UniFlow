"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

export const AssistantMarkdown = memo(({ text, className }: { text: string; className?: string }) => (
  <div className={cn("space-y-2 text-sm leading-relaxed break-words", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
        ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        h1: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
        h2: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
        h3: ({ children }) => <h4 className="font-semibold">{children}</h4>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border px-2 py-1 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
));

AssistantMarkdown.displayName = "AssistantMarkdown";
