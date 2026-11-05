import { auth } from "@/server/auth";
import { z } from "zod";

import { recordThreadDecision } from "@/lib/ai/assistant/threads";

const fail = (error: string, status: number) => Response.json({ error }, { status });

const Body = z.object({
  toolCallId: z.string().min(1).max(200),
  status: z.enum(["applied", "dismissed"]),
  // Kết quả công cụ sau khi áp dụng, để "Đã áp dụng" hiện lại đúng sau khi tải lại trang.
  output: z.unknown().optional(),
});

/** Lưu Đồng ý / Bỏ của một đề xuất trong cuộc trò chuyện. Việc ghi dữ liệu thật vẫn đi qua /api/ai/proposals hoặc /api/ai/edits. */
export async function POST(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const { userId } = await auth();
  if (!userId) return fail("Bạn cần đăng nhập.", 401);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Yêu cầu không hợp lệ.", 400);
  const output = parsed.data.output === undefined ? undefined : JSON.stringify(parsed.data.output);
  if (output && output.length > 20_000) return fail("Kết quả quá lớn.", 400);
  const { threadId } = await params;
  const decisions = await recordThreadDecision(userId, threadId, parsed.data.toolCallId, {
    status: parsed.data.status,
    at: new Date().toISOString(),
    ...(output && { output: JSON.parse(output) }),
  });
  if (!decisions) return fail("Không tìm thấy cuộc trò chuyện.", 404);
  return Response.json({ decisions });
}
