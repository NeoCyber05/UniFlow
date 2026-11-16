import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { AssistantMessage } from "@/components/ai-assistant/assistant-message";
import { ThinkingPanel } from "@/components/ai-assistant/thinking-panel";
import { Composer, type ComposerSubmit } from "@/components/assistant/composer";
import type { BoardAssistantUIMessage } from "@/lib/ai/assistant/agent";

// Trang chỉ có khi chạy dev (/dev/ai-demo, ?s=slack): phát lại câu trả lời giả để xem chuyển động, không gọi AI hay DB.

type Scenario = { question: string; steps: [string, unknown][]; answer: string };

const SLACK_TEACHER = "https://sun-xseeds.slack.com/archives/C07ITSS2K68/p1762926780000100";
const SLACK_CHARGER = "https://sun-xseeds.slack.com/archives/C07ITSS2K68/p1762858860000200";
const CHANNEL = { name: "hust_itssinjapanese2-k68-火2" };

const SCENARIOS: Record<string, Scenario> = {
  gmail: {
    question: "@Gmail tuần này có deadline gì không?",
    steps: [
      ["getCurrentTime", { ok: true, now: "2026-11-16T09:00:00+07:00" }],
      ["listRecentEmails", { emails: [
        { id: "m1", threadId: "t1", from: "TS. Nguyễn Văn A", subject: "Nhắc nộp báo cáo giữa kỳ IT3011", href: "https://mail.google.com/mail/u/0/#all/t1" },
        { id: "m2", threadId: "t2", from: "Phòng Đào tạo", subject: "Lịch quiz Giải tích tuần 11", href: "https://mail.google.com/mail/u/0/#all/t2" },
        { id: "m3", threadId: "t3", from: "Nhóm đồ án", subject: "Chốt giờ họp nhóm", href: "https://mail.google.com/mail/u/0/#all/t3" },
      ] }],
      ["searchWorkspace", { ok: true, items: [
        { type: "card", id: "c1", title: "Báo cáo giữa kỳ IT3011", subtitle: "Học kỳ 2026.1 · Cần làm", href: "/board/demo?cardId=c1" },
        { type: "note", id: "n1", title: "Kế hoạch đồ án tốt nghiệp", subtitle: "Trang ghi chú riêng", href: "/pages/n1" },
        { type: "card", id: "c2", title: "Bài tập lớn OOP", subtitle: "Học kỳ 2026.1 · Đang làm", href: "/board/demo?cardId=c2" },
      ] }],
    ],
    answer: `Tuần này bạn có **3 deadline** cần chú ý:

- **Báo cáo giữa kỳ IT3011**: hạn **20/11 23:59**, thầy đã nhắc qua [email](https://mail.google.com/mail/u/0/#all/t1) và đã có [thẻ trên bảng](/board/demo?cardId=c1).
- **Quiz chương 4 Giải tích**: **21/11**, theo [lịch quiz](https://mail.google.com/mail/u/0/#all/t2).
- **Họp nhóm đồ án**: **22/11 14:00**, [chốt qua email](https://mail.google.com/mail/u/0/#all/t3), nội dung ở [kế hoạch đồ án](/pages/n1).

⚠️ **Bài tập lớn OOP** đã quá hạn 1 ngày [xem thẻ](/board/demo?cardId=c2).

>> Lên lịch ôn quiz chương 4?
>> Tạo checklist cho báo cáo giữa kỳ
>> Email nào chưa có thẻ trên bảng?`,
  },
  slack: {
    question: "@Slack thầy Kimura có nhắc deadline gì trong nhóm 火2 không?",
    steps: [
      ["getCurrentTime", { ok: true, now: "2026-11-16T09:00:00+07:00" }],
      ["searchSlackMessages", { truncated: false, result: JSON.stringify({ data: { messages: { matches: [
        { permalink: SLACK_TEACHER, username: "Ryo Kimura", channel: CHANNEL, ts: "1762926780.000100",
          text: "<!channel>\nこちらはMVP(Phase1)のURL提出用スレッドです。\n提出期限：次回授業開始時刻の1時間前\n※無料サーバーを使う場合、有効期限に注意してください。" },
        { permalink: SLACK_CHARGER, username: "Nguyen Hong Diem", channel: CHANNEL, ts: "1762858860.000200",
          text: "<!channel> Lớp mình bạn nào để quên sạc laptop thì mai qua tầng 9 B1 gặp cô lấy lại nhé." },
      ] } } }) }],
      ["searchWorkspace", { ok: true, items: [
        { type: "course", id: "k1", title: "ITSS Japanese 2 (火2)", subtitle: "Thứ Ba 14:10 · Học kỳ 2026.1", href: "/board/demo?course=k1" },
      ] }],
      ["createDeadlineCard", { ok: true, action: "proposal", tool: "createDeadlineCard", operation: "set_deadline", policy: "preview", confirmation: null,
        input: { title: "Nộp URL MVP (Phase 1) – ITSS Japanese 2", dueDate: "2026-11-17T13:10:00+07:00", listTitle: "Cần làm" },
        target: null, context: null, edit: null }],
    ],
    answer: `Có, thầy **Ryo Kimura** đã @channel trong **#hust_itssinjapanese2-k68-火2** (Sun* xseeds) lúc **12:58 Thứ Năm 12/11** [tin nhắn của thầy](${SLACK_TEACHER}):

> こちらはMVP(Phase1)のURL提出用スレッドです。提出期限：次回授業開始時刻の1時間前

- **Việc cần làm**: gửi **URL bản MVP (Phase 1)** vào thread trả lời tin nhắn đó.
- **Hạn**: 1 tiếng trước giờ vào lớp buổi tới, tức **13:10 Thứ Ba 17/11** (lớp 火2 bắt đầu 14:10 theo [lịch môn](/board/demo?course=k1)).
- ⚠️ Nếu deploy trên **server miễn phí**, kiểm tra hạn dùng để link còn chạy lúc thầy chấm.

Tin còn lại trong kênh chỉ là [thông báo nhận lại sạc laptop](${SLACK_CHARGER}), không phải deadline. Mình đã soạn thẻ deadline bên dưới, bấm **Đồng ý** để thêm vào bảng.

>> Nhắc mình trước hạn 1 ngày
>> Tạo checklist deploy MVP
>> Thầy còn nhắn gì khác tuần này không?`,
  },
};

