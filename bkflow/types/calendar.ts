export type BoardCalendarCardItem = {
  type: "card";
  id: string;
  cardId: string;
  boardId: string;
  listId: string;
  listTitle: string;
  courseId?: string | null;
  /** ⭐ của user hiện tại */
  isImportant?: boolean;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  deadlineOn: string | null;
  scheduledOn: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  /** Chỉ client: hạn nộp dạng thời điểm (dueDate hoặc cuối ngày hạn); startDate/dueDate sau khi qua adapter là mốc hiển thị. */
  deadlineAt?: string | null;
  /** Chỉ client: hiển thị này là buổi làm, hạn nộp hay mốc bắt đầu cũ (một card có thể sinh nhiều hiển thị). */
  displayKind?: "work" | "deadline" | "legacy-start";
  /** Card.updatedAt (ISO), dùng làm expectedUpdatedAt khi sửa metadata. */
  updatedAt: string;
  isCompleted: boolean;
  reminder: string | null;
  labels: {
    id: string;
    title: string;
    color: string;
  }[];
  assignees: {
    id: string;
    boardMemberId: string;
    userId: string;
    userName: string;
    userImage: string;
  }[];
  commentCount: number;
};

export type BoardCalendarChecklistItem = {
  type: "checklist-item";
  id: string;
  checklistItemId: string;
  checklistId: string;
  checklistTitle: string;
  cardId: string;
  cardTitle: string;
  boardId: string;
  listId: string;
  listTitle: string;
  courseId?: string | null;
  /** ⭐ của user hiện tại */
  isImportant?: boolean;
  title: string;
  dueDate: string;
  isCompleted: boolean;
  assignee: {
    id: string;
    boardMemberId: string;
    userId: string;
    userName: string;
    userImage: string;
  } | null;
  labels: {
    id: string;
    title: string;
    color: string;
  }[];
};

export type BoardCalendarItem =
  | BoardCalendarCardItem
  | BoardCalendarChecklistItem;

export type BoardCalendarUnscheduledCard = {
  type: "unscheduled-card";
  id: string;
  cardId: string;
  boardId: string;
  listId: string;
  listTitle: string;
  courseId?: string | null;
  /** ⭐ của user hiện tại */
  isImportant?: boolean;
  dueDate?: string | null;
  deadlineOn?: string | null;
  title: string;
  updatedAt: string;
  isCompleted: boolean;
  labels: {
    id: string;
    title: string;
    color: string;
  }[];
  assignees: {
    id: string;
    boardMemberId: string;
    userId: string;
    userName: string;
    userImage: string;
  }[];
  commentCount: number;
  order: number;
  listOrder: number;
};

export type BoardCalendarResponse = {
  boardId: string;
  from: string;
  to: string;
  items: BoardCalendarItem[];
  unscheduledCards: BoardCalendarUnscheduledCard[];
};
