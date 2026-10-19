import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const clamp = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

function polar(cx: number, cy: number, r: number, t: number) {
  // t = 0 at the left end of the half circle, 1 at the right end
  const angle = Math.PI * (1 - t);
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export interface GaugeZone { to: number; color: string }

/**
 * Semi-circle gauge. Zone colours are decorative; the value is always written as text
 * (children) and announced through `label`.
 */
export function Gauge({ value, label, zones, children, className }: {
  value: number; label: string; zones: GaugeZone[]; children?: ReactNode; className?: string;
}) {
  const v = clamp(value);
  const needle = polar(100, 100, 66, v);
  return (
    <div className={cn("adm-gauge", className)} role="img" aria-label={label}>
      <svg viewBox="0 0 200 112" aria-hidden="true">
        <path d={arc(100, 100, 80, 0, 1)} className="adm-gauge-track" />
        {zones.map((zone, index) => {
          const from = index === 0 ? 0 : zones[index - 1].to;
          return <path key={index} d={arc(100, 100, 80, from, Math.min(1, zone.to))} style={{ stroke: zone.color }} className="adm-gauge-zone" />;
        })}
        <line x1="100" y1="100" x2={needle.x.toFixed(2)} y2={needle.y.toFixed(2)} className="adm-gauge-needle" />
        <circle cx="100" cy="100" r="7" className="adm-gauge-hub" />
      </svg>
      {children && <div className="adm-gauge-value">{children}</div>}
    </div>
  );
}

/** Progress ring with the percentage in the middle. Decorative; pass the figures as text nearby. */
export function DonutRing({ value, color, size = 92, stroke = 10 }: { value: number; color: string; size?: number; stroke?: number }) {
  const v = clamp(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="adm-donut" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} className="adm-donut-track" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round"
          style={{ stroke: color }} strokeDasharray={`${(c * v).toFixed(2)} ${c.toFixed(2)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="adm-donut-value tb-num">{Math.round(v * 100)}%</span>
    </span>
  );
}

/** Mini bar series (sparkline). Decorative: the headline number next to it carries the value. */
export function SparkBars({ values, color, className }: { values: number[]; color: string; className?: string }) {
  const max = Math.max(1, ...values);
  return (
    <span className={cn("adm-spark", className)} aria-hidden="true">
      {values.map((value, index) => (
        <span key={index} style={{ height: `${Math.max(8, Math.round((value / max) * 100))}%`, background: color, opacity: value === 0 ? 0.35 : 1 }} />
      ))}
    </span>
  );
}
