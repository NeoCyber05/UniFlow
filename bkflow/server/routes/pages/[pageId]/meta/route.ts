import { auth } from "@/server/auth";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSubtreeIds } from "@/lib/notes/page-tree";
import { findOwnedNote, getPersonalNoteScope } from "@/lib/notes/server";

const RequestBody = z.object({
  icon: z.string().trim().max(16).nullable().optional(),
  isFavorite: z.boolean().optional(),
  parentId: z.string().max(100).nullable().optional(),
  restore: z.literal(true).optional(),
});

// Page metadata that must not bump updatedAt or conflict with autosave: icon, favorite, parent, restore from trash.
export async function PATCH(request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Không có quyền truy cập." }, { status: 401 });
  const scope = await getPersonalNoteScope(userId);
  const { pageId } = await params;
  const page = scope ? await findOwnedNote(scope, pageId) : null;
  if (!scope || !page) return Response.json({ error: "Không tìm thấy trang." }, { status: 404 });
  const parsed = RequestBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dữ liệu trang không hợp lệ." }, { status: 400 });
  const { icon, isFavorite, parentId, restore } = parsed.data;

  try {
    const pages = await db.notePage.findMany({ where: scope, select: { id: true, parentId: true, deletedAt: true } });
    const byId = new Map(pages.map(item => [item.id, item]));

    if (restore) {
      if (!page.deletedAt) return Response.json({ error: "Trang không nằm trong thùng rác." }, { status: 409 });
      // Restore the subtree trashed together with this page; detach it if its parent is still in the trash.
      const ids = getSubtreeIds(pages, pageId).filter(id => byId.get(id)?.deletedAt?.getTime() === page.deletedAt!.getTime());
      const parentTrashed = page.parentId ? Boolean(byId.get(page.parentId)?.deletedAt) : false;
      await db.$transaction([
        db.notePage.updateMany({ where: { ...scope, id: { in: ids.filter(id => id !== pageId) } }, data: { deletedAt: null } }),
        db.notePage.updateMany({ where: { ...scope, id: pageId }, data: { deletedAt: null, updatedAt: page.updatedAt, ...(parentTrashed && { parentId: null }) } }),
      ]);
      return Response.json({ ok: true });
    }

    if (page.deletedAt) return Response.json({ error: "Khôi phục trang trước khi chỉnh sửa." }, { status: 409 });
    if (parentId !== undefined && parentId !== null) {
      const parent = byId.get(parentId);
      if (!parent || parent.deletedAt) return Response.json({ error: "Không tìm thấy trang cha." }, { status: 404 });
      if (getSubtreeIds(pages, pageId).includes(parentId)) return Response.json({ error: "Không thể chuyển trang vào chính nó hoặc trang con của nó." }, { status: 409 });
    }
    const updated = await db.notePage.updateMany({
      where: { ...scope, id: pageId, updatedAt: page.updatedAt },
      data: {
        ...(icon !== undefined && { icon: icon || null }),
        ...(isFavorite !== undefined && { isFavorite }),
        ...(parentId !== undefined && { parentId }),
        // Keep the autosave version token valid in an open editor.
        updatedAt: page.updatedAt,
      },
    });
    if (!updated.count) return Response.json({ error: "Trang vừa được lưu. Hãy thử lại." }, { status: 409 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[NOTE_PAGE_META]", error);
    return Response.json({ error: "Chưa cập nhật được trang." }, { status: 500 });
  }
}
