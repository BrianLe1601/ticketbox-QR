import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 12-column Bento grid (Admin system layout; the Tổng quan page is the reference). */
export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bento", className)}>{children}</div>;
}

export type BentoSpan = 3 | 4 | 5 | 6 | 7 | 8 | 12;

/** White card, 18px radius, soft shadow, teal title, secondary subtitle, actions on the right. */
export function BentoCard({ title, subtitle, actions, children, span = 12, className }: {
  title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; span?: BentoSpan; className?: string;
}) {
  return (
    <section className={cn("bento-card", `span-${span}`, className)} aria-label={title}>
      <header className="bento-head">
        <div className="bento-titles">
          <h2 className="bento-title">{title}</h2>
          {subtitle && <p className="bento-sub">{subtitle}</p>}
        </div>
        {actions && <div className="bento-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
