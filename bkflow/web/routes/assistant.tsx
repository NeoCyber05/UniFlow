import { SidebarShell } from "@/app/(platform)/(dashboard)/_components/sidebar-shell";
import { AssistantPage } from "@/components/assistant/assistant-page";
import { tr } from "@/lib/i18n";

import { useTitle } from "../lib/use-title";

// /assistant và /assistant/:threadId: trang Trợ lý cá nhân.
export default function AssistantRoute() {
  useTitle(tr("assistant.title"));
  return (
    <SidebarShell fullBleed>
      <AssistantPage />
    </SidebarShell>
  );
}
