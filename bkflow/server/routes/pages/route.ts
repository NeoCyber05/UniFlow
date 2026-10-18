import { auth } from "@/server/auth";
import { db } from "@/lib/db";
import { getPersonalNoteScope } from "@/lib/notes/server";
import { serializeNoteBlocks } from "@/lib/notes/blocks";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return new Response("Chưa có không gian cá nhân.", { status: 409 });
  try {
    // shortcut: list the latest 100 pages; paginate when browsing older pages becomes necessary.
    const trash = new URL(request.url).searchParams.get("trash") === "1";
    return Response.json(await db.notePage.findMany({
      where: { ...scope, deletedAt: trash ? { not: null } : null },
      select: { id: true, title: true, parentId: true, updatedAt: true, icon: true, isFavorite: true, deletedAt: true },
      orderBy: trash ? { deletedAt: "desc" } : { updatedAt: "desc" }, take: 100,
    }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[NOTE_PAGES_GET]", error);
    return new Response("Chưa tải được ghi chú.", { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return new Response("Chưa có không gian cá nhân.", { status: 409 });
  const body = await request.json().catch(() => ({})) as { parentId?: unknown };
  const parentId = typeof body.parentId === "string" && body.parentId.length <= 100 ? body.parentId : null;
  try {
    if (parentId && !await db.notePage.findFirst({ where: { id: parentId, ...scope, deletedAt: null }, select: { id: true } })) {
      return new Response("Không tìm thấy trang cha.", { status: 404 });
    }
    const page = await db.notePage.create({ data: { ...scope, parentId, content: serializeNoteBlocks([{ id: crypto.randomUUID(), type: "paragraph", text: "" }]) }, select: { id: true } });
    return Response.json(page, { status: 201 });
  } catch (error) {
    console.error("[NOTE_PAGES_POST]", error);
    return new Response("Chưa tạo được ghi chú.", { status: 500 });
  }
}
