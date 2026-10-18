import { auth } from "@/server/auth";

import { resolveDeliveryTarget } from "@/lib/notifications/push-display";

export async function GET(_req: Request, { params }: { params: Promise<{ deliveryId: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const target = await resolveDeliveryTarget(userId, (await params).deliveryId);
  return target ? Response.json(target) : new Response("Not Found", { status: 404 });
}
