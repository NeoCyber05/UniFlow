import { Navigate, useParams } from "react-router";

import type { loadWorkspace } from "@/server/views/workspace";

import { useView } from "../lib/use-view";
import NotFoundRoute from "./not-found";

type View = Awaited<ReturnType<typeof loadWorkspace>>;

export default function WorkspaceRoute() {
  const { workspaceId = "" } = useParams<{ workspaceId: string }>();
  const { data } = useView<View>(`/workspace/${workspaceId}`);

  if (!data) return null;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  return <NotFoundRoute />;
}
