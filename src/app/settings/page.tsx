import SettingsShell from "@/components/settings/SettingsShell";

// Keep SSR/RSC free of Supabase work. SettingsShell validates the browser session
// before exposing account controls.
export default function SettingsPage() {
  return <SettingsShell />;
}
