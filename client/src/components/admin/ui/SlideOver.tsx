import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { IconButton } from "./Button";
import { captureOpener, returnFocus, type Opener } from "./focus-return";

export interface SlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Content between the title and the scrolling body (tabs, status badges). */
  headerExtra?: ReactNode;
  size?: "md" | "lg" | "xl";
  /** While saving, block Escape/outside-click so a pending request is never orphaned. */
  pending?: boolean;
}

/** Right-hand panel. Modal (focus trapped, Esc closes, focus returns to the opener). */
export function SlideOver({ open, onOpenChange, title, description, children, footer, headerExtra, size = "lg", pending = false }: SlideOverProps) {
  const block = (event: Event) => { if (pending) event.preventDefault(); };
  const opener = useRef<Opener | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!pending || next) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="adm-overlay" />
        <Dialog.Content
          className={cn("adm-slideover", `adm-slideover--${size}`)}
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          // Start on the panel itself (title is announced), not on the close button, whose
          // tooltip would otherwise pop up over the header every time the panel opens.
          onOpenAutoFocus={(event) => { opener.current = captureOpener(event.currentTarget as Element | null); event.preventDefault(); (event.currentTarget as HTMLElement | null)?.focus(); }}
          // Opened from state (no Dialog.Trigger), Radix would return focus to <body>.
          onCloseAutoFocus={(event) => returnFocus(event, opener)}
          tabIndex={-1}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <header className="adm-slideover-head">
            <div className="adm-slideover-titles">
              <Dialog.Title className="adm-slideover-title">{title}</Dialog.Title>
              {description && <Dialog.Description className="adm-slideover-desc">{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Đóng" disabled={pending} disabledReason={pending ? "Đang lưu, vui lòng chờ" : undefined} />
            </Dialog.Close>
          </header>
          {headerExtra && <div className="adm-slideover-extra">{headerExtra}</div>}
          <div className="adm-slideover-body">{children}</div>
          {footer && <footer className="adm-slideover-foot">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
