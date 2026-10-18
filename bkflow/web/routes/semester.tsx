import { Navigate, useParams } from "react-router";

import type { loadSemester } from "@/server/views/semester";

import { useView } from "../lib/use-view";
import NotFoundRoute from "./not-found";

type View = Awaited<ReturnType<typeof loadSemester>>;

export default function SemesterRoute() {
  const { semesterId = "" } = useParams<{ semesterId: string }>();
  const { data } = useView<View>(`/semester/${semesterId}`);

  if (!data) return null;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  return <NotFoundRoute />;
}
