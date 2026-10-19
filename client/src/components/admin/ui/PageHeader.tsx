import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export interface Crumb { label: string; to?: string }

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  breadcrumb?: Crumb[];
  /** Right-hand actions; keep a single primary button here. */
  actions?: ReactNode;
  /**
   * Small status line under the title (e.g. "Cập nhật lúc 10:42:05"). Pass null while it is not known
   * yet: the line keeps its height (empty, hidden from assistive tech) so the page does not jump.
   */
  meta?: ReactNode;
  sticky?: boolean;
  className?: string;
}

/** Page title block. It is the page's only <h1>; the shell does not render one. */
export function PageHeader({ title, description, breadcrumb, actions, meta, sticky = true, className }: PageHeaderProps) {
  return (
    <header className={cn("adm-page-header", sticky && "is-sticky", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Đường dẫn" className="adm-breadcrumb">
          <ol>
            {breadcrumb.map((crumb, index) => {
              const last = index === breadcrumb.length - 1;
              return (
                <li key={`${crumb.label}-${index}`}>
                  {crumb.to && !last ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current={last ? "page" : undefined}>{crumb.label}</span>}
                  {!last && <ChevronRight size={13} aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="adm-page-header-row">
        <div className="adm-page-header-text">
          <h1 className="adm-page-title">{title}</h1>
          {description && <p className="adm-page-desc">{description}</p>}
          {meta !== undefined && (
            meta === null || meta === false
              ? <div className="adm-page-meta is-pending" aria-hidden="true">&nbsp;</div>
              : <div className="adm-page-meta">{meta}</div>
          )}
        </div>
        {actions && <div className="adm-page-actions">{actions}</div>}
      </div>
    </header>
  );
}

/** Standard page skeleton: header → notices → KPI → filters → content, with consistent gaps. */
export function PageLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("adm-page", className)}>{children}</div>;
}
