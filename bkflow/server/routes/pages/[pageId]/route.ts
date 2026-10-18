import { auth } from "@/server/auth";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { SaveNotePage } from "@/lib/notes/contract";
import { findOwnedNote, getPersonalNoteScope } from "@/lib/notes/server";

const noAccess = () => Response.json({ error: "Không có quyền truy cập." }, { status: 401 });

export async function GET(_request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { userId } = await auth();
  if (!userId) return noAccess();
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return Response.json({ error: "Không tìm thấy trang." }, { status: 404 });
  const { pageId } = await params;
  const page = await findOwnedNote(scope, pageId);
  return page ? Response.json({ page }) : Response.json({ error: "Không tìm thấy trang." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { userId } = await auth();
  if (!userId) return noAccess();
  const scope = await getPersonalNoteScope(userId);
  if (!scope) return Response.json({ error: "Không tìm thấy trang." }, { status: 404 });
  const { pageId } = await params;
  const parsed = SaveNotePage.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Tiêu đề, nội dung hoặc kiểu trang không hợp lệ." }, { status: 400 });
  try {
    const { title, content, style, expectedUpdatedAt } = parsed.data;
    const page = await db.$transaction(async tx => {
      const expected = new Date(expectedUpdatedAt);
      const updated = await tx.notePage.updateMany({
        where: { id: pageId, ...scope, updatedAt: expected },
        data: { title, content, style: style ? (style as Prisma.InputJsonValue) : Prisma.DbNull, updatedAt: new Date(Math.max(Date.now(), expected.getTime() + 1)) },
      });
      if (!updated.count) return null;
      return tx.notePage.findFirst({ where: { id: pageId, ...scope } });
    });
    if (!page) {
      const exists = await findOwnedNote(scope, pageId);
      return Response.json({ error: exists ? "Trang đã được cập nhật ở nơi khác. Tải lại để giữ bản mới nhất." : "Không tìm thấy trang." }, { status: exists ? 409 : 404 });
    }
    return Response.json({ page });
  } catch (error) {
    console.error("[NOTE_PAGE_PATCH]", error);
    return Response.json({ error: "Chưa lưu được ghi chú. Bản nháp vẫn được giữ trên màn hình." }, { status: 500 });
  }
}
