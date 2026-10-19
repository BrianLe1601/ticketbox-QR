import { Moon, Sun } from "lucide-react";

import type { ThemeMode } from "@/lib/ticketbox-theme";

/** One switch for Admin, Staff and Login. The label names the setting; state is announced by aria-checked. */
export function ThemeToggle({ theme, onToggle, className = "" }: { theme: ThemeMode; onToggle: () => void; className?: string }) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Giao diện tối"
      title={dark ? "Đang dùng giao diện tối. Bấm để chuyển sang sáng." : "Đang dùng giao diện sáng. Bấm để chuyển sang tối."}
      className={`tb-theme-toggle ${className}`.trim()}
      onClick={onToggle}
    >
      {dark ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
      <span className="tb-theme-label">{dark ? "Tối" : "Sáng"}</span>
    </button>
  );
}
