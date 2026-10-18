import type { Card, CardLabel, Label, List, Prisma } from "@prisma/client";

export type CardWithAssignees = Card & {
  assignees: any[];
  labels: (CardLabel & {
    label: Label;
  })[];
  checklists?: {
    items: { isCompleted: boolean }[];
  }[];
  checklistProgress?: {
    total: number;
    completed: number;
  };
  unresolvedBlockerCount?: number;
  /** ⭐ của user hiện tại */
  isImportant?: boolean;
  _count?: {
    comments: number;
    attachments: number;
  };
};

export const BoardMemberRole = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
  VIEWER: "VIEWER",
} as const;
export type BoardMemberRole = (typeof BoardMemberRole)[keyof typeof BoardMemberRole];

export type BoardMember = {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  userEmail?: string | null;
  role: BoardMemberRole;
  boardId?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CardAssignee = {
  id: string;
  cardId: string;
  boardMemberId: string;
  createdAt: Date;
  updatedAt: Date;
  boardMember?: BoardMember;
};

export type ListWithCards = List & { cards: CardWithAssignees[] };

