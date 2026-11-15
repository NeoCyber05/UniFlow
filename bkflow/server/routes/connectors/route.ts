import { auth } from "@/server/auth";

import {
  authorizeApp, composioConfigured, connectedApps, CONNECTOR_APPS, disconnectApp, isConnectorApp,
} from "@/lib/connectors/composio";
import { logger } from "@/lib/logger";

const ROUTE = "/api/connectors";
const fail = (error: string, status: number) => Response.json({ error }, { status });

const readApp = async (req: Request) => {
  const app = ((await req.json().catch(() => null)) as { app?: unknown } | null)?.app;
  return isConnectorApp(app) ? app : null;
};

/** Trạng thái kết nối Gmail/Slack của người dùng hiện tại. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!composioConfigured()) {
    return Response.json({ configured: false, apps: Object.fromEntries(CONNECTOR_APPS.map((app) => [app, false])) });
  }
  try {
    return Response.json({ configured: true, apps: await connectedApps(userId) });
  } catch (error) {
    logger.error("[CONNECTORS_STATUS_ERROR]", error, { route: ROUTE });
    return fail("Không tải được trạng thái kết nối.", 502);
  }
}

/** Trả link OAuth để người dùng tự đăng nhập app trong tab mới. */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!composioConfigured()) return fail("Máy chủ chưa cấu hình kết nối ứng dụng.", 503);
  const app = await readApp(req);
  if (!app) return fail("Ứng dụng không được hỗ trợ.", 400);
  try {
    return Response.json({ url: await authorizeApp(userId, app) });
  } catch (error) {
    logger.error("[CONNECTORS_AUTHORIZE_ERROR]", error, { route: ROUTE });
    return fail("Không tạo được liên kết kết nối.", 502);
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!composioConfigured()) return fail("Máy chủ chưa cấu hình kết nối ứng dụng.", 503);
  const app = await readApp(req);
  if (!app) return fail("Ứng dụng không được hỗ trợ.", 400);
  try {
    await disconnectApp(userId, app);
    return Response.json({ ok: true });
  } catch (error) {
    logger.error("[CONNECTORS_DISCONNECT_ERROR]", error, { route: ROUTE });
    return fail("Không ngắt được kết nối.", 502);
  }
}
