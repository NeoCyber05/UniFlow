import { auth } from "@/server/auth";
import { z } from "zod";

import { MUTATION_TOOL_OPERATIONS } from "@/lib/ai/assistant/policy";
import { resolveTimeZone } from "@/lib/ai/assistant/time";
import { createAssistantTools } from "@/lib/ai/assistant/tools";
import { logger } from "@/lib/logger";
import { requireBoardMemberForUser } from "@/lib/permissions";

const fail = (error: string, status: number) => Response.json({ error }, { status });

const Body = z.object({
  boardId: z.string().min(1),
  tool: z.string().refine((name) => name in MUTATION_TOOL_OPERATIONS),
  input: z.record(z.string(), z.unknown()),
  toolCallId: z.string().min(1).max(200),
  timeZone: z.string().optional(),
});

/** Áp dụng một đề xuất AI người dùng đã xem trước và bấm "Đồng ý": chạy công cụ ghi thật với cùng input. */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return fail("Bạn cần đăng nhập.", 401);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Đề xuất không hợp lệ.", 400);
  const { boardId, tool, input, toolCallId, timeZone } = parsed.data;

  const { membership, error } = await requireBoardMemberForUser({ boardId, userId });
  if (error || !membership) return fail(error ?? "Không có quyền truy cập bảng.", 403);

  const tools = createAssistantTools({ boardId, userId, boardMemberId: membership.id, role: membership.role, timeZone: resolveTimeZone(timeZone), approved: true }) as unknown as Record<string, { inputSchema: z.ZodType; execute: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<unknown> }>;
  const definition = tools[tool];
  // Input đến từ client: kiểm lại bằng chính schema của công cụ.
  const checked = definition.inputSchema.safeParse(input);
  if (!checked.success) return fail("Nội dung đề xuất không hợp lệ.", 400);

  try {
    return Response.json(await definition.execute(checked.data, { toolCallId, messages: [] }));
  } catch (cause) {
    logger.error("[AI_PROPOSAL_APPLY_ERROR]", cause, { action: "ai-proposal-apply", boardId });
    return fail("Chưa áp dụng được đề xuất. Thử lại sau.", 500);
  }
}
