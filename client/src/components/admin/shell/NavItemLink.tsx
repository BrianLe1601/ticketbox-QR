import { Link, useMatch, useResolvedPath } from "react-router-dom";

import { Tooltip } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { NavItem } from "./navigation";

export interface NavBadgeView { kind: "live" | "count"; text: string; label: string }

/**
 * Sidebar link. Active state is computed here (not with NavLink's className callback) because
 * the collapsed sidebar wraps links in a Radix tooltip Slot, which stringifies function props.
 */
export function NavItemLink({ item, badge, compact, onNavigate }: { item: NavItem; badge: NavBadgeView | null; compact: boolean; onNavigate: () => void }) {
  const resolved = useResolvedPath(item.to);
  const active = Boolean(useMatch({ path: resolved.pathname, end: Boolean(item.end) }));
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn("adm-nav-link", active && "is-active")}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? (badge ? `${item.label}, ${badge.label}` : item.label) : undefined}
    >
      <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
      <span className="adm-nav-text">{item.label}</span>
      {active && !badge && <span className="adm-nav-dot" aria-hidden="true" />}
      {badge && (
        <span className={cn("adm-nav-badge", badge.kind === "live" && "is-live")} aria-hidden={compact || undefined}>
          {badge.kind === "live" && <span className="adm-nav-live-dot" aria-hidden="true" />}
          <span className="adm-nav-badge-text">{badge.text}</span>
          {!compact && <span className="sr-only">: {badge.label}</span>}
        </span>
      )}
    </Link>
  );
  return compact ? <Tooltip side="right" content={badge ? `${item.label} · ${badge.label}` : item.label}>{link}</Tooltip> : link;
}
