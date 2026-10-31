import { AppearanceSettings } from "@/components/appearance-settings";
import { tr } from "@/lib/i18n";
import { useTitle } from "../lib/use-title";

export default function SettingsAppearanceRoute() {
  useTitle(tr("route.titleAppearance"));
  return <AppearanceSettings />;
}
