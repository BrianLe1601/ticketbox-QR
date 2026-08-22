import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, Clock3, Loader2, Mail, ShieldCheck, Ticket } from "lucide-react";
import { ApiRequestError } from "@/services/api";
import { fetchOrder, payOrder } from "@/services/order.service";
import type { Order, PaymentResult } from "@/types/order.types";
import { formatPrice } from "@/lib/utils";

export function OrderPaymentPage() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const stateToken = (location.state as { token?: string } | null)?.token;
    const token = stateToken ?? (id ? sessionStorage.getItem(`ticketbox-order-${id}`) : null);
    const [order, setOrder] = useState<Order | null | undefined>(undefined);
    const [remaining, setRemaining] = useState(0);
    const [paying, setPaying] = useState(false);
    const [result, setResult] = useState<PaymentResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id || !token) return;
        let cancelled = false;
        fetchOrder(id, token).then((value) => { if (!cancelled) setOrder(value); });
        return () => { cancelled = true; };
    }, [id, token]);

    useEffect(() => {
        if (!order?.expiresAt || order.status !== "pending_payment") return;
        const update = () => setRemaining(Math.max(0, new Date(order.expiresAt!).getTime() - Date.now()));
        update();
        const interval = window.setInterval(update, 250);
        return () => window.clearInterval(interval);
    }, [order]);

    const countdown = useMemo(() => {
        const seconds = Math.ceil(remaining / 1000);
        return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    }, [remaining]);

    if (!id || !token) return <Navigate to="/events" replace />;
    if (order === undefined) return <div className="max-w-lg mx-auto px-4 py-24 text-center text-sm text-muted-foreground">Đang tải đơn hàng...</div>;
    if (!order) return <Navigate to="/events" replace />;

    async function handlePayment() {
        if (!token || paying || remaining <= 0) return;
        setPaying(true); setError(null);
        try {
            const paid = await payOrder(order!.id, token);
            setResult(paid);
            setOrder((current) => current ? { ...current, status: "confirmed" } : current);
            sessionStorage.removeItem(`ticketbox-order-${order!.id}`);
        } catch (err) {
            setError(err instanceof ApiRequestError ? err.message : "Không thể thanh toán, vui lòng thử lại");
        } finally { setPaying(false); }
    }

    if (result) {
        return <div className="max-w-3xl mx-auto px-4 py-10">
            <div className="text-center mb-8">
                <CheckCircle2 className="mx-auto text-emerald-400 mb-3" size={54} />
                <h1 className="text-2xl font-extrabold text-foreground">Thanh toán thành công</h1>
                <p className="text-sm text-muted-foreground mt-2">Đơn {result.orderCode} · {result.tickets.length} vé</p>
                <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs ${result.emailSent ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                    <Mail size={14} /> {result.emailSent ? `Đã gửi vé đến ${result.buyerEmail}` : result.emailMessage}
                </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
                {result.tickets.map((ticket) => <div key={ticket.ticketCode} className="bg-white rounded-2xl p-5 text-center text-slate-900">
                    <Ticket className="mx-auto text-primary mb-2" size={22} />
                    <h2 className="font-bold">{ticket.ticketTypeName}</h2>
                    <img src={ticket.qrDataUrl} alt={`QR ${ticket.ticketCode}`} className="w-full max-w-[280px] mx-auto my-3" />
                    <p className="font-mono text-xs font-semibold">{ticket.ticketCode}</p>
                </div>)}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-6">Mỗi QR chỉ dành cho một vé. Không chia sẻ ảnh QR với người khác.</p>
        </div>;
    }

    const expired = order.status === "expired" || remaining <= 0;
    return <div className="max-w-2xl mx-auto px-4 py-10">
        <div className={`rounded-2xl border p-5 mb-6 flex items-center justify-between ${expired ? "border-red-500/30 bg-red-500/10" : "border-primary/30 bg-primary/10"}`}>
            <div className="flex items-center gap-3"><Clock3 className={expired ? "text-red-400" : "text-primary"} /><div><p className="text-xs text-muted-foreground">Thời gian giữ vé còn lại</p><p className="text-sm font-bold">{expired ? "Đơn hàng đã hết hạn" : "Hoàn tất trước khi đồng hồ kết thúc"}</p></div></div>
            <span className={`font-mono text-2xl font-black ${remaining < 60_000 ? "text-red-400" : "text-primary"}`}>{countdown}</span>
        </div>
        <div className="bg-card border border-white/[0.08] rounded-2xl p-6">
            <h1 className="text-xl font-extrabold mb-1">Xác nhận thanh toán</h1>
            <p className="text-xs text-muted-foreground mb-5">{order.orderCode} · Vé sẽ gửi đến {order.buyerEmail}</p>
            <div className="space-y-3">{order.items.map((item) => <div key={item.ticketTypeId} className="flex justify-between text-sm"><span>{item.ticketTypeName} × {item.quantity}</span><b>{formatPrice(item.lineTotal)}</b></div>)}</div>
            <div className="border-t border-white/[0.08] my-5 pt-4 flex justify-between"><b>Tổng thanh toán</b><b className="text-primary text-lg">{formatPrice(order.totalAmount)}</b></div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-4">{error}</p>}
            <button onClick={handlePayment} disabled={expired || paying} className="w-full py-3.5 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {paying ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}{paying ? "Đang tạo và gửi vé..." : "Thanh toán ngay"}
            </button>
        </div>
    </div>;
}
