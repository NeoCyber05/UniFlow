import { Navigate, useParams, useSearchParams } from "react-router";

import type { loadMy } from "@/server/views/my";
import { NoSemesterState } from "@/components/my-tasks/no-semester-state";
import { PersonalWorkspaceView } from "@/components/my-tasks/personal-workspace-view";
import { SidebarShell } from "@/app/(platform)/(dashboard)/_components/sidebar-shell";

import { useTitle } from "../lib/use-title";
import { useView } from "../lib/use-view";
import NotFoundRoute from "./not-found";

type View = Awaited<ReturnType<typeof loadMy>>;

// my/layout.tsx (SidebarShell) + my/[view]/page.tsx.
export default function MyRoute() {
  const { view = "" } = useParams<{ view: string }>();
  const error = useSearchParams()[0].get("error") ?? undefined;
  const { data } = useView<View>(`/my/${view}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
  useTitle("Không gian cá nhân");

  return <SidebarShell>{render(data)}</SidebarShell>;
}

const render = (data: View | undefined) => {
  if (!data) return null;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  if (data.notFound) return <NotFoundRoute />;
  if (!data.context) return <NoSemesterState />;

  return (
    <PersonalWorkspaceView
      key={`${data.boardId}:${data.view}`}
      view={data.view}
      initialContext={data.context}
      initialData={data.data}
      initialNow={data.now}
      canEdit={data.canEdit}
      error={data.error}
    />
  );
};
