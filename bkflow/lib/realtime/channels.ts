export const REALTIME_CHANNEL_PREFIX = "private" as const;

export const realtimeChannels = {
  board: (boardId: string) =>
    `${REALTIME_CHANNEL_PREFIX}-board-${boardId}` as const,
  card: (cardId: string) =>
    `${REALTIME_CHANNEL_PREFIX}-card-${cardId}` as const,
  user: (userId: string) =>
    `${REALTIME_CHANNEL_PREFIX}-user-${userId}` as const,
};

export type RealtimeChannelName =
  | ReturnType<typeof realtimeChannels.board>
  | ReturnType<typeof realtimeChannels.card>
  | ReturnType<typeof realtimeChannels.user>;

export type RealtimeChannelScope =
  | {
      type: "board";
      boardId: string;
    }
  | {
      type: "card";
      cardId: string;
    }
  | {
      type: "user";
      userId: string;
    };

export const parseRealtimeChannelName = (
  channelName: string,
): RealtimeChannelScope | null => {
  const match = channelName.match(/^private-(board|card|user)-(.+)$/);

  if (!match) {
    return null;
  }

  const [, type, id] = match;

  if (!id) {
    return null;
  }

  if (type === "board") {
    return {
      type,
      boardId: id,
    };
  }

  if (type === "card") {
    return {
      type,
      cardId: id,
    };
  }

  return {
    type: "user",
    userId: id,
  };
};
