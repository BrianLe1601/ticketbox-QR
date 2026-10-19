import { CheckCircle2, AlertCircle, Timer, XCircle } from "lucide-react";
import type { TicketSaleStatus } from "@/types/event.types";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<TicketSaleStatus, { label: string; cls: string; Icon: React.ElementType }> = {
    "on-sale": { label: "Đang bán", cls: "bg-public-success-badge text-public-success border border-emerald-500/25", Icon: CheckCircle2 },
    "sold-out": { label: "Hết vé", cls: "bg-public-error-badge text-public-error border border-red-500/25", Icon: AlertCircle },
    "coming-soon": { label: "Sắp mở bán", cls: "bg-public-warning-badge text-public-warning border border-amber-500/25", Icon: Timer },
    "closed": { label: "Đã kết thúc", cls: "bg-secondary text-muted-foreground border border-border", Icon: XCircle },
};

export function StatusBadge({ status }: { status: TicketSaleStatus }) {
    const { label, cls, Icon } = STATUS_MAP[status];
    return (
        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide", cls)}>
            <Icon size={11} />{label}
        </span>
    );
}