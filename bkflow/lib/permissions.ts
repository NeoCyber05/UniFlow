import { cache } from "react";
import { db } from "@/lib/db";

export const BOARD_MEMBER_REQUIRED_ERROR = "Bạn không phải là thành viên của bảng này.";
export const BOARD_ADMIN_REQUIRED_ERROR = "Chỉ quản trị viên mới có thể thực hiện hành động này.";
export const BOARD_EDITOR_REQUIRED_ERROR = "Bạn chỉ có quyền xem bảng này.";

type BoardPermissionInput = {
  boardId: string;
  orgId?: string;
  userId: string;
};

type BoardUserPermissionInput = {
  boardId: string;
  userId: string;
};

export type BoardOwnershipMembership = {
  id: string;
  userId: string;
  role: "ADMIN";
  board: {
    id: string;
    title: string;
    userId: string;
  };
};

export const checkBoardOwnership = async (
  boardId: string,
  userId: string,
  database = db,
): Promise<{ error: string | null; membership: BoardOwnershipMembership | null }> => {
  const board = await (database as typeof db).board.findFirst({
    where: {
      id: boardId,
      userId,
    },
    select: {
      id: true,
      title: true,
      userId: true,
    },
  });

  if (!board) {
    return {
      error: BOARD_MEMBER_REQUIRED_ERROR,
      membership: null,
    };
  }

  return {
    error: null,
    membership: {
      id: `owner_${userId}`,
      userId,
      role: "ADMIN",
      board,
    },
  };
};

export const getBoardMembership = cache(async (
  boardId: string,
  _orgId: string,
  userId: string,
) => {
  const result = await checkBoardOwnership(boardId, userId);
  return result.membership;
});

export const requireBoardMember = async (input: BoardPermissionInput) => {
  return checkBoardOwnership(input.boardId, input.userId);
};

export const getBoardMembershipForUser = cache(async (
  boardId: string,
  userId: string,
) => {
  const result = await checkBoardOwnership(boardId, userId);
  return result.membership;
});

export const requireBoardMemberForUser = async (input: BoardUserPermissionInput) => {
  return checkBoardOwnership(input.boardId, input.userId);
};

export const requireBoardEditorForUser = async (input: BoardUserPermissionInput) => {
  return checkBoardOwnership(input.boardId, input.userId);
};

export const requireBoardAdmin = async (input: BoardPermissionInput) => {
  return checkBoardOwnership(input.boardId, input.userId);
};

export const requireBoardEditor = async (input: BoardPermissionInput) => {
  return checkBoardOwnership(input.boardId, input.userId);
};

export const isBoardAdmin = (_role?: string) => true;
export const isBoardEditor = (_role?: string) => true;
