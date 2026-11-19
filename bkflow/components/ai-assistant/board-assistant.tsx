"use client";

import { lazy, Suspense, useState } from "react";
import { useLocation } from "react-router";

import { useAssistantTask } from "@/hooks/use-assistant-task";
import type { AssistantContext } from "@/lib/ai/assistant/context";
import { readCalendarLocation } from "@/lib/calendar/calendar-navigation";
import { tr, useLocale } from "@/lib/i18n";
import { assistantContextKey } from "@/web/lib/assistant-context";

import { AssistantLauncher } from "./assistant-launcher";
import type { AssistantPanelProps } from "./assistant-panel";

const AssistantPanel = lazy(() => import("./assistant-panel"));

const DeferredAssistant = (props: Omit<AssistantPanelProps, "initialChecklist">) => {
  const taskId = props.context.kind === "task" ? props.context.cardId : undefined;
  const requested = useAssistantTask((state) => state.openTaskId === taskId);
  const [activated, setActivated] = useState<"chat" | "checklist" | null>(requested ? "checklist" : null);
  // Hold the checklist intent while the chat chunk is loading.
  if (requested && activated !== "checklist") setActivated("checklist");
  if (!activated) return <AssistantLauncher onOpen={() => setActivated("chat")} />;

  return (
    <Suspense fallback={<AssistantLauncher loading />}>
      <AssistantPanel {...props} initialChecklist={activated === "checklist"} />
    </Suspense>
  );
};

export const BoardAssistant = ({ boardId, context: supplied, label, onEditPage }: { boardId?: string; context?: AssistantContext; label?: string; onEditPage?: (text: string) => Promise<boolean | undefined> }) => {
  useLocale((s) => s.locale);
  const location = useLocation();
  const card = useAssistantTask(state => state.task);
  const navigation = readCalendarLocation(new URLSearchParams(location.search));
  const calendar = Boolean(boardId && location.pathname.endsWith("/calendar"));
  const context: AssistantContext | null = card ? { kind: "task", cardId: card.id, expectedUpdatedAt: card.updatedAt }
    : supplied ?? (boardId ? calendar ? { kind: "calendar", boardId, date: navigation.day, filters: { ...(navigation.filters?.selectedCourseIds.length === 1 && { courseId: navigation.filters.selectedCourseIds[0] }), ...(navigation.filters && { includeCompleted: navigation.filters.completedEnabled }) } } : { kind: "board", boardId } : null);
  if (!context) return null;
  return <DeferredAssistant key={assistantContextKey(context)} boardId={card?.boardId ?? boardId} context={context}
    contextLabel={card ? tr("aiAssistant.contextTask", { title: card.title }) : label ?? (calendar ? tr("aiAssistant.contextCalendar", { day: navigation.day }) : tr("aiAssistant.contextBoard"))}
    onEditPage={context.kind === "page" ? onEditPage : undefined} />;
};
