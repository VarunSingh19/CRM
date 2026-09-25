import { getSettings } from "@/features/settings/settings.service";
import { serialize } from "@/lib/serialize";
import SettingsView from "@/components/views/SettingsView";

export default async function SettingsPage() {
  const settings = await getSettings();
  return <SettingsView initial={serialize(settings) as Record<string, string>} />;
}
