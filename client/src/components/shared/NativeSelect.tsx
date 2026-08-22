import { ChevronDown } from "lucide-react";
import type { SelectOption } from "@/types/event.types";
import { cn } from "@/lib/utils";

export function NativeSelect({
    value, onChange, options, className,
}: {
    value: string;
    onChange: (v: string) => void;
    options: SelectOption[];
    className?: string;
}) {
    return (
        <div className={cn("relative", className)}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full appearance-none bg-card border border-white/[0.08] text-sm text-foreground rounded-xl pl-3 pr-9 py-2.5 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
    );
}