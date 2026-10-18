
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await db.$queryRaw`SELECT 1`;

    return Response.json({
      status: "ok",
      database: "ok",
      timestamp,
    });
  } catch (error) {
    logger.error("[HEALTHCHECK_DATABASE_ERROR]", error, {
      route: "/api/health",
      action: "healthcheck",
    });

    return Response.json(
      {
        status: "degraded",
        database: "error",
        timestamp,
      },
      { status: 503 },
    );
  }
}
