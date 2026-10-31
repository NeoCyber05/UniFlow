import { BoardMember, BoardMemberRole } from "@/types";

import type { CardWithAssignees, ListWithCards } from "@/types";

export type ListContainerProps = {
  data: ListWithCards[];
  boardId: string;
  boardMembers: BoardMember[];
  currentUserId: string;
  currentMemberRole: BoardMemberRole;
  enableCalendarDragHandle?: boolean;
};

export type CardContextMenuPosition = {
  top: number;
  left: number;
  /** CSS transform-origin on the card's side, so the menu grows out of the card. */
  origin?: string;
};

export type CardContextMenuProps = {
  isOpen: boolean;
  canEdit: boolean;
  position: CardContextMenuPosition;
  isLoadingArchive: boolean;
  onClose: () => void;
  onOpen: (event?: React.MouseEvent) => void;
  onRename: (event: React.MouseEvent) => void;
  onCopy: (event: React.MouseEvent) => void;
  onArchive: (event: React.MouseEvent) => void;
};

export type CardBadgesProps = {
  card: CardWithAssignees;
};
