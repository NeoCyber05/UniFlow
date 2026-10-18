import { Navigate, useParams, useSearchParams } from "react-router";

import type { loadBoardTodo } from "@/server/views/board-todo";
import { Skeleton } from "@/components/ui/skeleton";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadBoardTodo>>;

export default function BoardTodoRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  const qs = error ? `?error=${encodeURIComponent(error)}` : "";
  const { data } = useView<View>(`/board/${boardId}/todo${qs}`);

  if (!data) return <Skeleton className="m-4 h-64" />;
  return <Navigate to={data.redirect} replace />;
}
