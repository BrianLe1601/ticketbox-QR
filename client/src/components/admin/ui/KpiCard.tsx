import { Info, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { Skeleton } from "./States";
import { Tooltip } from "./Tooltip";

export type KpiTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "live";

interface KpiBase {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  loading?: boolean;
  /** Formula or source, shown in a tooltip next to the label (e.g. "Đã bán / sức chứa"). */
  formula?: ReactNode;
  className?: string;
}

/**
 * - `onClick`: an in-page filter (summary-card contract: aria-pressed + selected state).
 * - `to`: navigation to a pre-filtered page (Dashboard).
 * - neither: a static figure.
 */
export type KpiCardProps = KpiBase & (
  | { onClick: () => void; selected?: boolean; ariaLabel: string; to?: undefined; disabled?: boolean }
  | { to: string; ariaLabel: string; onClick?: undefined; selected?: undefined; disabled?: undefined }
  | { onClick?: undefined; to?: undefined; selected?: undefined; ariaLabel?: string; disabled?: undefined }
);

function Body({ label, value, hint, icon: Icon, loading, formula, interactive, formulaId }: KpiBase & { interactive?: boolean; formulaId?: string }) {
  return (
    <>
      <span className="adm-kpi-top">
        <span className="adm-kpi-label">{label}</span>
        {/* A focusable tooltip trigger cannot live inside a button/link, so interactive cards
            expose the formula through aria-describedby instead. */}
        {formula && !interactive && (
          <Tooltip content={formula}>
            <span className="adm-kpi-formula" tabIndex={0} role="img" aria-label={`Cách tính: ${typeof formula === "string" ? formula : label}`}><Info size={13} aria-hidden="true" /></span>
          </Tooltip>
        )}
        {formula && interactive && <span id={formulaId} className="sr-only">Cách tính: {formula}</span>}
        {Icon && <Icon className="adm-kpi-icon" size={18} aria-hidden="true" />}
      </span>
      {/* Skeletons stay shorter than the line box (value line-height 1.15) so the card keeps its height. */}
      <span className="adm-kpi-value tb-num">{loading ? <Skeleton width="60%" height="0.9em" /> : value}</span>
      {/* While loading, any card that will have a hint (even hint="") keeps the hint line. */}
      {loading
        ? hint !== undefined && hint !== null && hint !== false && <span className="adm-kpi-hint"><Skeleton width="80%" height="0.9em" /></span>
        : (hint || hint === 0) && <span className="adm-kpi-hint">{hint}</span>}
    </>
  );
}

export function KpiCard(props: KpiCardProps) {
  const formulaId = useId();
  const describedBy = props.formula ? formulaId : undefined;
  const classes = cn("adm-kpi", `adm-kpi--${props.tone ?? "neutral"}`, props.className);
  if (props.to) {
    return <Link to={props.to} className={cn(classes, "is-interactive")} aria-label={props.ariaLabel} aria-describedby={describedBy}><Body {...props} interactive formulaId={formulaId} /></Link>;
  }
  if (props.onClick) {
    return (
      <button
        type="button"
        className={cn(classes, "is-interactive", props.selected && "is-selected")}
        onClick={props.onClick}
        aria-pressed={Boolean(props.selected)}
        aria-label={props.ariaLabel}
        aria-describedby={describedBy}
        disabled={props.disabled || props.loading}
      >
        <Body {...props} interactive formulaId={formulaId} />
      </button>
    );
  }
  return <div className={classes} role={props.ariaLabel ? "group" : undefined} aria-label={props.ariaLabel}><Body {...props} /></div>;
}

export function KpiGrid({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return <section className={cn("adm-kpi-grid", className)} aria-label={label}>{children}</section>;
}
