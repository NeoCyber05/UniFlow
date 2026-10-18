import { handleDisplayRequest } from "@/lib/notifications/push-display";

// Public by exact path (see PUBLIC_API): the service worker has no bearer token; the body carries a one-delivery capability.
export async function POST(req: Request) {
  return handleDisplayRequest(req);
}
