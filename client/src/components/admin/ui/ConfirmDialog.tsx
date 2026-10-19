import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { captureOpener, returnFocus, type Opener } from "./focus-return";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** What will happen, one line each. Irreversible actions must list their consequences. */
  consequences?: ReactNode[];
  /** For bulk actions: e.g. "3/5 đơn đủ điều kiện". */
  impact?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  pending?: boolean;
  /** Server/validation error from the last attempt, shown inside the dialog. */
  error?: ReactNode;
  onConfirm: () => void | Promise<void>;
  /** Disable confirm with a reason (e.g. nothing eligible). */
  confirmDisabledReason?: string;
  children?: ReactNode;
}

/**
 * Confirmation for state transitions and destructive actions. Focus starts on "Quay lại"
 * (the safe choice); the dialog cannot be dismissed while the request is pending.
 */
export function ConfirmDialog({
  open, onOpenChange, title, description, consequences, impact, confirmLabel, cancelLabel = "Quay lại",
  tone = "danger", pending = false, error, onConfirm, confirmDisabledReason, children,
}: ConfirmDialogProps) {
  const block = (event: Event) => { if (pending) event.preventDefault(); };
  const opener = useRef<Opener | null>(null);
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => { if (!pending || next) onOpenChange(next); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="adm-overlay" />
        <AlertDialog.Content
          className={cn("adm-dialog", `adm-dialog--${tone}`)}
          onEscapeKeyDown={block}
          onOpenAutoFocus={(event) => { opener.current = captureOpener(event.currentTarget as Element | null); }}
          onCloseAutoFocus={(event) => returnFocus(event, opener)}
        >
          <div className="adm-dialog-head">
            {tone === "danger" && <AlertTriangle className="adm-dialog-icon" size={20} aria-hidden="true" />}
            <AlertDialog.Title className="adm-dialog-title">{title}</AlertDialog.Title>
          </div>
          <AlertDialog.Description asChild>
            <div className="adm-dialog-body">
              {description && <p>{description}</p>}
              {impact && <p className="adm-dialog-impact">{impact}</p>}
              {consequences && consequences.length > 0 && (
                <ul className="adm-dialog-list">{consequences.map((item, index) => <li key={index}>{item}</li>)}</ul>
              )}
            </div>
          </AlertDialog.Description>
          {children}
          {error && <p className="adm-dialog-error" role="alert">{error}</p>}
          <div className="adm-dialog-foot">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={pending}>{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              loading={pending}
              disabled={Boolean(confirmDisabledReason)}
              disabledReason={confirmDisabledReason}
              onClick={() => { void onConfirm(); }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
