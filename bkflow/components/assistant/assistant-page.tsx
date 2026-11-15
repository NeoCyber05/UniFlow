"use client";

import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { ArrowDown, History, Inbox, MessageSquarePlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { AssistantMessage } from "@/components/ai-assistant/assistant-message";
import { ProposalDecisionsProvider } from "@/components/ai-assistant/proposal-decisions";
import { runningStepLabel, ThinkingStatus } from "@/components/ai-assistant/thinking-status";
import { Hint } from "@/components/hint";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCardModal } from "@/hooks/use-card-modal";
import type { BoardAssistantUIMessage } from "@/lib/ai/assistant/agent";
import { collectProposals, type ThreadDecisions, type ThreadDecisionStatus } from "@/lib/ai/assistant/threads-shared";
import { tr, useLocale } from "@/lib/i18n";
import { formatWorkspaceTitle } from "@/lib/workspaces";
import Link from "@/web/shims/next-link";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";

import {
  createThread,
  fetchThread,
  fetchThreads,
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

/** Sheet mở bằng nút nằm ngoài Dialog.Root: tự trả focus về nút đó khi đóng (nếu nút còn trên trang). */
const useReturnFocus = () => {
  const ref = useRef<HTMLElement | null>(null);
  const remember = useCallback(() => { ref.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }, []);
  const onCloseAutoFocus = useCallback((event: Event) => {
    // Nút đã ẩn (ví dụ Chờ duyệt về 0): đưa focus về ô nhập thay vì body.
    const target = ref.current?.isConnected ? ref.current : document.querySelector<HTMLElement>("[data-assistant-composer]");
    if (!target) return;
    event.preventDefault();
    target.focus();
  }, []);
  return useMemo(() => ({ remember, onCloseAutoFocus }), [remember, onCloseAutoFocus]);
};

const ConversationHeader = ({ title, onOpenThreads, children }: { title: string; onOpenThreads: () => void; children?: React.ReactNode }) => (
  <header className="glass-row mt-2 flex h-12 shrink-0 items-center gap-2 rounded-xl px-3 sm:mt-4 sm:px-5">
    <button type="button" onClick={onOpenThreads} aria-label={tr("assistant.threads.open")}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
      <History aria-hidden="true" className="size-4" />
      <span className="hidden sm:inline">{tr("assistant.history.open")}</span>
    </button>
    <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
    {children}
    <Hint description={tr("assistant.threads.newChat")}>
      <Link href="/assistant" aria-label={tr("assistant.threads.newChat")}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <MessageSquarePlus aria-hidden="true" className="size-4" />
      </Link>
    </Hint>
  </header>
);

/** Một cuộc trò chuyện đã có: khung chat ở giữa; Chờ duyệt / Đã áp dụng mở trong Sheet theo nhu cầu. */
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
  // Đích của thread cố định từ lúc tạo: không retarget đề xuất cũ sang bảng khác.
  const boardId = data.thread.boardId;
  const destinationBoard = boards.find((board) => board.id === boardId);
  const destinationLabel = destinationBoard ? formatWorkspaceTitle(destinationBoard.title) : undefined;
  const [decisions, setDecisions] = useState<ThreadDecisions>(data.thread.decisions);
  const [input, setInput] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const panelFocus = useReturnFocus();
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

  const panel = <ContextPanel destinationLabel={destinationLabel} boardId={boardId} proposals={proposals} onOpenCard={openCardModal} />;

  return (
    <ProposalDecisionsProvider value={decisionApi}>
      <section className="flex min-w-0 flex-1 flex-col" aria-label={title}>
        <ConversationHeader title={title} onOpenThreads={onOpenThreads}>
          {pendingCount > 0 ? (
            <button type="button" onClick={() => { panelFocus.remember(); setPanelOpen(true); }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/12 px-3 text-xs font-semibold text-primary hover:bg-primary/20">
              <Inbox aria-hidden="true" className="size-3.5" />
              {tr("assistant.panel.pendingCount", { count: pendingCount })}
            </button>
          ) : null}
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
                    destinationLabel={destinationLabel}
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
          <p className="mt-2 text-center"><span className="glass-row inline-block rounded-full px-2.5 py-0.5 text-[11px] text-muted-foreground">{tr("assistant.composer.reviewNote")}</span></p>
        </div>
      </section>

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-[min(22rem,100vw)] p-0" onCloseAutoFocus={panelFocus.onCloseAutoFocus}>
          <SheetTitle className="sr-only">{tr("assistant.panel.label")}</SheetTitle>
          <SheetDescription className="sr-only">{tr("assistant.panel.label")}</SheetDescription>
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
  const threadsFocus = useReturnFocus();
  const openThreads = useCallback(() => { threadsFocus.remember(); setThreadsOpen(true); }, [threadsFocus]);
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
    // Chưa có bảng đích: không tạo thread rồi chờ 403; màn chào đã hướng dẫn tạo danh sách việc.
    if (creating || !selectedBoard || (!value.text && !value.image)) return;
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
    <div className="assistant-workspace flex h-full min-h-0 sm:px-6 lg:px-10">
      <Sheet open={threadsOpen} onOpenChange={setThreadsOpen}>
        <SheetContent side="left" className="w-[min(18rem,85vw)] p-0" onCloseAutoFocus={threadsFocus.onCloseAutoFocus}>
          <SheetTitle className="sr-only">{tr("assistant.threads.title")}</SheetTitle>
          <SheetDescription className="sr-only">{tr("assistant.threads.title")}</SheetDescription>
          {list}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1">
        {threadId ? (
          <ThreadLoader key={threadId} threadId={threadId} boards={boards} enabled={enabled} takePending={takePending} onOpenThreads={openThreads} onMissing={goHome} />
        ) : (
          <section className="flex min-w-0 flex-1 flex-col">
            <ConversationHeader title={tr("assistant.thread.new")} onOpenThreads={openThreads}>
              {boards.length > 1 ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {tr("assistant.destination.label")}
                  <ScopeSelect boards={boards} value={selectedBoard} onChange={setBoardId} disabled={creating} />
                </span>
              ) : null}
            </ConversationHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AssistantHome
                enabled={enabled}
                noDestination={Boolean(data) && !selectedBoard}
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
