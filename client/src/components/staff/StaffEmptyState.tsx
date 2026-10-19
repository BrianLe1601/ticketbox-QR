import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Dashed "standby" card: what is happening, why, and what to do next (never a dead end). */
export function StaffEmptyState({ icon: Icon, title, children, actions }: { icon: LucideIcon; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="sp-empty">
      <span className="sp-empty-icon" aria-hidden="true"><Icon size={28} /></span>
      <h3>{title}</h3>
      {children && <div className="sp-empty-text">{children}</div>}
      {actions && <div className="sp-empty-actions">{actions}</div>}
    </div>
  );
}
