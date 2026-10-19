import { Loader2, type LucideIcon } from "lucide-react";
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./variants";

export type { ButtonSize, ButtonVariant };

export interface ButtonProps extends Omit<ComponentPropsWithRef<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  /** Text shown while loading for screen readers; the visible label keeps the width. */
  loadingLabel?: string;
  /**
   * Why the action is unavailable. When set together with `disabled`, the button stays
   * focusable (aria-disabled) so keyboard and pointer users can read the reason.
   */
  disabledReason?: ReactNode;
  block?: boolean;
  children?: ReactNode;
}

/**
 * The only Admin button. One `primary` per region; destructive actions use `danger` or
 * `danger-ghost` and go last. Never style a raw <button> for an action again.
 */
export function Button({
  variant = "secondary", size = "md", icon: Icon, iconRight: IconRight, loading = false, loadingLabel = "Đang xử lý",
  disabledReason, block, disabled, className, children, onClick, type = "button", ref, ...rest
}: ButtonProps) {
  const explained = Boolean(disabled && disabledReason);
  const inert = disabled || loading;
  const iconSize = size === "sm" ? 14 : 16;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (inert) { event.preventDefault(); return; }
    onClick?.(event);
  }

  const button = (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, cn(block && "adm-btn--block", loading && "is-loading", explained && "is-disabled", className))}
      disabled={disabled && !explained}
      aria-disabled={explained || loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...rest}
    >
      <span className="adm-btn-content">
        {Icon && <Icon size={iconSize} aria-hidden="true" />}
        {children !== undefined && <span className="adm-btn-label">{children}</span>}
        {IconRight && <IconRight size={iconSize} aria-hidden="true" />}
      </span>
      {loading && (
        <span className="adm-btn-spinner">
          <Loader2 size={iconSize} aria-hidden="true" />
          <span className="sr-only">{loadingLabel}</span>
        </span>
      )}
    </button>
  );

  return explained ? <Tooltip content={disabledReason}>{button}</Tooltip> : button;
}

export interface IconButtonProps extends Omit<ButtonProps, "icon" | "iconRight" | "children" | "block"> {
  icon: LucideIcon;
  /** Required: becomes aria-label and the tooltip text. */
  label: string;
  /** Hide the tooltip (e.g. inside a menu trigger that already shows a label). */
  noTooltip?: boolean;
}

/** Square button with an icon only. Always labelled and always explained by a tooltip. */
export function IconButton({ icon: Icon, label, variant = "ghost", size = "md", noTooltip, disabledReason, disabled, className, ...rest }: IconButtonProps) {
  const button = (
    <Button
      {...rest}
      variant={variant}
      size={size}
      disabled={disabled}
      disabledReason={disabledReason}
      className={cn("adm-btn--icon", className)}
      aria-label={label}
      icon={Icon}
    />
  );
  // A disabled reason already brings its own tooltip.
  if (noTooltip || (disabled && disabledReason)) return button;
  return <Tooltip content={label}>{button}</Tooltip>;
}

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

/** Navigation that looks like a button (keeps link semantics for routing). */
export function ButtonLink({ variant = "secondary", size = "md", icon: Icon, iconRight: IconRight, className, children, ...rest }: ButtonLinkProps) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <Link className={buttonClass(variant, size, className as string | undefined)} {...rest}>
      <span className="adm-btn-content">
        {Icon && <Icon size={iconSize} aria-hidden="true" />}
        <span className="adm-btn-label">{children as ReactNode}</span>
        {IconRight && <IconRight size={iconSize} aria-hidden="true" />}
      </span>
    </Link>
  );
}
