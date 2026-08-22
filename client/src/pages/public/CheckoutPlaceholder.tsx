import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Loader2 } from "lucide-react";
import type { Event } from "@/types/event.types";
import type { TicketSelection } from "@/types/order.types";
import { fetchEventById } from "@/services/event.service";
import { createOrder } from "@/services/order.service";
import { ApiRequestError } from "@/services/api";
import { formatPrice } from "@/lib/utils";

interface LocationState {
    selections?: TicketSelection[];
}

export function CheckoutPlaceholder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const selections = (location.state as LocationState | null)?.selections ?? [];

    const [event, setEvent] = useState<Event | null | undefined>(undefined);
    const [notFound, setNotFound] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) { setNotFound(true); return; }
        let cancelled = false;
        fetchEventById(id).then((result) => {
            if (cancelled) return;
            if (!result) setNotFound(true);
            else setEvent(result);
        });
        return () => { cancelled = true; };
    }, [id]);

    const lines = useMemo(() => {
        if (!event) return [];
        return selections
            .map((sel) => {
                const ticket = event.tickets.find((t) => t.id === sel.ticketTypeId);
                if (!ticket) return null;
                return { ticket, quantity: sel.quantity, lineTotal: ticket.price * sel.quantity };
            })
            .filter((l): l is { ticket: (typeof event.tickets)[number]; quantity: number; lineTotal: number } => l !== null);
    }, [event, selections]);

    const totalAmount = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);

    if (notFound) return <Navigate to="/events" replace />;

    // Vào thẳng URL /checkout/:id hoặc reload mất router state -> không còn biết đã
    // chọn vé gì, đưa về trang sự kiện để chọn lại thay vì hiện form trống vô nghĩa.
    if (event && selections.length === 0) {
        return <Navigate to={`/events/${event.id}`} replace />;
    }

    if (event === undefined) {
        return <div className="max-w-lg mx-auto px-4 py-24 text-center text-sm text-muted-foreground">Đang tải...</div>;
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!event || totalQuantity === 0 || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const order = await createOrder({
                eventId: event.id,
                items: selections,
                buyer: { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined },
            });
            sessionStorage.setItem(`ticketbox-order-${order.id}`, order.lookupToken);
            navigate(`/orders/${order.id}`, { state: { token: order.lookupToken } });
        } catch (err) {
            const message = err instanceof ApiRequestError ? err.message : "Đã có lỗi xảy ra, vui lòng thử lại";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
            <button onClick={() => navigate(`/events/${event?.id}`)} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ArrowLeft size={13} /> Quay lại sự kiện
            </button>

            <div className="flex items-center gap-3 mb-8">
                <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0"><ShoppingCart size={18} className="text-primary" /></div>
                <div>
                    <h1 className="text-xl font-extrabold text-foreground" style={{ fontFamily: "Manrope, sans-serif" }}>Thông tin người mua</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">{event?.shortTitle}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
                <form onSubmit={handleSubmit} className="sm:col-span-3 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Họ và tên</label>
                        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email nhận vé</label>
                        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@example.com" className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Số điện thoại <span className="text-muted-foreground/60 font-normal">(không bắt buộc)</span></label>
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" />
                    </div>

                    {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                    <button type="submit" disabled={submitting} className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/30 transition-all">
                        {submitting && <Loader2 size={15} className="animate-spin" />}
                        {submitting ? "Đang giữ vé..." : "Giữ vé & tiếp tục"}
                    </button>
                    <p className="text-[11px] text-center text-muted-foreground">Vé sẽ được giữ trong 10 phút để hoàn tất thanh toán.</p>
                </form>

                <div className="sm:col-span-2">
                    <div className="bg-card border border-white/[0.08] rounded-2xl p-5 space-y-3 sticky top-24">
                        <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "Manrope, sans-serif" }}>Đơn hàng</h3>
                        <div className="space-y-2.5">
                            {lines.map((l) => (
                                <div key={l.ticket.id} className="flex items-start justify-between text-xs gap-2">
                                    <div className="min-w-0">
                                        <p className="text-foreground font-semibold truncate">{l.ticket.name}</p>
                                        <p className="text-muted-foreground">x{l.quantity}</p>
                                    </div>
                                    <span className="text-foreground font-semibold shrink-0" style={{ fontFamily: "JetBrains Mono, monospace" }}>{formatPrice(l.lineTotal)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-white/[0.07] pt-3 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Tổng cộng ({totalQuantity} vé)</span>
                            <span className="text-sm font-extrabold text-primary" style={{ fontFamily: "JetBrains Mono, monospace" }}>{formatPrice(totalAmount)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
