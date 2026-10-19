import * as RadixTabs from "@radix-ui/react-tabs";
import type { LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> { value: T; label: string; icon?: LucideIcon; disabled?: boolean }

/**
 * Exclusive choice between a few options (view mode, density, time range). A radio group:
 * one tab stop, arrow keys move and select, so it is not a row of separate buttons.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, size = "md", iconOnly = false, className }: {
  options: SegmentOption<T>[]; value: T; onChange: (value: T) => void; ariaLabel: string; size?: "sm" | "md"; iconOnly?: boolean; className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.filter((option) => !option.disabled);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const current = enabled.findIndex((option) => option.value === value);
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    else next = (current + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length;
    const target = enabled[next];
    onChange(target.value);
    refs.current[options.indexOf(target)]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("adm-segmented", `adm-segmented--${size}`, className)}>
      {options.map((option, index) => {
        const Icon = option.icon;
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            tabIndex={checked ? 0 : -1}
            disabled={option.disabled}
            className={cn("adm-segment", checked && "is-checked")}
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            {!iconOnly && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export interface TabItem { value: string; label: string; count?: number; disabled?: boolean }

/** Tabs that switch content panels in place (Radix: roving focus, aria-controls). */
export function Tabs({ items, value, onValueChange, children, ariaLabel, className }: {
  items: TabItem[]; value: string; onValueChange: (value: string) => void; children: ReactNode; ariaLabel: string; className?: string;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={cn("adm-tabs", className)}>
      <RadixTabs.List className="adm-tabs-list" aria-label={ariaLabel}>
        {items.map((item) => (
          <RadixTabs.Trigger key={item.value} value={item.value} disabled={item.disabled} className="adm-tab">
            <span>{item.label}</span>
            {item.count !== undefined && <span className="adm-tab-count tb-num">{item.count}</span>}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return <RadixTabs.Content value={value} className={cn("adm-tab-panel", className)}>{children}</RadixTabs.Content>;
}
