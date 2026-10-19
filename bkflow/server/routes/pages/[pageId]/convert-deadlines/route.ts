import { auth } from "@/server/auth";
import { z } from "zod";

import { db } from "@/lib/db";
import { convertLegacyDeadlines, LegacyConversionError, previewLegacyConversion, restoreLegacyDeadlines } from "@/lib/notes/legacy-task-conversion";

type Context = { params: Promise<{ pageId: string }> };
const headers = { "Cache-Control": "private, no-store" };
const ConvertBody = z.object({ targetBoardId: z.string().min(1).max(100), targetListId: z.string().min(1).max(100), expectedUpdatedAt: z.string().datetime(), requestId: z.string().uuid() });
const RestoreBody = z.object({ expectedUpdatedAt: z.string().datetime() });

const fail = (error: unknown, tag: string) => {
  if (error instanceof LegacyConversionError) return Response.json({ error: error.message, issues: error.issues }, { status: error.status, headers });
  console.error(tag, error);
  return Response.json({ error: "Chưa xử lý được. Trang hiện tại vẫn được giữ nguyên." }, { status: 500, headers });
};

// Dry run (read only) + the user's personal boards/lists to pick a target from.
export async function GET(request: Request, { params }: Context) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Không có quyền truy cập." }, { status: 401, headers });
  const { pageId } = await params;
  const search = new URL(request.url).searchParams;
  try {
    const preview = await previewLegacyConversion({ userId, pageId, targetBoardId: search.get("boardId"), targetListId: search.get("listId") });
    if (!preview) return Response.json({ error: "Không tìm thấy trang." }, { status: 404, headers });
    const boards = await db.board.findMany({
      where: { userId },
      select: { id: true, title: true, lists: { where: { archivedAt: null }, select: { id: true, title: true }, orderBy: { order: "asc" } } },
      orderBy: { updatedAt: "desc" }, take: 100,
    });
    return Response.json({ preview, boards }, { headers });
  } catch (error) {
    return fail(error, "[NOTE_CONVERT_PREVIEW]");
  }
}

export async function POST(request: Request, { params }: Context) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Không có quyền truy cập." }, { status: 401, headers });
  const parsed = ConvertBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Yêu cầu chuyển không hợp lệ." }, { status: 400, headers });
  const { pageId } = await params;
  try {
    return Response.json(await convertLegacyDeadlines({ userId, pageId, ...parsed.data }), { headers });
  } catch (error) {
    return fail(error, "[NOTE_CONVERT]");
  }
}

// Restores the legacy blocks of the latest conversion; map rows and snapshots are kept.
export async function DELETE(request: Request, { params }: Context) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Không có quyền truy cập." }, { status: 401, headers });
  const parsed = RestoreBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Yêu cầu khôi phục không hợp lệ." }, { status: 400, headers });
  const { pageId } = await params;
  try {
    return Response.json(await restoreLegacyDeadlines({ userId, pageId, ...parsed.data }), { headers });
  } catch (error) {
    return fail(error, "[NOTE_CONVERT_RESTORE]");
  }
}
