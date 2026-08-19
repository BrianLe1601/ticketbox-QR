import { CheckCircle2, AlertCircle, Timer, XCircle } from "lucide-react";
import type { TicketSaleStatus } from "@/types/event.types";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<TicketSaleStatus, { label: string; cls: string; Icon: React.ElementType }> = {
    "on-sale": { label: "Đang bán", cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25", Icon: CheckCircle2 },
    "sold-out": { label: "Hết vé", cls: "bg-red-500/15 text-red-400 border border-red-500/25", Icon: AlertCircle },
    "coming-soon": { label: "Sắp mở bán", cls: "bg-amber-500/15 text-amber-400 border border-amber-500/25", Icon: Timer },
    "closed": { label: "Đã kết thúc", cls: "bg-secondary text-muted-foreground border border-white/10", Icon: XCircle },
};

export function StatusBadge({ status }: { status: TicketSaleStatus }) {
    const { label, cls, Icon } = STATUS_MAP[status];
    return (
        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide", cls)}>
            <Icon size={11} />{label}
        </span>
    );
}