import { auth } from "@/server/auth";
import { db } from "@/lib/db";
import { getNavigationItems, parseRecentItems, workspaceBoardScope, type WorkspaceSearchItem, type SearchReference } from "@/lib/search/workspace-search";

export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return new Response("Unauthorized", { status: 401 });
  const personalOrgId = userId;
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const recent = parseRecentItems(new URL(request.url).searchParams.get("recent"));
  const ids = (type: SearchReference["type"]) => recent.filter(item => item.type === type).map(item => item.id);
  const boardScope = workspaceBoardScope(userId, orgId);
  const match = { contains: query, mode: "insensitive" as const };
  try {
    const [cards, courses, boards, notes] = await Promise.all([
      query || ids("card").length ? db.card.findMany({
        where: { archivedAt: null, list: { archivedAt: null, board: boardScope }, ...(query ? { OR: [{ title: match }, { description: match }] } : { id: { in: ids("card") } }) },
        select: { id: true, title: true, list: { select: { title: true, boardId: true, board: { select: { title: true } } } } },
        orderBy: { updatedAt: "desc" }, take: 10,
      }) : [],
      query || ids("course").length ? db.course.findMany({
        where: { board: boardScope, ...(query ? { OR: [{ name: match }, { code: match }] } : { id: { in: ids("course") } }) },
        select: { id: true, name: true, code: true, boardId: true, board: { select: { title: true } } },
        orderBy: { name: "asc" }, take: 8,
      }) : [],
      query || ids("board").length ? db.board.findMany({
        where: { ...boardScope, ...(query ? { title: match } : { id: { in: ids("board") } }) },
        select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 6,
      }) : [],
      personalOrgId && (query || ids("note").length) ? db.notePage.findMany({
        where: { userId, orgId: personalOrgId, ...(query ? { OR: [{ title: match }, { content: match }] } : { id: { in: ids("note") } }) },
        select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 8,
      }) : [],
    ]);
    const navigation = getNavigationItems(query);
    const items: WorkspaceSearchItem[] = [
      ...cards.map(card => ({ type: "card" as const, id: card.id, title: card.title, subtitle: `${card.list.board.title} · ${card.list.title}`, href: `/board/${encodeURIComponent(card.list.boardId)}?cardId=${encodeURIComponent(card.id)}` })),
      ...courses.map(course => ({ type: "course" as const, id: course.id, title: course.code ? `${course.code} · ${course.name}` : course.name, subtitle: course.board.title, href: `/board/${encodeURIComponent(course.boardId)}?course=${encodeURIComponent(course.id)}` })),
      ...notes.map(note => ({ type: "note" as const, id: note.id, title: note.title, subtitle: "Trang ghi chú riêng", href: `/pages/${encodeURIComponent(note.id)}` })),
      ...boards.map(board => ({ type: "board" as const, id: board.id, title: board.title, subtitle: "Bảng công việc", href: `/board/${encodeURIComponent(board.id)}` })),
    ];
    const recentItems = recent.flatMap(ref => {
      const item = [...items, ...navigation].find(item => item.type === ref.type && item.id === ref.id);
      return item ? [item] : [];
    });
    return Response.json({ items: query ? [...items, ...navigation] : recentItems, navigation: query ? [] : navigation.filter(item => !recentItems.some(recent => recent.type === item.type && recent.id === item.id)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[WORKSPACE_SEARCH]", error);
    return new Response("Chưa tìm kiếm được. Hãy thử lại.", { status: 500 });
  }
}
