import ReactMarkdown from "react-markdown";
import { getIntlLocale, tr } from "@/lib/i18n";
import remarkGfm from "remark-gfm";
import type { NoteBlock } from "@/lib/notes/blocks";
import { numberedIndex } from "@/lib/notes/block-editing";
import type { LinkedTaskView } from "@/lib/notes/contract";
import { LinkedTaskBlock } from "@/components/notes/linked-task-block";

const markdown = (text: string) => <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: props => <a {...props} target="_blank" rel="noreferrer noopener" /> }}>{text}</ReactMarkdown>;

export const NoteReadingView = ({ blocks, linkedTask }: { blocks: NoteBlock[]; linkedTask: (taskId: string) => LinkedTaskView }) => <div className="note-markdown space-y-3">
  {blocks.map((block, index) => {
    if (block.type === "divider") return <hr key={block.id} className="my-5 border-current opacity-30" />;
    if (block.type === "task") return <LinkedTaskBlock key={block.id} block={block} resolved={linkedTask(block.taskId)} />;
    if (block.type === "deadline") {
      return <p key={block.id} className={block.checked ? "line-through opacity-70" : ""}>⏰ <span className="text-xs opacity-70">{tr("notes.block.deadline")}</span> <strong>{block.text || tr("notes.deadline.untitled")}</strong>{block.dueAt && ` · ${new Date(block.dueAt).toLocaleString(getIntlLocale(), { dateStyle: "medium", timeStyle: "short" })}`}</p>;
    }
    if (block.type === "heading") {
      const Tag = `h${block.level}` as "h1" | "h2" | "h3";
      return <Tag key={block.id}>{block.text}</Tag>;
    }
    if (block.type === "bullet" || block.type === "numbered") {
      return <div key={block.id} className="flex"><span aria-hidden="true" className="w-6 shrink-0 text-center tabular-nums">{block.type === "bullet" ? "•" : `${numberedIndex(blocks, index)}.`}</span><div className="min-w-0 [&>p]:my-0">{markdown(block.text)}</div></div>;
    }
    if (block.type === "quote") return <blockquote key={block.id}>{markdown(block.text)}</blockquote>;
    return <div key={block.id} className={block.type === "callout" ? "flex gap-2 rounded-lg bg-black/5 px-4 py-2 dark:bg-white/5" : ""}>
      {block.type === "callout" && <span aria-hidden="true">💡</span>}
      {block.type === "todo" && <span role="img" aria-label={block.checked ? tr("notes.status.done") : tr("notes.status.open")}>{block.checked ? "☑" : "☐"} </span>}
      <div className={block.type === "todo" ? `inline-block align-top ${block.checked ? "line-through opacity-70" : ""}` : "min-w-0"}>{markdown(block.text)}</div>
    </div>;
  })}
</div>;
