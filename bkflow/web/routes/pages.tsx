import { Outlet } from "react-router";

import { NotePagesList } from "@/components/notes/note-pages-list";
import { SidebarShell } from "@/app/(platform)/(dashboard)/_components/sidebar-shell";
import { tr } from "@/lib/i18n";

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
  useTitle(tr("route.titleMyPages"));
  return <NotePagesList />;
}
