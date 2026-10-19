import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "./Button";

export function Skeleton({ width = "100%", height = "1em", radius, className }: { width?: string; height?: string; radius?: string; className?: string }) {
  const style: CSSProperties = { width, height, borderRadius: radius };
  return <span className={cn("adm-skeleton", className)} style={style} aria-hidden="true" />;
}

/** Placeholder blocks for a page/card while data loads; announces once for screen readers. */
export function SkeletonBlock({ lines = 3, label = "Đang tải dữ liệu", className }: { lines?: number; label?: string; className?: string }) {
  return (
    <div className={cn("adm-skeleton-block", className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} width={i === lines - 1 ? "60%" : "100%"} height="0.9em" />)}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

/** Contextual empty state: say what is missing and, when possible, how to get it. */
export function EmptyState({ title, description, icon: Icon = Inbox, action, compact, className }: EmptyStateProps) {
  return (
    <div className={cn("adm-empty", compact && "adm-empty--compact", className)}>
      <Icon className="adm-empty-icon" size={compact ? 22 : 30} aria-hidden="true" />
      <p className="adm-empty-title">{title}</p>
      {description && <p className="adm-empty-text">{description}</p>}
      {action && <div className="adm-empty-action">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
  className?: string;
}

/** Errors stay inside the region that failed; the rest of the page keeps working. */
export function ErrorState({ title = "Không tải được dữ liệu", description, onRetry, retrying, compact, className }: ErrorStateProps) {
  return (
    <div className={cn("adm-error", compact && "adm-error--compact", className)} role="alert">
      <AlertTriangle className="adm-error-icon" size={20} aria-hidden="true" />
      <div className="adm-error-body">
        <p className="adm-error-title">{title}</p>
        {description && <p className="adm-error-text">{description}</p>}
      </div>
      {onRetry && <Button size="sm" icon={RefreshCw} onClick={onRetry} loading={retrying}>Thử lại</Button>}
    </div>
  );
}

/** A labelled section card (thẻ): title row with optional actions, then content. */
export function Panel({ title, description, actions, children, className, padded = true, as: Tag = "section" }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean; as?: "section" | "div";
}) {
  return (
    <Tag className={cn("adm-panel", !padded && "adm-panel--flush", className)}>
      {(title || actions) && (
        <header className="adm-panel-head">
          <div className="adm-panel-heading">
            {title && <h3 className="adm-panel-title">{title}</h3>}
            {description && <p className="adm-panel-desc">{description}</p>}
          </div>
          {actions && <div className="adm-panel-actions">{actions}</div>}
        </header>
      )}
      <div className="adm-panel-body">{children}</div>
    </Tag>
  );
}

/** Inline notice (cảnh báo) for page-level conditions. */
export function Notice({ tone = "info", title, children, action, className }: {
  tone?: "info" | "success" | "warning" | "danger"; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("adm-notice", `adm-notice--${tone}`, className)} role={tone === "danger" ? "alert" : "status"}>
      <div className="adm-notice-body">
        {title && <p className="adm-notice-title">{title}</p>}
        {children && <div className="adm-notice-text">{children}</div>}
      </div>
      {action && <div className="adm-notice-action">{action}</div>}
    </div>
  );
}
