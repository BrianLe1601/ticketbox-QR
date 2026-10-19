import { initials } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const TONES = 6;

/** Stable colour per name so the same person keeps the same avatar across pages. */
function toneFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash % TONES;
}

/** Initials avatar. The system stores no photos of buyers or staff, so none is shown. */
export function Avatar({ name, size = "md", className }: { name: string | null | undefined; size?: "sm" | "md" | "lg"; className?: string }) {
  const text = String(name ?? "");
  return (
    <span className={cn("adm-avatar", `adm-avatar--${size}`, `adm-avatar--t${toneFor(text)}`, className)} aria-hidden="true">
      {initials(text)}
    </span>
  );
}
