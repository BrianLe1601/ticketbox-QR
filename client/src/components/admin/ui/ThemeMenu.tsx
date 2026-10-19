import { Clock3, Moon, Sun } from "lucide-react";

import { themeSummary, type ThemeMode, type ThemePreference } from "@/lib/ticketbox-theme";
import { Button } from "./Button";
import { RadioMenu } from "./Menu";
import { SegmentedControl } from "./Segmented";

const OPTIONS: Array<{ value: ThemePreference; label: string; description: string; icon: typeof Sun }> = [
  { value: "light", label: "Sáng", description: "Luôn dùng giao diện sáng", icon: Sun },
  { value: "dark", label: "Tối", description: "Luôn dùng giao diện tối", icon: Moon },
  { value: "auto", label: "Tự động", description: "Sáng 06:00–18:00, tối 18:00–06:00 (giờ Việt Nam)", icon: Clock3 },
];

/** Topbar control: a menu so the three choices stay discoverable without taking space. */
export function ThemeMenu({ preference, theme, onChange }: { preference: ThemePreference; theme: ThemeMode; onChange: (next: ThemePreference) => void }) {
  const Icon = preference === "auto" ? Clock3 : theme === "dark" ? Moon : Sun;
  const summary = themeSummary(preference, theme);
  return (
    <RadioMenu
      label="Giao diện"
      value={preference}
      onValueChange={onChange}
      options={OPTIONS}
      trigger={
        <Button variant="ghost" icon={Icon} aria-label={`Giao diện: ${summary}. Đổi giao diện`} className="adm-theme-trigger">
          <span className="adm-theme-trigger-label">{summary}</span>
        </Button>
      }
    />
  );
}

/** Settings page control: all three choices visible at once. */
export function ThemeSegmented({ preference, onChange }: { preference: ThemePreference; onChange: (next: ThemePreference) => void }) {
  return <SegmentedControl ariaLabel="Giao diện" value={preference} onChange={onChange} options={OPTIONS.map(({ value, label, icon }) => ({ value, label, icon }))} />;
}
