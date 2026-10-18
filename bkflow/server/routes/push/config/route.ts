import { auth } from "@/server/auth";

import { getVapidConfig } from "@/lib/notifications/push-delivery";

// Public key only; null means push is not configured, so the UI shows "unavailable".
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  return Response.json({ publicKey: getVapidConfig()?.publicKey ?? null });
}
