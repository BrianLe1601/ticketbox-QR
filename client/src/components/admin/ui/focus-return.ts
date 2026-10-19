import type { RefObject } from "react";

/**
 * Admin dialogs are opened from state, not from a Radix `Trigger`, so Radix has no element to
 * return focus to and drops it on <body>. Remember the focused element when the dialog opens
 * (called from onOpenAutoFocus, before focus moves) and restore it on close.
 */
export interface Opener {
  target: HTMLElement;
  fallback: HTMLElement | null;
  /** Labelled regions around the opener, innermost first, for when the opener itself was removed
   *  (a deleted row, a card that disappears after the action). */
  regions: HTMLElement[];
}

const DIALOG = ".adm-slideover, .adm-dialog";
const REGION = "section[aria-label], section[aria-labelledby], [role='region'], main";
// Opener of every open Admin dialog, so a dialog opened from inside another one (detail panel →
// "Chỉnh sửa") can fall back to the outer opener when the inner button has gone.
const openers = new WeakMap<Element, Opener>();

export function captureOpener(dialog: Element | null): Opener | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  // Opened from a "⋯" menu item: the item disappears with the menu, so return to the menu's
  // trigger (Radix labels the menu content with the trigger id).
  const menu = active.closest<HTMLElement>("[role='menu']");
  const triggerId = menu?.getAttribute("aria-labelledby");
  const target = (triggerId && document.getElementById(triggerId)) || active;
  const parent = target.closest(DIALOG);
  const regions: HTMLElement[] = [];
  for (let node = target.parentElement?.closest<HTMLElement>(REGION); node; node = node.parentElement?.closest<HTMLElement>(REGION) ?? null) regions.push(node);
  const opener = { target, fallback: parent ? openers.get(parent)?.target ?? null : null, regions };
  if (dialog) openers.set(dialog, opener);
  return opener;
}

export function returnFocus(event: Event, ref: RefObject<Opener | null>) {
  const opener = ref.current;
  ref.current = null;
  const target = [opener?.target, opener?.fallback].find((element) => element?.isConnected);
  if (target) {
    event.preventDefault();
    target.focus({ preventScroll: true });
    return;
  }
  const region = opener?.regions.find((element) => element.isConnected);
  if (!region) return; // nothing left to return to: keep Radix' default
  event.preventDefault();
  // Make the region focusable only for this move, so it does not join the Tab order.
  if (!region.hasAttribute("tabindex")) {
    region.setAttribute("tabindex", "-1");
    region.addEventListener("blur", () => region.removeAttribute("tabindex"), { once: true });
  }
  region.focus({ preventScroll: true });
}
