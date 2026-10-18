import { Hono } from "hono";

import { auth } from "../clerk";
import { loadBoardAnalytics } from "./board-analytics";
import { loadBoardCalendar } from "./board-calendar";
import { loadBoardGraph } from "./board-graph";
import { loadBoardList } from "./board-list";
import { loadBoardSplit } from "./board-split";
import { loadBoardTimeline } from "./board-timeline";
import { loadBoardTodo } from "./board-todo";
import { loadBoardKanban } from "./board-kanban";
import { loadBoardLayout } from "./board-layout";
import { loadDashboard } from "./dashboard";
import { json } from "./json";
import { loadMy } from "./my";
import { loadPage } from "./pages";
import { loadSemester } from "./semester";
import { loadOrganization } from "./organization";
import { loadOrganizationActivity } from "./organization-activity";
import { loadOrganizationLayout } from "./organization-layout";
import { loadOrganizationSettings } from "./organization-settings";

export const viewsRoute = new Hono()
  .get("/dashboard", async () => {
    const { userId } = await auth();
    return json(await loadDashboard(userId));
  })
  .get("/board/:boardId/layout", async (c) => {
    const { userId, orgId } = await auth();
    if (!userId) return json({ redirect: "/select-org" });
    return json(await loadBoardLayout({ boardId: c.req.param("boardId") }, userId, orgId));
  })
  .get("/board/:boardId/calendar", async (c) => {
    const { userId, orgId } = await auth();
    if (!userId) return json({ redirect: "/select-org" });
    return json(await loadBoardCalendar({ boardId: c.req.param("boardId") }, userId, orgId));
  })
  .get("/board/:boardId/list", async (c) => {
    const { userId, orgId } = await auth();
    if (!userId) return json({ redirect: "/select-org" });
    return json(await loadBoardList({ boardId: c.req.param("boardId") }, userId, orgId));
  })
  .get("/board/:boardId/split", async (c) => {
    const { userId, orgId } = await auth();
    if (!userId) return json({ redirect: "/select-org" });
    return json(await loadBoardSplit({ boardId: c.req.param("boardId") }, userId, orgId));
  })
  .get("/board/:boardId/timeline", async (c) => {
    const { userId, orgId } = await auth();
    if (!userId) return json({ redirect: "/select-org" });
    return json(await loadBoardTimeline({ boardId: c.req.param("boardId") }, userId, orgId));
  })
  .get("/board/:boardId/graph", async (c) => {
    const { userId, orgId } = await auth();
    if (!userId) return json({ redirect: "/select-org" });
    return json(await loadBoardGraph({ boardId: c.req.param("boardId") }, userId, orgId));
  })
  .get("/board/:boardId/analytics", async (c) => {
    const { userId, orgId } = await auth();
    if (!userId) return json({ redirect: "/select-org" });
    return json(await loadBoardAnalytics({ boardId: c.req.param("boardId") }, userId, orgId));
  })
  .get("/board/:boardId/todo", async (c) => {
    const { userId } = await auth();
    if (!userId) return json({ redirect: "/select-org" });
    return json(await loadBoardTodo({ boardId: c.req.param("boardId"), error: c.req.query("error") }));
  })
  .get("/board/:boardId", async (c) => {
    const { userId, orgId } = await auth();
    if (!userId) return json({ redirect: "/select-org" });
    return json(await loadBoardKanban({ boardId: c.req.param("boardId") }, userId, orgId));
  })
  .get("/organization/:organizationId/layout", async (c) => {
    const { orgId } = await auth();
    return json(await loadOrganizationLayout(c.req.param("organizationId"), orgId));
  })
  .get("/organization/:organizationId/activity", async (c) => {
    const { userId, orgId } = await auth();
    return json(await loadOrganizationActivity(c.req.query(), userId, orgId));
  })
  .get("/organization/:organizationId/settings", async (c) => {
    const { userId } = await auth();
    const rest = c.req.query("rest")?.split("/").filter(Boolean);
    return json(await loadOrganizationSettings({ organizationId: c.req.param("organizationId"), rest }, userId));
  })
  .get("/organization/:organizationId", async (c) => {
    const { userId } = await auth();
    return json(await loadOrganization({ organizationId: c.req.param("organizationId"), error: c.req.query("error") }, userId));
  })
  .get("/my/:view", async (c) => {
    const { userId } = await auth();
    return json(await loadMy({ view: c.req.param("view"), error: c.req.query("error") }, userId));
  })
  .get("/pages/:pageId", async (c) => {
    const { userId } = await auth();
    return json(await loadPage({ pageId: c.req.param("pageId") }, userId));
  })
  .get("/semester/:semesterId", async (c) => {
    const { userId, orgId } = await auth();
    return json(await loadSemester({ semesterId: c.req.param("semesterId") }, userId, orgId));
  });
