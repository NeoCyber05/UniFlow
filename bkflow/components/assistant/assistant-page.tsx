"use client";

import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { ArrowDown, Inbox, Menu } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { AssistantMessage } from "@/components/ai-assistant/assistant-message";
import { ProposalDecisionsProvider } from "@/components/ai-assistant/proposal-decisions";
import { runningStepLabel, ThinkingStatus } from "@/components/ai-assistant/thinking-status";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCardModal } from "@/hooks/use-card-modal";
import type { BoardAssistantUIMessage } from "@/lib/ai/assistant/agent";
import { collectProposals, type ThreadDecisions, type ThreadDecisionStatus } from "@/lib/ai/assistant/threads-shared";
import { tr, useLocale } from "@/lib/i18n";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";

import {
  createThread,
  fetchThread,
  fetchThreads,
  patchThread,
  postDecision,
  threadKey,
  THREADS_KEY,
  type AssistantBoard,
  type ThreadPayload,
  type ThreadsPayload,
} from "./api";
import { AssistantHome } from "./assistant-home";
import type { ComposerSubmit } from "./composer";
import { Composer } from "./composer";
import { ContextPanel } from "./context-panel";
import { ScopeSelect } from "./scope-select";
import { ThreadList } from "./thread-list";
import { useStickToBottom } from "./use-stick-to-bottom";

// Câu hỏi đầu của một cuộc mới: tạo thread trước, rồi gửi ngay khi khung chat của thread đó mở.
type PendingFirst = { threadId: string; text: string; image: string | null };

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const toUserMessage = ({ text, image }: ComposerSubmit) => ({
  text,
  ...(image ? { files: [{ type: "file" as const, mediaType: "image/jpeg", url: image }] } : {}),
});

const ConversationHeader = ({ title, onOpenThreads, children }: { title: string; onOpenThreads: () => void; children?: React.ReactNode }) => (
  <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-5">
    <button type="button" onClick={onOpenThreads} aria-label={tr("assistant.threads.open")}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden">
      <Menu className="size-4" />
    </button>
    <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
    {children}
  </header>
);

