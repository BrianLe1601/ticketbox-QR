import * as RadixSwitch from "@radix-ui/react-switch";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** On/off setting with a visible label; state is also written next to the switch. */
export function Switch({ checked, onCheckedChange, label, description, disabled, pending, stateLabels = ["Tắt", "Bật"], className }: {
  checked: boolean; onCheckedChange: (checked: boolean) => void; label: ReactNode; description?: ReactNode;
  disabled?: boolean; pending?: boolean; stateLabels?: [string, string]; className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("adm-switch-row", className)}>
      <RadixSwitch.Root
        id={id}
        className="adm-switch"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        aria-describedby={description ? `${id}-desc` : undefined}
      >
        <RadixSwitch.Thumb className="adm-switch-thumb" />
      </RadixSwitch.Root>
      <label htmlFor={id} className="adm-switch-label">
        <span>{label}</span>
        <span className="adm-switch-state">{checked ? stateLabels[1] : stateLabels[0]}</span>
      </label>
      {description && <p id={`${id}-desc`} className="adm-switch-desc">{description}</p>}
    </div>
  );
}
