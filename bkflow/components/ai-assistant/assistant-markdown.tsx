"use client";

import { createContext, memo, type ReactNode, useContext } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** Cho phép khối cha đổi một liên kết thành thứ khác (ví dụ chip nguồn); trả null để giữ liên kết thường. */
export const MarkdownLinkContext = createContext<((href: string | undefined, children: ReactNode) => ReactNode) | null>(null);

const MarkdownLink = ({ children, href }: { children?: ReactNode; href?: string }) => {
  const custom = useContext(MarkdownLinkContext)?.(href, children);
  if (custom) return custom;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  );
};

// Khai báo ngoài component: định nghĩa lại mỗi lần render sẽ gắn lại toàn bộ cây (mất hiệu ứng chữ, đóng popover).
const COMPONENTS: Components = {
  p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="font-semibold">{children}</h4>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-violet-300 pl-3 text-muted-foreground">{children}</blockquote>,
  a: MarkdownLink,
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
};

type HastNode = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] };
const BLOCKS = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th"]);

/** Đặt dấu nhấp nháy ở cuối nội dung đang stream. */
const rehypeStreaming = () => (tree: HastNode) => {
  let lastBlock: HastNode | undefined;
  const walk = (node: HastNode) => {
    if (!node.children) return;
    if (node.tagName && BLOCKS.has(node.tagName)) lastBlock = node;
    node.children.forEach(walk);
  };
  walk(tree);
  (lastBlock ?? tree).children?.push({ type: "element", tagName: "span", properties: { className: ["ai-caret"], ariaHidden: "true" }, children: [] });
};

export const AssistantMarkdown = memo(({ text, className, streaming = false }: { text: string; className?: string; streaming?: boolean }) => (
  <div className={cn("space-y-2 text-sm leading-relaxed break-words text-foreground", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={streaming ? [rehypeStreaming] : []}
      // Replies may echo untrusted email/Slack text; rendering an image would fetch (and leak data via) its URL.
      disallowedElements={["img"]}
      components={COMPONENTS}
    >
      {text}
    </ReactMarkdown>
  </div>
));

AssistantMarkdown.displayName = "AssistantMarkdown";
