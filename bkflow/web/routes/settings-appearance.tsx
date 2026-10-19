import { AppearanceSettings } from "@/components/appearance-settings";
import { useTitle } from "../lib/use-title";

export default function SettingsAppearanceRoute() {
  useTitle("Giao diện");
  return <AppearanceSettings />;
}
