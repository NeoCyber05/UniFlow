import { auth } from "@/server/auth";
import { db } from "@/lib/db";
import { getPersonalNoteScope } from "@/lib/notes/server";
import { serializeNoteBlocks } from "@/lib/notes/blocks";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return new Response("Chưa có không gian cá nhân.", { status: 409 });
  try {
    // shortcut: list the latest 100 pages; paginate when browsing older pages becomes necessary.
    return Response.json(await db.notePage.findMany({
      where: scope, select: { id: true, title: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 100,
    }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[NOTE_PAGES_GET]", error);
    return new Response("Chưa tải được ghi chú.", { status: 500 });
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return new Response("Chưa có không gian cá nhân.", { status: 409 });
  try {
    const page = await db.notePage.create({ data: { ...scope, content: serializeNoteBlocks([{ id: crypto.randomUUID(), type: "paragraph", text: "" }]) }, select: { id: true } });
    return Response.json(page, { status: 201 });
  } catch (error) {
    console.error("[NOTE_PAGES_POST]", error);
    return new Response("Chưa tạo được ghi chú.", { status: 500 });
  }
}
