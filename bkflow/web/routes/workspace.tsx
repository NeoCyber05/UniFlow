import { Navigate, useParams } from "react-router";

import type { loadWorkspace } from "@/server/views/workspace";
import { ViewLoadError, ViewSkeleton } from "@/components/view-skeleton";

import { useView } from "../lib/use-view";
import { isUnavailableViewError } from "@/lib/fetcher";
import NotFoundRoute from "./not-found";

type View = Awaited<ReturnType<typeof loadWorkspace>>;

export default function WorkspaceRoute() {
  const { workspaceId = "" } = useParams<{ workspaceId: string }>();
  const { data, isError, error, refetch } = useView<View>(`/workspace/${workspaceId}`);

  if (isError && (!data || isUnavailableViewError(error))) return <ViewLoadError retry={refetch} className="pt-18" />;
  if (!data) return <ViewSkeleton variant="rows" className="pt-18" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  return <NotFoundRoute />;
}