type Part = Record<string, unknown>;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tool = (name: string, id: string, state: string, output?: unknown): Part => ({ type: `tool-${name}`, toolCallId: id, state, input: {}, ...(output === undefined ? {} : { output }) });

export default function AiDemoRoute() {
  const [params] = useSearchParams();
  const scenario = SCENARIOS[params.get("s") ?? ""] ?? SCENARIOS.gmail;
  const [messages, setMessages] = useState<BoardAssistantUIMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<number>();
  const [input, setInput] = useState("");
  const run = useRef(0);

  const play = useCallback(async (question: string) => {
    const id = ++run.current;
    const alive = () => run.current === id;
    const user = { id: `u${id}`, role: "user", parts: [{ type: "text", text: question }] };
    const parts: Part[] = [];
    const push = () => setMessages([user, { id: `a${id}`, role: "assistant", parts: [...parts] }] as unknown as BoardAssistantUIMessage[]);
    setMessages([user] as unknown as BoardAssistantUIMessage[]);
    setSentAt(Date.now());
    setBusy(true);
    await sleep(1100);
    for (const [index, [name, output]] of scenario.steps.entries()) {
      if (!alive()) return;
      parts.push(tool(name, `s${index}`, "input-available"));
      push();
      await sleep(index === 0 ? 700 : 1500);
      parts[parts.length - 1] = tool(name, `s${index}`, "output-available", output);
      push();
      await sleep(400);
    }
    const words = scenario.answer.split(/(?<=\s)/);
    parts.push({ type: "text", text: "" });
    for (let index = 0; index < words.length && alive(); index += 2) {
      parts[parts.length - 1] = { type: "text", text: words.slice(0, index + 2).join("") };
      push();
      await sleep(70);
    }
    if (alive()) setBusy(false);
  }, [scenario]);

  useEffect(() => () => { run.current += 1; }, []);
  const send = ({ text }: ComposerSubmit) => { setInput(""); void play(text); };
  const last = messages[messages.length - 1];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <div className="flex-1 space-y-6">
        {messages.map((message, index) => (
          <AssistantMessage key={message.id} message={message} boardId="demo" destinationLabel="Học kỳ 2026.1" onOpenCard={() => undefined}
            onReply={(text) => void play(text)} onRetry={() => void play(scenario.question)}
            isLatest={index === messages.length - 1} isStreaming={busy} startedAt={sentAt} />
        ))}
        {busy && last?.role !== "assistant" ? <ThinkingPanel steps={[]} active startedAt={sentAt} className="pl-8" /> : null}
      </div>
      <div className="sticky bottom-4">
        <Composer value={input} onChange={setInput} onSubmit={send} busy={busy} onStop={() => { run.current += 1; setBusy(false); }} />
      </div>
    </main>
  );
}
