import { z } from "zod";

import type { ImageAnalysis } from "@/lib/capture/image-import";
import { ActionState } from "@/lib/create-safe-action";

import { AnalyzeCaptureImage } from "./schema";

export type InputType = z.infer<typeof AnalyzeCaptureImage>;
export type ReturnType = ActionState<InputType, {
  analysis: ImageAnalysis;
  /** Thứ Hai tuần 1 của học kỳ (YYYY-MM-DD); null nếu bảng không gắn học kỳ */
  week1Start: string | null;
}>;
