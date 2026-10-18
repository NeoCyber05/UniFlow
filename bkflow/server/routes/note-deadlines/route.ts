import { auth } from "@/server/auth";
import { db } from "@/lib/db";

// Open deadlines from note pages: overdue first, then upcoming.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  try {
    const deadlines = await db.noteDeadline.findMany({
      where: { userId, done: false, page: { deletedAt: null } },
      select: { blockId: true, title: true, dueAt: true, pageId: true, page: { select: { title: true, icon: true } } },
      orderBy: { dueAt: "asc" }, take: 20,
    });
    return Response.json(deadlines, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[NOTE_DEADLINES_GET]", error);
    return new Response("Chưa tải được hạn trong ghi chú.", { status: 500 });
  }
}
