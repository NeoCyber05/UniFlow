import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { SignInPage, SignUpPage } from "./routes/auth-pages";

import { ModalProvider } from "@/components/providers/modal-provider";

import DashboardLayoutRoute from "./routes/dashboard-layout";
import BoardListRoute from "./routes/board-list";
import BoardLayoutRoute from "./routes/board-layout";
import MyRoute from "./routes/my";
import WorkspaceRoute from "./routes/workspace";
import { RedirectIfSignedIn, RequireAuth } from "./routes/guards";

// The landing path (/my/today -> board list) stays in the main bundle; other routes load their chunk on first visit.
const lazyRoute = (load: () => Promise<{ default: ComponentType }>) => {
  const Route = lazy(load);
  return (
    <Suspense fallback={null}>
      <Route />
    </Suspense>
  );
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
                  { index: true, element: lazyRoute(() => import("./routes/board-kanban")) },
                  { path: "calendar", element: lazyRoute(() => import("./routes/board-calendar")) },
                  { path: "list", element: <BoardListRoute /> },
                  { path: "timeline", element: lazyRoute(() => import("./routes/board-timeline")) },
                  { path: "graph", element: lazyRoute(() => import("./routes/board-graph")) },
                  { path: "analytics", element: lazyRoute(() => import("./routes/board-analytics")) },
                  { path: "todo", element: lazyRoute(() => import("./routes/board-todo")) },
                ],
              },
              { path: "my/:view", element: <MyRoute /> },
              { path: "settings/appearance", element: lazyRoute(() => import("./routes/settings-appearance")) },
              {
                path: "pages",
                element: lazyRoute(() => import("./routes/pages").then((m) => ({ default: m.PagesLayoutRoute }))),
                children: [
                  { index: true, element: lazyRoute(() => import("./routes/pages")) },
                  { path: ":pageId", element: lazyRoute(() => import("./routes/page")) },
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
