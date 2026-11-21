import { Navigate, useParams } from "react-router";

import type { loadPage } from "@/server/views/pages";
import { NotePageEditor } from "@/components/notes/note-page-editor";
import { ViewLoadError, ViewSkeleton } from "@/components/view-skeleton";
import { tr } from "@/lib/i18n";

import { useTitle } from "../lib/use-title";
import { useView } from "../lib/use-view";
import { isUnavailableViewError } from "@/lib/fetcher";
import NotFoundRoute from "./not-found";

type View = Awaited<ReturnType<typeof loadPage>>;

export default function NotePageRoute() {
  const { pageId = "" } = useParams<{ pageId: string }>();
  const { data, isError, error, refetch } = useView<View>(`/pages/${pageId}`);
  useTitle(tr("route.titleNotes"));

  if (isError && (!data || isUnavailableViewError(error))) return <ViewLoadError retry={refetch} />;
  if (!data) return <ViewSkeleton variant="doc" />;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  if (data.notFound) return <NotFoundRoute />;

  return <NotePageEditor key={data.initialPage.id} initialPage={data.initialPage} />;
}
