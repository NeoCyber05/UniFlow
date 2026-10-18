import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { NoteBlock } from "@/lib/notes/blocks";
import { numberedIndex } from "@/lib/notes/block-editing";

const markdown = (text: string) => <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: props => <a {...props} target="_blank" rel="noreferrer noopener" /> }}>{text}</ReactMarkdown>;

export const NoteReadingView = ({ blocks, tasks }: { blocks: NoteBlock[]; tasks: { id: string; title: string; boardId: string }[] }) => <div className="note-markdown space-y-3">
  {blocks.map((block, index) => {
    if (block.type === "divider") return <hr key={block.id} className="my-5 border-current opacity-30" />;
    if (block.type === "task") {
      const task = tasks.find(task => task.id === block.taskId);
      return <p key={block.id}>{task ? <a href={`/board/${encodeURIComponent(task.boardId)}?cardId=${encodeURIComponent(task.id)}`}>{task.title}</a> : "Công việc liên kết chưa có trong danh sách đã tải."}</p>;
    }
    if (block.type === "deadline") {
      return <p key={block.id} className={block.checked ? "line-through opacity-70" : ""}>⏰ <strong>{block.text || "Hạn chưa đặt tên"}</strong>{block.dueAt && ` · ${new Date(block.dueAt).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })}`}</p>;
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
      {block.type === "todo" && <span role="img" aria-label={block.checked ? "Đã hoàn thành" : "Chưa hoàn thành"}>{block.checked ? "☑" : "☐"} </span>}
      <div className={block.type === "todo" ? `inline-block align-top ${block.checked ? "line-through opacity-70" : ""}` : "min-w-0"}>{markdown(block.text)}</div>
    </div>;
  })}
</div>;
