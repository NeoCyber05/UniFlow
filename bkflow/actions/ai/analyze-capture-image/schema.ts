import { z } from "zod";

import { IMAGE_DATA_URL_MAX_LENGTH } from "@/lib/capture/image-import";

export const AnalyzeCaptureImage = z.object({
  boardId: z.string().min(1),
  /** data:image/...;base64,... đã nén ở client */
  image: z.string()
    .max(IMAGE_DATA_URL_MAX_LENGTH, { message: "Ảnh quá lớn." })
    .regex(/^data:image\/(png|jpeg|webp);base64,/, { message: "Chỉ hỗ trợ ảnh PNG, JPEG, WebP." }),
  /** Yêu cầu gõ kèm ảnh, vd "chỉ lấy lịch thi", "đặt tên theo môn" */
  prompt: z.optional(z.string().max(4_000)),
});
