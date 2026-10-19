import { createBrowserRouter, Outlet } from "react-router";
import { SignInPage, SignUpPage } from "./routes/auth-pages";

import { ModalProvider } from "@/components/providers/modal-provider";
import MarketingPage from "@/app/(marketing)/page";
import MarketingLayout from "@/app/(marketing)/layout";

import DashboardLayoutRoute from "./routes/dashboard-layout";
import BoardAnalyticsRoute from "./routes/board-analytics";
import BoardGraphRoute from "./routes/board-graph";
import BoardTodoRoute from "./routes/board-todo";
import BoardCalendarRoute from "./routes/board-calendar";
import BoardListRoute from "./routes/board-list";
import BoardSplitRoute from "./routes/board-split";
import BoardTimelineRoute from "./routes/board-timeline";
import BoardKanbanRoute from "./routes/board-kanban";
import BoardLayoutRoute from "./routes/board-layout";
import MyRoute from "./routes/my";
import PagesRoute, { PagesLayoutRoute } from "./routes/pages";
import NotePageRoute from "./routes/page";
import ReminderDeliveryRoute from "./routes/reminder-delivery";
import CaptureRoute from "./routes/capture";
import CaptureWelcomeRoute from "./routes/capture-welcome";
import PrivacyRoute from "./routes/privacy";
import SemesterRoute from "./routes/semester";
import SettingsAppearanceRoute from "./routes/settings-appearance";
import { RedirectIfSignedIn, RequireAuth } from "./routes/guards";

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
      { path: "/capture", element: <CaptureRoute /> },
      { path: "/capture/welcome", element: <CaptureWelcomeRoute /> },
      { path: "/privacy", element: <PrivacyRoute /> },
      {
        element: <RedirectIfSignedIn />,
        children: [
          { path: "/", element: <MarketingLayout><MarketingPage /></MarketingLayout> },
          { path: "/sign-in", element: <SignInPage /> },
          { path: "/sign-up", element: <SignUpPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: "reminders/:deliveryId", element: centered(<ReminderDeliveryRoute />) },
          {
            element: <DashboardLayoutRoute />,
            children: [
              {
                path: "board/:boardId",
                element: <BoardLayoutRoute />,
                children: [
                  { index: true, element: <BoardKanbanRoute /> },
                  { path: "calendar", element: <BoardCalendarRoute /> },
                  { path: "list", element: <BoardListRoute /> },
                  { path: "split", element: <BoardSplitRoute /> },
                  { path: "timeline", element: <BoardTimelineRoute /> },
                  { path: "graph", element: <BoardGraphRoute /> },
                  { path: "analytics", element: <BoardAnalyticsRoute /> },
                  { path: "todo", element: <BoardTodoRoute /> },
                ],
              },
              { path: "my/:view", element: <MyRoute /> },
              { path: "settings/appearance", element: <SettingsAppearanceRoute /> },
              {
                path: "pages",
                element: <PagesLayoutRoute />,
                children: [
                  { index: true, element: <PagesRoute /> },
                  { path: ":pageId", element: <NotePageRoute /> },
                ],
              },
              { path: "semester/:semesterId", element: <SemesterRoute /> },
            ],
          },
        ],
      },
    ],
  },
]);