/** Một cuộc trò chuyện đã có: khung chat ở giữa, cột Ngữ cảnh / Chờ duyệt / Đã áp dụng bên phải. */
const ThreadView = ({ threadId, data, boards, enabled, takePending, onOpenThreads }: {
  threadId: string;
  data: ThreadPayload;
  boards: AssistantBoard[];
  enabled: boolean;
  takePending: (threadId: string) => PendingFirst | null;
  onOpenThreads: () => void;
}) => {
  const queryClient = useQueryClient();
  const openCardModal = useCardModal((state) => state.onOpen);
  const [boardId, setBoardId] = useState(data.thread.boardId);
  const [decisions, setDecisions] = useState<ThreadDecisions>(data.thread.decisions);
  const [input, setInput] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport<BoardAssistantUIMessage>({
    api: "/api/ai/chat",
    // Server giữ lịch sử của thread: chỉ gửi tin mới nhất.
    prepareSendMessagesRequest: ({ messages }) => ({ body: { threadId, timeZone: timeZone(), message: messages[messages.length - 1] } }),
  }), [threadId]);

  const { messages, sendMessage, status, stop, error, clearError } = useChat<BoardAssistantUIMessage>({
    id: `assistant-thread-${threadId}`,
    messages: data.messages,
    transport,
    onError: (chatError) => toast.error(chatError.message || tr("aiAssistant.chatError")),
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: THREADS_KEY });
      void queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
    },
  });
  const busy = status === "submitted" || status === "streaming";

  const send = useCallback((value: ComposerSubmit) => {
    if (!value.text && !value.image) return;
    clearError();
    setInput("");
    void sendMessage(toUserMessage(value));
  }, [clearError, sendMessage]);

  // Câu hỏi đầu từ màn chào.
  const sentFirst = useRef(false);
  useEffect(() => {
    if (sentFirst.current) return;
    sentFirst.current = true;
    const pending = takePending(threadId);
    // Gửi câu hỏi đầu lên server đúng một lần khi thread vừa tạo được mở (đồng bộ với hệ thống ngoài).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pending && data.messages.length === 0) send({ text: pending.text, image: pending.image });
  }, [data.messages.length, send, takePending, threadId]);

  const record = useCallback((toolCallId: string, decisionStatus: ThreadDecisionStatus, output?: unknown) => {
    setDecisions((current) => current[toolCallId] ? current : { ...current, [toolCallId]: { status: decisionStatus, at: new Date().toISOString(), ...(output !== undefined && { output }) } });
    void postDecision(threadId, toolCallId, decisionStatus, output)
      .then((saved) => setDecisions((current) => ({ ...current, ...saved.decisions })))
      .catch(() => toast.error(tr("assistant.panel.saveError")));
  }, [threadId]);
  const decisionApi = useMemo(() => ({ decisions, record }), [decisions, record]);

  const changeBoard = (next: string) => {
    if (next === boardId) return;
    const previous = boardId;
    setBoardId(next);
    void patchThread(threadId, { boardId: next })
      .then(() => queryClient.invalidateQueries({ queryKey: THREADS_KEY }))
      .catch(() => { setBoardId(previous); toast.error(tr("assistant.threads.saveError")); });
  };

  const proposals = useMemo(() => collectProposals(messages, decisions), [messages, decisions]);
  const pendingCount = proposals.filter((entry) => !entry.decision).length;
  const { atBottom, scrollToBottom } = useStickToBottom(scrollRef, [messages, status]);
  const stepLabel = runningStepLabel(messages);
  const last = messages[messages.length - 1];
  const showThinking = status === "submitted" || (status === "streaming" && (last?.role !== "assistant" || Boolean(stepLabel)));
  const lastUserText = [...messages].reverse().find((message) => message.role === "user")?.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n").trim();
  const threads = queryClient.getQueryData<ThreadsPayload>(THREADS_KEY);
  const title = threads?.threads.find((thread) => thread.id === threadId)?.title || data.thread.title || tr("assistant.threads.untitled");

  const panel = <ContextPanel boards={boards} boardId={boardId} onBoardChange={changeBoard} proposals={proposals} onOpenCard={openCardModal} />;

  return (
    <ProposalDecisionsProvider value={decisionApi}>
      <section className="flex min-w-0 flex-1 flex-col" aria-label={title}>
        <ConversationHeader title={title} onOpenThreads={onOpenThreads}>
          <ScopeSelect boards={boards} value={boardId} onChange={changeBoard} className="hidden sm:inline-flex xl:hidden" />
          <button type="button" onClick={() => setPanelOpen(true)}
            className="relative inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground xl:hidden">
            <Inbox className="size-4" />
            <span className="hidden sm:inline">{tr("assistant.panel.pending")}</span>
            {pendingCount > 0 ? <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{pendingCount}</span> : null}
          </button>
        </ConversationHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {messages.length === 0 && !busy ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{tr("assistant.thread.empty")}</p>
            ) : null}
            {messages.map((message, index) => {
              const isLatest = index === messages.length - 1;
              return (
                <div key={message.id} id={`assistant-msg-${message.id}`} className="scroll-mt-4">
                  <AssistantMessage
                    message={message}
                    boardId={boardId}
                    onOpenCard={openCardModal}
                    onReply={(text) => send({ text, image: null })}
                    onRetry={isLatest && message.role === "assistant" && lastUserText && !busy ? () => send({ text: lastUserText, image: null }) : undefined}
                    isLatest={isLatest}
                    isStreaming={busy}
                  />
                </div>
              );
            })}
            {showThinking ? <ThinkingStatus label={stepLabel} className="pl-8" /> : null}
            {error && !busy ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error.message || tr("aiAssistant.genericError")}</p> : null}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-3xl px-4 pb-4">
          {!atBottom ? (
            <button type="button" onClick={scrollToBottom}
              className="absolute -top-11 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted">
              <ArrowDown className="size-3.5" />{tr("assistant.thread.jumpLatest")}
            </button>
          ) : null}
          <Composer value={input} onChange={setInput} onSubmit={send} onStop={() => void stop()} busy={busy} disabled={!enabled}
            placeholder={enabled ? tr("assistant.composer.followUp") : tr("aiAssistant.disabledPlaceholder")} />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{tr("assistant.composer.disclaimer")}</p>
        </div>
      </section>

      <aside aria-label={tr("assistant.panel.label")} className="hidden w-80 shrink-0 border-l bg-sidebar/50 xl:block">{panel}</aside>
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-[min(22rem,100vw)] p-0 xl:hidden">
          <SheetTitle className="sr-only">{tr("assistant.panel.label")}</SheetTitle>
          <SheetDescription className="sr-only">{tr("assistant.scope.help")}</SheetDescription>
          {panel}
        </SheetContent>
      </Sheet>
    </ProposalDecisionsProvider>
  );
};

