import * as RadixTooltip from "@radix-ui/react-tooltip";
import { useRef, useState, type ReactNode } from "react";

/** One provider for the Admin shell. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={300} skipDelayDuration={150}>{children}</RadixTooltip.Provider>;
}

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  /** Render nothing extra when there is no content (keeps call sites simple). */
  disabled?: boolean;
}

/**
 * Hover and keyboard focus both open it (Radix). The trigger must be focusable.
 *
 * Radix closes a tooltip on any scroll of an ancestor. Focusing an element that is off-screen
 * scrolls it into view right after the tooltip opens, so keyboard users lost every tooltip
 * below the fold (including the "why is this disabled" reasons). While the trigger holds
 * keyboard focus we therefore ignore those closes; click, blur and Escape still close it.
 */
export function Tooltip({ content, children, side = "top", disabled }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const keyboardFocus = useRef(false);
  const pointerDown = useRef(false);
  const allowClose = useRef(false);

  if (disabled || content === null || content === undefined || content === "") return <>{children}</>;

  function onOpenChange(next: boolean) {
    if (!next && keyboardFocus.current && !allowClose.current) return;
    allowClose.current = false;
    setOpen(next);
  }

  function requestClose() {
    allowClose.current = true;
    setOpen(false);
  }

  return (
    <RadixTooltip.Root open={open} onOpenChange={onOpenChange}>
      <RadixTooltip.Trigger
        asChild
        onPointerDown={() => { pointerDown.current = true; window.addEventListener("pointerup", () => { pointerDown.current = false; }, { once: true }); }}
        onFocus={() => { keyboardFocus.current = !pointerDown.current; }}
        onBlur={() => { keyboardFocus.current = false; requestClose(); }}
        onClick={requestClose}
      >
        {children}
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          className="adm-tooltip"
          side={side}
          sideOffset={6}
          collisionPadding={12}
          onEscapeKeyDown={() => { allowClose.current = true; }}
        >
          {content}
          <RadixTooltip.Arrow className="adm-tooltip-arrow" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
