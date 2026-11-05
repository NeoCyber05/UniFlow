import type { MessageKey } from "@/lib/i18n/messages/vi";

/** Nhãn đang chạy / đã xong của từng công cụ (dùng cho dòng các bước và dòng chờ). */
export const TOOL_LABEL_KEYS: Record<string, { running: MessageKey; done: MessageKey }> = {
  searchWorkspace: { running: "aiAssistant.toolRunning.searchWorkspace", done: "aiAssistant.toolDone.searchWorkspace" },
  getPage: { running: "aiAssistant.toolRunning.getPage", done: "aiAssistant.toolDone.getPage" },
  getMyAgenda: { running: "aiAssistant.toolRunning.getMyAgenda", done: "aiAssistant.toolDone.getMyAgenda" },
  updateChecklistItem: { running: "aiAssistant.toolRunning.updateChecklistItem", done: "aiAssistant.toolDone.updateChecklistItem" },
  getDeadlines: { running: "aiAssistant.toolRunning.getDeadlines", done: "aiAssistant.toolDone.getDeadlines" },
  getBoardProgress: { running: "aiAssistant.toolRunning.getBoardProgress", done: "aiAssistant.toolDone.getBoardProgress" },
  showChart: { running: "aiAssistant.toolRunning.showChart", done: "aiAssistant.toolDone.showChart" },
  findCards: { running: "aiAssistant.toolRunning.findCards", done: "aiAssistant.toolDone.findCards" },
  getCardDetails: { running: "aiAssistant.toolRunning.getCardDetails", done: "aiAssistant.toolDone.getCardDetails" },
  createDeadlineCard: { running: "aiAssistant.toolRunning.createDeadlineCard", done: "aiAssistant.toolDone.createDeadlineCard" },
  createRecurringSchedule: { running: "aiAssistant.toolRunning.createRecurringSchedule", done: "aiAssistant.toolDone.createRecurringSchedule" },
  batchCreateCards: { running: "aiAssistant.toolRunning.batchCreateCards", done: "aiAssistant.toolDone.batchCreateCards" },
  createCardChecklist: { running: "aiAssistant.toolRunning.createCardChecklist", done: "aiAssistant.toolDone.createCardChecklist" },
  moveCard: { running: "aiAssistant.toolRunning.moveCard", done: "aiAssistant.toolDone.moveCard" },
  updateCardDeadline: { running: "aiAssistant.toolRunning.updateCardDeadline", done: "aiAssistant.toolDone.updateCardDeadline" },
  updateCardDetails: { running: "aiAssistant.toolRunning.updateCardDetails", done: "aiAssistant.toolDone.updateCardDetails" },
  archiveCard: { running: "aiAssistant.toolRunning.archiveCard", done: "aiAssistant.toolDone.archiveCard" },
  createCardDependency: { running: "assistant.tool.createCardDependency.running", done: "assistant.tool.createCardDependency.done" },
  deleteCardDependency: { running: "assistant.tool.deleteCardDependency.running", done: "assistant.tool.deleteCardDependency.done" },
  getCurrentTime: { running: "assistant.tool.getCurrentTime.running", done: "assistant.tool.getCurrentTime.done" },
  askChoice: { running: "assistant.tool.askChoice.running", done: "assistant.tool.askChoice.done" },
};

