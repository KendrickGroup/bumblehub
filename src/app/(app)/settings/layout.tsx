import { SettingsGate } from "@/components/house-mode/SettingsGate";
import { SettingsShell } from "@/components/settings/SettingsShell";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SettingsGate>
      <SettingsShell>{children}</SettingsShell>
    </SettingsGate>
  );
}
