import { z } from "zod";

import { IMAGE_DATA_URL_MAX_LENGTH } from "@/lib/capture/image-import";

export const AnalyzeCaptureImage = z.object({
  boardId: z.string().min(1),
  /** data:image/...;base64,... đã nén ở client; bỏ trống = đọc lịch/việc từ prompt */
  image: z.string()
    .max(IMAGE_DATA_URL_MAX_LENGTH, { message: "Ảnh quá lớn." })
    .regex(/^data:image\/(png|jpeg|webp);base64,/, { message: "Chỉ hỗ trợ ảnh PNG, JPEG, WebP." })
    .optional(),
  /** Yêu cầu gõ kèm ảnh, vd "chỉ lấy lịch thi", "lên lịch ôn thi tối 19-22h" */
  prompt: z.optional(z.string().max(4_000)),
}).refine((value) => value.image || value.prompt?.trim(), { message: "Thiếu ảnh hoặc nội dung.", path: ["prompt"] });
