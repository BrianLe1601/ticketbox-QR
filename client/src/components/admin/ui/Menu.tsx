import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { Check, MoreHorizontal, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { IconButton, type ButtonSize } from "./Button";

export interface MenuAction {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Shown under the label when disabled, so the reason is never hidden. */
  disabledReason?: string;
}

export function MenuContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content className="adm-menu" align={align} sideOffset={6} collisionPadding={12}>{children}</RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

export function MenuItem({ action }: { action: MenuAction }) {
  const Icon = action.icon;
  return (
    <RadixMenu.Item
      className={cn("adm-menu-item", action.tone === "danger" && "is-danger")}
      disabled={action.disabled}
      onSelect={action.onSelect}
    >
      {Icon && <Icon size={15} aria-hidden="true" />}
      <span className="adm-menu-item-text">
        <span>{action.label}</span>
        {action.disabled && action.disabledReason && <small>{action.disabledReason}</small>}
      </span>
    </RadixMenu.Item>
  );
}

/**
 * Row "⋯" menu for actions beyond the two visible ones. Destructive actions are listed last,
 * separated, and still open a ConfirmDialog from their onSelect.
 */
export function ActionMenu({ actions, label = "Thao tác khác", size = "sm" }: { actions: MenuAction[]; label?: string; size?: ButtonSize }) {
  const safe = actions.filter((action) => action.tone !== "danger");
  const danger = actions.filter((action) => action.tone === "danger");
  if (actions.length === 0) return null;
  return (
    <RadixMenu.Root modal={false}>
      <RadixMenu.Trigger asChild>
        <IconButton icon={MoreHorizontal} label={label} size={size} />
      </RadixMenu.Trigger>
      <MenuContent>
        {safe.map((action) => <MenuItem key={action.label} action={action} />)}
        {safe.length > 0 && danger.length > 0 && <RadixMenu.Separator className="adm-menu-sep" />}
        {danger.map((action) => <MenuItem key={action.label} action={action} />)}
      </MenuContent>
    </RadixMenu.Root>
  );
}

/** Checkbox list menu (e.g. column visibility). */
export function CheckMenu({ trigger, label, items }: {
  trigger: ReactNode; label: string;
  items: Array<{ id: string; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean }>;
}) {
  return (
    <RadixMenu.Root modal={false}>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <MenuContent>
        <RadixMenu.Label className="adm-menu-label">{label}</RadixMenu.Label>
        {items.map((item) => (
          <RadixMenu.CheckboxItem
            key={item.id}
            className="adm-menu-item"
            checked={item.checked}
            disabled={item.disabled}
            onCheckedChange={(checked) => item.onCheckedChange(checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="adm-menu-check" aria-hidden="true">{item.checked && <Check size={14} />}</span>
            <span className="adm-menu-item-text"><span>{item.label}</span></span>
          </RadixMenu.CheckboxItem>
        ))}
      </MenuContent>
    </RadixMenu.Root>
  );
}

/** Single-choice menu (theme, sort). */
export function RadioMenu<T extends string>({ trigger, label, value, onValueChange, options }: {
  trigger: ReactNode; label: string; value: T; onValueChange: (value: T) => void;
  options: Array<{ value: T; label: string; description?: string; icon?: LucideIcon }>;
}) {
  return (
    <RadixMenu.Root modal={false}>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <MenuContent>
        <RadixMenu.Label className="adm-menu-label">{label}</RadixMenu.Label>
        <RadixMenu.RadioGroup value={value} onValueChange={(next) => onValueChange(next as T)}>
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <RadixMenu.RadioItem key={option.value} value={option.value} className="adm-menu-item">
                <span className="adm-menu-check" aria-hidden="true">{option.value === value && <Check size={14} />}</span>
                {Icon && <Icon size={15} aria-hidden="true" />}
                <span className="adm-menu-item-text">
                  <span>{option.label}</span>
                  {option.description && <small>{option.description}</small>}
                </span>
              </RadixMenu.RadioItem>
            );
          })}
        </RadixMenu.RadioGroup>
      </MenuContent>
    </RadixMenu.Root>
  );
}
