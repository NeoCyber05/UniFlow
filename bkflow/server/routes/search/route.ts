import { auth } from "@/server/auth";
import { parseRecentItems } from "@/lib/search/workspace-search";
import { searchWorkspace } from "@/lib/search/workspace-search-server";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const recent = parseRecentItems(new URL(request.url).searchParams.get("recent"));
  try {
    return Response.json(await searchWorkspace(userId, query, recent), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[WORKSPACE_SEARCH]", error);
    return new Response("Chưa tìm kiếm được. Hãy thử lại.", { status: 500 });
  }
}