const ThreadLoader = (props: { threadId: string; boards: AssistantBoard[]; enabled: boolean; takePending: (threadId: string) => PendingFirst | null; onOpenThreads: () => void; onMissing: () => void }) => {
  const { data, error } = useQuery({ queryKey: threadKey(props.threadId), queryFn: () => fetchThread(props.threadId), staleTime: Infinity, gcTime: 0, retry: 1 });
  const { onMissing } = props;
  useEffect(() => {
    if ((error as { status?: number } | null)?.status === 404) onMissing();
  }, [error, onMissing]);

  if (data) return <ThreadView {...props} data={data} />;
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <ConversationHeader title={error ? tr("assistant.thread.loadError") : tr("common.loading")} onOpenThreads={props.onOpenThreads} />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6" aria-hidden="true">
        <div className="ml-auto h-10 w-2/3 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
      </div>
    </section>
  );
};

/**
 * Trang Trợ lý cá nhân (/assistant và /assistant/:threadId): danh sách cuộc trò chuyện, màn chào
 * hoặc khung chat, và cột ngữ cảnh. `?q=` gửi ngay câu hỏi (từ Ctrl+K), `?board=` chọn sẵn bảng.
 */
export const AssistantPage = () => {
  useLocale((state) => state.locale);
  const { threadId } = useParams<{ threadId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const pending = useRef<PendingFirst | null>(null);
  const { data, isLoading } = useQuery({ queryKey: THREADS_KEY, queryFn: fetchThreads, staleTime: 30_000 });

  const boards = useMemo(() => data?.boards ?? [], [data?.boards]);
  const requestedBoard = searchParams.get("board");
  const [boardId, setBoardId] = useState<string | null>(null);
  const selectedBoard = boardId ?? (requestedBoard && boards.some((board) => board.id === requestedBoard) ? requestedBoard : data?.defaultBoardId ?? boards[0]?.id ?? null);
  const enabled = data?.enabled ?? true;

  const takePending = useCallback((id: string) => {
    const value = pending.current?.threadId === id ? pending.current : null;
    pending.current = null;
    return value;
  }, []);

  const start = useCallback(async (value: ComposerSubmit) => {
    if (creating || (!value.text && !value.image)) return;
    setCreating(true);
    try {
      const { thread } = await createThread(selectedBoard);
      queryClient.setQueryData<ThreadsPayload>(THREADS_KEY, (current) => current && { ...current, threads: [thread, ...current.threads] });
      queryClient.setQueryData<ThreadPayload>(threadKey(thread.id), { thread: { ...thread, decisions: {} }, messages: [] });
      pending.current = { threadId: thread.id, text: value.text, image: value.image };
      navigate(`/assistant/${thread.id}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : tr("assistant.threads.createError"));
    } finally {
      setCreating(false);
    }
  }, [creating, navigate, queryClient, selectedBoard]);

  // Ctrl+K → "Hỏi Trợ lý": gửi luôn câu đã gõ khi biết bảng mặc định.
  const question = searchParams.get("q");
  const askedRef = useRef<string | null>(null);
  useEffect(() => {
    if (threadId || !question || !data || !enabled || askedRef.current === question) return;
    askedRef.current = question;
    void start({ text: question.slice(0, 2000), image: null });
  }, [data, enabled, question, start, threadId]);

  const goHome = useCallback(() => navigate("/assistant", { replace: true }), [navigate]);
  const list = (
    <ThreadList
      threads={data?.threads ?? []}
      activeId={threadId}
      loading={isLoading}
      onNavigate={() => setThreadsOpen(false)}
      onDeleted={(id) => { if (id === threadId) goHome(); }}
    />
  );

  return (
    <div className="flex h-full min-h-0">
      <aside aria-label={tr("assistant.threads.title")} className="hidden w-64 shrink-0 border-r bg-sidebar/50 md:block">{list}</aside>
      <Sheet open={threadsOpen} onOpenChange={setThreadsOpen}>
        <SheetContent side="left" className="w-[min(18rem,85vw)] p-0 md:hidden">
          <SheetTitle className="sr-only">{tr("assistant.threads.title")}</SheetTitle>
          <SheetDescription className="sr-only">{tr("assistant.threads.title")}</SheetDescription>
          {list}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1">
        {threadId ? (
          <ThreadLoader key={threadId} threadId={threadId} boards={boards} enabled={enabled} takePending={takePending} onOpenThreads={() => setThreadsOpen(true)} onMissing={goHome} />
        ) : (
          <section className="flex min-w-0 flex-1 flex-col">
            <ConversationHeader title={tr("assistant.thread.new")} onOpenThreads={() => setThreadsOpen(true)} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AssistantHome
                boards={boards}
                boardId={selectedBoard}
                onBoardChange={setBoardId}
                enabled={enabled}
                busy={creating}
                onSubmit={(value) => void start(value)}
                initialInput={question ?? ""}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
