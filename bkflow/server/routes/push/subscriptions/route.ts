import { auth } from "@/server/auth";

import { logger } from "@/lib/logger";
import {
  getPushSubscriptionStatus,
  revokePushSubscription,
  upsertPushSubscription,
} from "@/lib/notifications/push-subscriptions";

const readJson = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return null;
  }
};

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const id = new URL(req.url).searchParams.get("subscriptionId");
  return Response.json(id ? await getPushSubscriptionStatus(userId, id) : { active: false });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  try {
    const result = await upsertPushSubscription(userId, await readJson(req));
    if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
    return Response.json(result.data);
  } catch (error) {
    logger.error("[PUSH_SUBSCRIPTION_POST_ERROR]", error, { route: "/api/push/subscriptions" });
    return new Response("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await readJson(req)) as { subscriptionId?: unknown } | null;
  if (typeof body?.subscriptionId !== "string") return new Response("Bad Request", { status: 400 });

  try {
    // Not-owned ids also answer 204 so callers cannot probe other accounts' subscriptions.
    await revokePushSubscription(userId, body.subscriptionId);
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error("[PUSH_SUBSCRIPTION_DELETE_ERROR]", error, { route: "/api/push/subscriptions" });
    return new Response("Internal Error", { status: 500 });
  }
}
