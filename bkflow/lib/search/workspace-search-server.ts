import "server-only";

import type { BoardType } from "@prisma/client";
import { db } from "@/lib/db";
import { getNavigationItems, workspaceBoardScope, type WorkspaceSearchItem, type SearchReference } from "./workspace-search";

const boardPath = (id: string, type: BoardType) => `/board/${encodeURIComponent(id)}${type === "WORKSPACE" ? "/list" : ""}`;

export const searchWorkspace = async (userId: string, query: string, recent: SearchReference[] = []) => {
  const ids = (type: SearchReference["type"]) => recent.filter(item => item.type === type).map(item => item.id);
  const boardScope = workspaceBoardScope(userId);
  const match = { contains: query, mode: "insensitive" as const };
  const [cards, courses, boards, notes] = await Promise.all([
    query || ids("card").length ? db.card.findMany({
      where: { archivedAt: null, list: { archivedAt: null, board: boardScope }, ...(query ? { OR: [{ title: match }, { description: match }] } : { id: { in: ids("card") } }) },
      select: { id: true, title: true, list: { select: { title: true, boardId: true, board: { select: { title: true, boardType: true } } } } },
      orderBy: { updatedAt: "desc" }, take: 10,
    }) : [],
    query || ids("course").length ? db.course.findMany({
      where: { board: boardScope, ...(query ? { OR: [{ name: match }, { code: match }] } : { id: { in: ids("course") } }) },
      select: { id: true, name: true, code: true, boardId: true, board: { select: { title: true, boardType: true } } },
      orderBy: { name: "asc" }, take: 8,
    }) : [],
    query || ids("board").length ? db.board.findMany({
      where: { ...boardScope, ...(query ? { title: match } : { id: { in: ids("board") } }) },
      select: { id: true, title: true, boardType: true }, orderBy: { updatedAt: "desc" }, take: 6,
    }) : [],
    query || ids("note").length ? db.notePage.findMany({
      where: { userId, deletedAt: null, ...(query ? { OR: [{ title: match }, { content: match }] } : { id: { in: ids("note") } }) },
      select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 8,
    }) : [],
  ]);
  const navigation = getNavigationItems(query);
  const items: WorkspaceSearchItem[] = [
    ...cards.map(card => {
      const { board, boardId, title: listTitle } = card.list;
      const detailParam = board.boardType === "WORKSPACE" ? "task" : "cardId";
      return {
        type: "card" as const, id: card.id, title: card.title, subtitle: `${board.title} · ${listTitle}`,
        href: `${boardPath(boardId, board.boardType)}?${detailParam}=${encodeURIComponent(card.id)}`,
      };
    }),
    ...courses.map(course => ({ type: "course" as const, id: course.id, title: course.code ? `${course.code} · ${course.name}` : course.name, subtitle: course.board.title, href: `${boardPath(course.boardId, course.board.boardType)}?course=${encodeURIComponent(course.id)}` })),
    ...notes.map(note => ({ type: "note" as const, id: note.id, title: note.title, subtitle: "Trang ghi chú riêng", href: `/pages/${encodeURIComponent(note.id)}` })),
    ...boards.map(board => ({ type: "board" as const, id: board.id, title: board.title, subtitle: "Bảng công việc", href: boardPath(board.id, board.boardType) })),
  ];
  const recentItems = recent.flatMap(ref => {
    const item = [...items, ...navigation].find(item => item.type === ref.type && item.id === ref.id);
    return item ? [item] : [];
  });
  return { items: query ? [...items, ...navigation] : recentItems, navigation: query ? [] : navigation.filter(item => !recentItems.some(recent => recent.type === item.type && recent.id === item.id)) };
};
