import { Outlet } from "react-router";

import { NotePagesList } from "@/components/notes/note-pages-list";
import { SidebarShell } from "@/app/(platform)/(dashboard)/_components/sidebar-shell";

import { useTitle } from "../lib/use-title";

// pages/layout.tsx (SidebarShell).
export function PagesLayoutRoute() {
  return (
    <SidebarShell>
      <Outlet />
    </SidebarShell>
  );
}

// pages/page.tsx (pure client list).
export default function PagesRoute() {
  useTitle("Trang của tôi");
  return <NotePagesList />;
}
