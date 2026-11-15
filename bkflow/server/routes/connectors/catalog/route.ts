import { auth } from "@/server/auth";

import { loadConnectorCatalog } from "@/lib/connectors/catalog";

/** Danh mục ứng dụng (metadata, chỉ đọc). Trạng thái kết nối của user nằm ở /api/connectors. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  return Response.json(await loadConnectorCatalog());
}
