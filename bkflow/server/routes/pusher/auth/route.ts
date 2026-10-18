import { auth } from "@/server/auth";

import { parseRealtimeChannelName } from "@/lib/realtime/channels";
import { getServerPusher } from "@/lib/realtime/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const parsePusherAuthRequest = async (req: Request) => {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as unknown;

    if (
      typeof body === "object" &&
      body !== null &&
      "socket_id" in body &&
      "channel_name" in body
    ) {
      const socketId = body.socket_id;
      const channelName = body.channel_name;

      if (typeof socketId === "string" && typeof channelName === "string") {
        return {
          socketId,
          channelName,
        };
      }
    }
  }

  const formData = await req.formData();
  const socketId = formData.get("socket_id");
  const channelName = formData.get("channel_name");

  if (typeof socketId !== "string" || typeof channelName !== "string") {
    return null;
  }

  return {
    socketId,
    channelName,
  };
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const request = await parsePusherAuthRequest(req);

    if (!request) {
      return new Response("Invalid Pusher auth request", { status: 400 });
    }

    const channelScope = parseRealtimeChannelName(request.channelName);

    if (!channelScope) {
      return new Response("Unsupported realtime channel", { status: 403 });
    }

    if (channelScope.type === "user" && channelScope.userId !== userId) {
      return new Response("Forbidden", { status: 403 });
    }

    if (channelScope.type === "board") {
      const board = await db.board.findFirst({
        where: {
          id: channelScope.boardId,
          orgId: userId,
        },
        select: {
          id: true,
        },
      });

      if (!board) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    if (channelScope.type === "card") {
      const card = await db.card.findFirst({
        where: {
          id: channelScope.cardId,
          archivedAt: null,
          list: {
            archivedAt: null,
            board: {
              orgId: userId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!card) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    const authResponse = getServerPusher().authorizeChannel(
      request.socketId,
      request.channelName,
    );

    return Response.json(authResponse);
  } catch (error) {
    logger.error("[PUSHER_AUTH_ERROR]", error, {
      route: "/api/pusher/auth",
      action: "pusher-auth",
    });

    return new Response("Internal Error", { status: 500 });
  }
}
