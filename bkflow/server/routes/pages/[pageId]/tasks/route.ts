import { auth } from "@/server/auth";
import { getLinkedTaskIds } from "@/lib/notes/contract";
import { loadLinkedTasks } from "@/lib/notes/linked-tasks";
import { findOwnedNote, getPersonalNoteScope } from "@/lib/notes/server";

const headers = { "Cache-Control": "private, no-store" };

// Task IDs come from the saved page content only; arbitrary ID lookups are not accepted.
export async function GET(_request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Không có quyền truy cập." }, { status: 401, headers });
  const scope = await getPersonalNoteScope(userId);
  const { pageId } = await params;
  const page = scope ? await findOwnedNote(scope, pageId) : null;
  if (!page) return Response.json({ error: "Không tìm thấy trang." }, { status: 404, headers });
  try {
    return Response.json({ tasks: await loadLinkedTasks({ userId, pageId, taskIds: getLinkedTaskIds(page.content) }) }, { headers });
  } catch (error) {
    console.error("[NOTE_PAGE_TASKS]", error);
    return Response.json({ error: "Chưa tải được công việc liên kết." }, { status: 500, headers });
  }
}
