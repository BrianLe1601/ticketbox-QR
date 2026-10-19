import * as RadixPopover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Non-modal floating panel (advanced filters, quick details). Escape closes, focus returns. */
export function Popover({ trigger, children, open, onOpenChange, align = "start", className, label }: {
  trigger: ReactNode; children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end"; className?: string; label: string;
}) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content className={cn("adm-popover", className)} align={align} sideOffset={6} collisionPadding={12} aria-label={label}>
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

/** Wrap a button that should close the popover (e.g. "Áp dụng"). */
export function PopoverClose({ children }: { children: ReactNode }) {
  return <RadixPopover.Close asChild>{children}</RadixPopover.Close>;
}
