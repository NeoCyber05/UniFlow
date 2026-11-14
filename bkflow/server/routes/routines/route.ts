import { auth } from "@/server/auth";
import { z } from "zod";

import { resolveTimeZone } from "@/lib/ai/assistant/time";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createRoutine, setRoutineEnabled } from "@/lib/routines/run";
import { nextRoutineRun } from "@/lib/routines/schedule";

const ROUTE = "/api/routines";
const fail = (error: string, status: number) => Response.json({ error }, { status });

const Create = z.object({
  title: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(1000),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  timeZone: z.string().max(64).optional(),
});
const Toggle = z.object({ id: z.string().min(1).max(100), enabled: z.boolean() });
const Remove = z.object({ id: z.string().min(1).max(100) });

const SELECT = { id: true, title: true, prompt: true, minuteOfDay: true, weekdays: true, enabled: true, nextRunAt: true } as const;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json({ routines: await db.agentRoutine.findMany({ where: { userId }, select: SELECT, orderBy: { createdAt: "asc" } }) });
  } catch (error) {
    logger.error("[ROUTINES_GET_ERROR]", error, { route: ROUTE });
    return fail("Không tải được danh sách lịch.", 500);
  }
}

/** Tạo lịch lặp (bản tin sáng...). Lời nhắc một lần do công cụ scheduleReminder của Trợ lý tạo. */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Lịch không hợp lệ.", 400);

  const { title, prompt, time } = parsed.data;
  const [hour, minute] = time.split(":").map(Number);
  const schedule = {
    minuteOfDay: hour * 60 + minute,
    weekdays: [...new Set(parsed.data.weekdays)].sort((a, b) => a - b),
    timeZone: resolveTimeZone(parsed.data.timeZone),
  };
  try {
    const result = await createRoutine(userId, { title, prompt, ...schedule, nextRunAt: nextRoutineRun(schedule, new Date()) });
    if (result.error) return fail(result.error, 400);
    return Response.json({ id: result.data.id });
  } catch (error) {
    logger.error("[ROUTINES_POST_ERROR]", error, { route: ROUTE });
    return fail("Không lưu được lịch.", 500);
  }
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const parsed = Toggle.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Yêu cầu không hợp lệ.", 400);

  const { id, enabled } = parsed.data;
  try {
    const result = await setRoutineEnabled(userId, id, enabled);
    if (result.error) return fail(result.error, result.status);
    return Response.json({ ok: true });
  } catch (error) {
    logger.error("[ROUTINES_PATCH_ERROR]", error, { route: ROUTE });
    return fail("Không cập nhật được lịch.", 500);
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const parsed = Remove.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Yêu cầu không hợp lệ.", 400);
  try {
    // userId trong điều kiện: không xóa được lịch của người khác.
    await db.agentRoutine.deleteMany({ where: { id: parsed.data.id, userId } });
    return Response.json({ ok: true });
  } catch (error) {
    logger.error("[ROUTINES_DELETE_ERROR]", error, { route: ROUTE });
    return fail("Không xóa được lịch.", 500);
  }
}
