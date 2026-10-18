import { BoardMemberRole, BoardType } from "@prisma/client";

import { getOrSeedSemesters } from "@/lib/semesters-db";
import { getOrganizationMembers } from "@/lib/clerk-org-members";
import { getBoardCourses } from "@/lib/courses/board-courses";
import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

// Data of app/(platform)/(dashboard)/board/[boardId]/layout.tsx (incl. generateMetadata title).
export const loadBoardLayout = async ({ boardId }: { boardId: string }, userId: string, orgId: string | null) => {
  const currentMembership = await requireBoardMemberForUser({ boardId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    return { redirect: `/organization/${orgId ?? ""}?error=${encodeURIComponent(errorMessage)}` } as const;
  }

  const boardOrgId = currentMembership.membership.board.orgId;

  const [board, organizationMembers] = await Promise.all([
    db.board.findUnique({
      where: {
        id: boardId,
      },
      include: {
        members: {
          orderBy: {
            createdAt: "asc",
          },
        },
        labels: {
          orderBy: {
            createdAt: "asc",
          },
        },
        lists: {
          where: {
            archivedAt: null,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    }),
    getOrganizationMembers(boardOrgId),
  ]);

  if (!board) {
    return { notFound: true } as const;
  }

  const isSemesterBoard = board.boardType === BoardType.SEMESTER;
  const [semesters, courses] = isSemesterBoard
    ? await Promise.all([getOrSeedSemesters(boardOrgId), getBoardCourses(boardId)])
    : [[], []];
  const canEdit = currentMembership.membership.role !== BoardMemberRole.VIEWER;

  const effectiveOrgMembers = organizationMembers.length > 0
    ? organizationMembers
    : board.members.map((m) => ({
        userId: m.userId,
        name: m.userName,
        imageUrl: m.userImage,
        email: m.userEmail,
      }));

  return {
    title: board.title || "Bảng",
    boardId,
    board,
    boardOrgId,
    semesters,
    courses,
    canEdit,
    isSemesterBoard,
    effectiveOrgMembers,
    currentUserId: userId,
    currentMemberRole: currentMembership.membership.role,
  } as const;
};
