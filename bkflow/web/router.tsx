import { createBrowserRouter, Outlet } from "react-router";
import { SignIn, SignUp } from "@clerk/react";

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
import OrganizationActivityRoute from "./routes/organization-activity";
import OrganizationLayoutRoute from "./routes/organization-layout";
import OrganizationRoute from "./routes/organization";
import OrganizationSettingsRoute from "./routes/organization-settings";
import MyRoute from "./routes/my";
import PagesRoute, { PagesLayoutRoute } from "./routes/pages";
import NotePageRoute from "./routes/page";
import SemesterRoute from "./routes/semester";
import SelectOrgRoute from "./routes/select-org";
import { RedirectIfSignedIn, RequireAuth } from "./routes/guards";

const centered = (el: React.ReactNode) => <div className="h-full flex items-center justify-center">{el}</div>;

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
      {
        element: <RedirectIfSignedIn />,
        children: [
          { path: "/", element: <MarketingLayout><MarketingPage /></MarketingLayout> },
          { path: "/sign-in/*", element: centered(<SignIn routing="path" path="/sign-in" />) },
          { path: "/sign-up/*", element: centered(<SignUp routing="path" path="/sign-up" />) },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: "/select-org/*", element: <SelectOrgRoute /> },
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
              {
                path: "organization/:organizationId",
                element: <OrganizationLayoutRoute />,
                children: [
                  { index: true, element: <OrganizationRoute /> },
                  { path: "activity", element: <OrganizationActivityRoute /> },
                  { path: "settings/*", element: <OrganizationSettingsRoute /> },
                ],
              },
              { path: "my/:view", element: <MyRoute /> },
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
