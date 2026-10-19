import { Navigate, useParams } from "react-router";

import type { loadPage } from "@/server/views/pages";
import { NotePageEditor } from "@/components/notes/note-page-editor";

import { useTitle } from "../lib/use-title";
import { useView } from "../lib/use-view";
import NotFoundRoute from "./not-found";

type View = Awaited<ReturnType<typeof loadPage>>;

export default function NotePageRoute() {
  const { pageId = "" } = useParams<{ pageId: string }>();
  const { data } = useView<View>(`/pages/${pageId}`);
  useTitle("Ghi chú");

  if (!data) return null;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  if (data.notFound) return <NotFoundRoute />;

  return <NotePageEditor key={data.initialPage.id} initialPage={data.initialPage} />;
}
