import { lazy, Suspense, useState, type ComponentType } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { SignInPage, SignUpPage } from "./routes/auth-pages";

import { ModalProvider } from "@/components/providers/modal-provider";
import { ViewSkeleton, type ViewSkeletonVariant } from "@/components/view-skeleton";

import DashboardLayoutRoute from "./routes/dashboard-layout";
import BoardListRoute from "./routes/board-list";
import BoardLayoutRoute from "./routes/board-layout";
import MyRoute from "./routes/my";
import WorkspaceRoute from "./routes/workspace";
import { RedirectIfSignedIn, RequireAuth } from "./routes/guards";
import { boardTabRoutes, type RouteLoader } from "./lib/prefetch-route";

// The landing path (/my/today -> board list) stays in the main bundle; other routes load their chunk on first visit.
const lazyRoute = (load: () => Promise<{ default: ComponentType }>, skeleton?: ViewSkeletonVariant) => {
  const Route = lazy(load);
  return (
    <Suspense fallback={skeleton ? <ViewSkeleton variant={skeleton} /> : null}>
      <Route />
    </Suspense>
  );
};

// lazy() suspends on its first render even when the chunk is already preloaded, so a preloaded tab renders directly.
// The choice is fixed at mount: switching branches later would remount the tab. The fallback is the same skeleton
// the tabs show while their data loads, so a slow chunk never blanks the board.
const boardTab = (load: RouteLoader, skeleton: ViewSkeletonVariant) => {
  const Lazy = lazy(load);
  const Tab = () => {
    const [Loaded] = useState(() => load.loaded);
    if (Loaded) return <Loaded />;
    return (
      <Suspense fallback={<ViewSkeleton variant={skeleton} />}>
        <Lazy />
      </Suspense>
    );
  };
  return <Tab />;
};

const centered = (el: React.ReactNode) => <div className="min-h-screen min-h-dvh w-full flex items-center justify-center">{el}</div>;

// ModalProvider uses next/navigation shims, so it must render inside the router.
const Root = () => (
  <>
    <ModalProvider />
    <Outlet />
  </>
);

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      // Extension popup: handles its own sign-in so the pending request survives login.
      { path: "/capture", element: lazyRoute(() => import("./routes/capture")) },
      { path: "/capture/welcome", element: lazyRoute(() => import("./routes/capture-welcome")) },
      { path: "/privacy", element: lazyRoute(() => import("./routes/privacy")) },
      {
        element: <RedirectIfSignedIn />,
        children: [
          { path: "/", element: <Navigate to="/sign-in" replace /> },
          { path: "/sign-in", element: <SignInPage /> },
          { path: "/sign-up", element: <SignUpPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: "reminders/:deliveryId", element: centered(lazyRoute(() => import("./routes/reminder-delivery"))) },
          {
            element: <DashboardLayoutRoute />,
            children: [
              {
                path: "board/:boardId",
                element: <BoardLayoutRoute />,
                children: [
                  { index: true, element: boardTab(boardTabRoutes.kanban, "columns") },
                  { path: "calendar", element: boardTab(boardTabRoutes.calendar, "grid") },
                  { path: "list", element: <BoardListRoute /> },
                  { path: "timeline", element: boardTab(boardTabRoutes.timeline, "rows") },
                  { path: "graph", element: boardTab(boardTabRoutes.graph, "canvas") },
                  { path: "analytics", element: boardTab(boardTabRoutes.analytics, "panels") },
                  { path: "todo", element: boardTab(boardTabRoutes.todo, "rows") },
                ],
              },
              { path: "my/:view", element: <MyRoute /> },
              { path: "settings/appearance", element: lazyRoute(() => import("./routes/settings-appearance")) },
              {
                path: "pages",
                element: lazyRoute(() => import("./routes/pages").then((m) => ({ default: m.PagesLayoutRoute }))),
                children: [
                  { index: true, element: lazyRoute(() => import("./routes/pages")) },
                  { path: ":pageId", element: lazyRoute(() => import("./routes/page"), "doc") },
                ],
              },
              { path: "workspace/:workspaceId", element: <WorkspaceRoute /> },
            ],
          },
        ],
      },
    ],
  },
]);
