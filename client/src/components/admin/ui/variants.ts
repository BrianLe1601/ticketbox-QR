import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost" | "success";
export type ButtonSize = "sm" | "md" | "lg";

/** Class list of the Admin button, for elements that must look like one (e.g. toast actions). */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return cn("adm-btn", `adm-btn--${variant}`, `adm-btn--${size}`, extra);
}
