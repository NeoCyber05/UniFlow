import { z } from "zod";

import type { CaptureAnalysis } from "@/lib/capture/analysis";
import { ActionState } from "@/lib/create-safe-action";

import { AnalyzeQuickCapture, AnalyzeSmartCapture, AnalyzeSmartCaptureBoard } from "./schema";

export type SmartCaptureBoardList = {
  id: string;
  title: string;
};

export type SmartCaptureBoardMember = {
  id: string;
  userName: string;
  userEmail: string | null;
  role: string;
};

export type SmartCaptureBoardLabel = {
  id: string;
  title: string;
  color: string;
};

export type SmartCaptureDraft = {
  title: string;
  description: string;
  checklistItems: string[];
  dueDateIso: string | null;
  assigneeBoardMemberIds: string[];
  labelIds: string[];
  /** Văn bản có ý gấp ("làm gấp", "khẩn cấp", …) → gắn sao cho người tạo */
  isImportant: boolean;
  listId: string;
  /** Môn gợi ý; null = Cá nhân / không xác định. */
  courseId: string | null;
  assigneeWarnings: string[];
  suggestedAssigneeBoardMemberIds: string[];
  suggestedLabelIds: string[];
  sourceExcerpt: string;
  splitReason: string;
};

export type SmartCaptureAnalysis = {
  drafts: SmartCaptureDraft[];
  splitSummary: string;
};

export type InputType = z.infer<typeof AnalyzeSmartCapture>;
export type QuickInputType = z.infer<typeof AnalyzeQuickCapture>;
export type BoardInputType = z.infer<typeof AnalyzeSmartCaptureBoard>;
export type ReturnType = ActionState<InputType, SmartCaptureAnalysis | CaptureAnalysis>;

/** Caller chọn mode nào nhận đúng shape đó, không phải tự thu hẹp union. */
export type AnalyzeSmartCaptureAction = {
  (input: QuickInputType): Promise<ActionState<InputType, CaptureAnalysis>>;
  (input: BoardInputType): Promise<ActionState<InputType, SmartCaptureAnalysis>>;
};
