import { Navigate, useParams, useSearchParams } from "react-router";

export default function BoardTodoRoute() {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  const query = new URLSearchParams({ group: "agenda" });
  if (error) query.set("error", error);
  return <Navigate to={`/board/${boardId}/list?${query}`} replace />;
}
