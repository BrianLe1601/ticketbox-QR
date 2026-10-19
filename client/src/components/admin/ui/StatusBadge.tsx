import { cn } from "@/lib/utils";
import { statusStyle, type StatusDomain, type StatusTone } from "@/lib/admin-status";

export type StatusBadgeProps =
  | { domain: StatusDomain; status: string | null | undefined; label?: string; tone?: StatusTone; size?: "sm" | "md"; className?: string }
  | { domain?: undefined; status?: undefined; label: string; tone: StatusTone; size?: "sm" | "md"; className?: string };

/** Text + dot, never colour alone. Labels come from the single registry in lib/admin-status. */
export function StatusBadge(props: StatusBadgeProps) {
  const base = props.domain ? statusStyle(props.domain, props.status) : null;
  const label = props.label ?? base?.label ?? "";
  const tone = props.tone ?? base?.tone ?? "neutral";
  return (
    <span className={cn("adm-badge", `adm-badge--${tone}`, props.size === "sm" && "adm-badge--sm", props.className)}>
      <span className="adm-badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
