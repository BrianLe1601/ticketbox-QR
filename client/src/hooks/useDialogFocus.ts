import { useEffect, useRef, type RefObject } from "react";

export function dialogControls(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex]"))
    .filter((item) => item.tabIndex >= 0 && item.getClientRects().length > 0 && !item.matches(":disabled"));
}

// A lower drawer stays mounted while its confirmation is open. Pausing its
// trap must not clean it up, unlock scrolling or forget the original opener.
export function useDialogFocus(open: boolean, selector: string, topmost = true, returnTarget?: RefObject<HTMLElement | null>) {
  const topmostRef = useRef(topmost);
  useEffect(() => { topmostRef.current = topmost; }, [topmost]);
  useEffect(() => {
    if (!open) return;
    const dialog = document.querySelector<HTMLElement>(selector);
    if (!dialog) return;
    const opener = returnTarget?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const originalTabIndex = dialog.getAttribute("tabindex");
    if (originalTabIndex === null) dialog.tabIndex = -1;
    if (topmostRef.current) (dialogControls(dialog)[0] ?? dialog).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !topmostRef.current) return;
      const controls = dialogControls(dialog);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (!dialog.contains(document.activeElement) || document.activeElement === dialog
        || (event.shiftKey && document.activeElement === first)
        || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      window.removeEventListener("keydown", trap);
      document.body.style.overflow = overflow;
      if (originalTabIndex === null) dialog.removeAttribute("tabindex");
      if (opener?.isConnected) opener.focus();
    };
  }, [open, selector, returnTarget]);
}
