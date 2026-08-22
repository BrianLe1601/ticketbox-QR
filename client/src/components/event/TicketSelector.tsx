import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import type { TicketType, TicketSaleStatus } from "@/types/event.types";
import { cn, formatPrice } from "@/lib/utils";

export function TicketSelector({
    tickets, eventId, eventStatus,
}: {
    tickets: TicketType[];
    eventId: string;
    eventStatus: TicketSaleStatus;
}) {
    const navigate = useNavigate();
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    const updateQty = useCallback((id: string, delta: number, max: number) => {
        setQuantities((prev) => {
            const next = Math.max(0, Math.min(max, (prev[id] ?? 0) + delta));
            return { ...prev, [id]: next };
        });
    }, []);

    const totalAmount = tickets.reduce((sum, t) => sum + (quantities[t.id] ?? 0) * t.price, 0);
    const totalTickets = Object.values(quantities).reduce((sum, q) => sum + q, 0);
    const canPurchase = eventStatus === "on-sale" && totalTickets > 0;

    function handleCheckout() {
        if (!canPurchase) return;
        const selections = Object.entries(quantities)
            .filter(([, qty]) => qty > 0)
            .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
        // Chưa có cart/store nào giữ lựa chọn vé -> truyền qua router state,
        // trang checkout đọc lại từ location.state.
        navigate(`/checkout/${eventId}`, { state: { selections } });
    }

    return (
        <div className="bg-card border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/[0.07]">
                <h3 className="font-extrabold text-foreground text-base" style={{ fontFamily: "Manrope, sans-serif" }}>Chọn loại vé</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Chọn số lượng vé bạn muốn mua</p>
            </div>

            <div className="divide-y divide-white/[0.07]">
                {tickets.map((ticket) => {
                    const qty = quantities[ticket.id] ?? 0;
                    const isLow = ticket.available > 0 && ticket.available <= 20;
                    const isSoldOut = ticket.available === 0;
                    const isComingSoon = eventStatus === "coming-soon";
                    const disabled = isSoldOut || isComingSoon;

                    return (
                        <div key={ticket.id} className={cn("p-5 transition-colors", qty > 0 && "bg-primary/5")}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-sm text-foreground" style={{ fontFamily: "Manrope, sans-serif" }}>{ticket.name}</span>
                                        {ticket.name === "VIP" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-semibold">POPULAR</span>}
                                        {ticket.name === "Premium" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 font-semibold">EXCLUSIVE</span>}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ticket.description}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="font-extrabold text-sm text-primary" style={{ fontFamily: "JetBrains Mono, monospace" }}>{formatPrice(ticket.price)}</span>
                                        {isLow && !isSoldOut && !isComingSoon && <span className="text-[10px] text-amber-400 font-semibold">Còn {ticket.available} vé</span>}
                                        {isSoldOut && <span className="text-[10px] text-red-400 font-semibold">Hết vé</span>}
                                        {isComingSoon && <span className="text-[10px] text-amber-400 font-semibold">Chưa mở bán</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => updateQty(ticket.id, -1, ticket.available)} disabled={qty === 0 || disabled} className="w-7 h-7 rounded-lg border border-white/[0.1] flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                        <Minus size={13} />
                                    </button>
                                    <span className="w-6 text-center text-sm font-bold text-foreground tabular-nums" style={{ fontFamily: "JetBrains Mono, monospace" }}>{qty}</span>
                                    <button onClick={() => updateQty(ticket.id, 1, ticket.available)} disabled={qty >= ticket.available || disabled} className="w-7 h-7 rounded-lg border border-white/[0.1] flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                        <Plus size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-5 border-t border-white/[0.07] space-y-4">
                {totalTickets > 0 && (
                    <div className="flex items-center justify-between text-sm bg-primary/5 rounded-xl px-4 py-2.5">
                        <span className="text-muted-foreground">{totalTickets} vé đã chọn</span>
                        <span className="font-extrabold text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{formatPrice(totalAmount)}</span>
                    </div>
                )}
                <button
                    onClick={handleCheckout}
                    disabled={!canPurchase}
                    className={cn(
                        "w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200",
                        canPurchase ? "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30 hover:shadow-primary/40 active:scale-[0.98]" : "bg-secondary text-muted-foreground cursor-not-allowed"
                    )}
                >
                    <ShoppingCart size={16} />
                    {eventStatus === "sold-out" ? "Đã hết vé" : eventStatus === "coming-soon" ? "Chưa mở bán" : totalTickets > 0 ? "Tiếp tục mua vé" : "Chọn vé để tiếp tục"}
                </button>
                {eventStatus === "on-sale" && <p className="text-[11px] text-center text-muted-foreground">Bảo mật thanh toán · Vé điện tử qua email</p>}
            </div>
        </div>
    );
}