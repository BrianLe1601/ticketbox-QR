import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, Clock3, Loader2, Mail, ShieldCheck, Ticket, XCircle } from "lucide-react";
import { ApiRequestError } from "@/services/api";
import { fetchOrder, payOrder } from "@/services/order.service";
import type { Order, PaymentResult } from "@/types/order.types";
import { formatPrice } from "@/lib/utils";
import { TicketRetrievalForm } from "@/components/event/TicketRetrievalForm";

export function OrderPaymentPage() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const stateToken = (location.state as { token?: string } | null)?.token;
    const token = stateToken ?? (id ? sessionStorage.getItem(`ticketbox-order-${id}`) : null);
    const [order, setOrder] = useState<Order | null | undefined>(undefined);
    const [now, setNow] = useState(() => Date.now());
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [needsLookup, setNeedsLookup] = useState(false);
    const [paying, setPaying] = useState(false);
    const [result, setResult] = useState<PaymentResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id || !token) return;
        let cancelled = false;
        fetchOrder(id, token, true).then((value) => {
            if (!cancelled) { setOrder(value); setNeedsLookup(false); }
        }).catch(() => {
            if (!cancelled) setError("Không thể tải trạng thái đơn hàng. Vui lòng thử lại.");
        });
        return () => { cancelled = true; };
    }, [id, token, loadAttempt]);

    useEffect(() => {
        if (!order?.expiresAt || order.status !== "pending_payment") return;
        const update = () => setNow(Date.now());
        const interval = window.setInterval(update, 250);
        return () => window.clearInterval(interval);
    }, [order]);

    const remaining = order?.status === "pending_payment" && order.expiresAt
        ? Math.max(0, new Date(order.expiresAt).getTime() - now) : 0;

    function retryLookup() {
        setError(null);
        setLoadAttempt((attempt) => attempt + 1);
    }

    const countdown = useMemo(() => {
        const seconds = Math.ceil(remaining / 1000);
        return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    }, [remaining]);

    if (!id || !token) return <Navigate to="/events" replace />;
    if (order === undefined) return <div className="max-w-lg mx-auto px-4 py-24 text-center text-sm text-muted-foreground">
        {error ? <div role="alert"><p>{error}</p><button onClick={retryLookup} className="mt-3 underline focus-visible:outline-2 focus-visible:outline-primary">Thử lại</button></div> : "Đang tải đơn hàng..."}
    </div>;
    if (!order) return <Navigate to="/events" replace />;

    async function handlePayment() {
        if (!token || paying || needsLookup || order?.status !== "pending_payment" || remaining <= 0) return;
        setPaying(true); setError(null);
        try {
            const paid = await payOrder(order!.id, token);
            setResult(paid);
            setOrder((current) => current ? { ...current, status: "confirmed" } : current);
        } catch (err) {
            // A lost response can follow a committed payment. Read status before offering a retry.
            try {
                const current = await fetchOrder(String(order!.id), token, true);
                setOrder(current);
                setError(current?.status === "pending_payment"
                    ? (err instanceof ApiRequestError ? err.message : "Không thể xác nhận thanh toán mô phỏng, vui lòng thử lại") : null);
            } catch {
                setNeedsLookup(true);
                setError("Chưa thể kiểm tra kết quả thanh toán mô phỏng. Hãy tải lại trạng thái đơn hàng trước khi thử tiếp.");
            }
        } finally { setPaying(false); }
    }

    if (result) {
        return <div className="max-w-3xl mx-auto px-4 py-10">
            <div className="text-center mb-8">
                <CheckCircle2 className="mx-auto text-public-success mb-3" size={54} />
                <h1 className="text-2xl font-extrabold text-foreground">Thanh toán mô phỏng thành công</h1>
                <p className="text-sm text-muted-foreground mt-2">Đơn {result.orderCode} · {result.tickets.length} vé</p>
                <p className="text-xs text-muted-foreground mt-2">Không có giao dịch tiền thật qua ngân hàng hoặc cổng thanh toán.</p>
                <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs ${result.emailSent ? "bg-emerald-500/10 text-public-success" : "bg-amber-500/10 text-public-warning"}`}>
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

    const pending = order.status === "pending_payment";
    const confirmed = order.status === "confirmed";
    const cancelled = order.status === "cancelled";
    const expired = order.status === "expired" || (pending && remaining <= 0);
    const title = confirmed ? "Đơn hàng đã thanh toán mô phỏng"
        : cancelled ? "Đơn hàng đã bị hủy"
            : expired ? "Đơn hàng đã hết hạn" : "Xác nhận thanh toán mô phỏng";
    return <div className="max-w-2xl mx-auto px-4 py-10">
        <div className={`rounded-2xl border p-5 mb-6 flex items-center justify-between ${confirmed ? "border-emerald-500/30 bg-emerald-500/10" : expired || cancelled ? "border-red-500/30 bg-red-500/10" : "border-primary/30 bg-primary/10"}`}>
            <div className="flex items-center gap-3">
                {confirmed ? <CheckCircle2 className="text-public-success" /> : cancelled ? <XCircle className="text-public-error" /> : <Clock3 className={expired ? "text-public-error" : "text-primary"} />}
                <div><p className="text-xs text-muted-foreground">{pending ? "Thời gian giữ vé còn lại" : "Trạng thái đơn hàng"}</p><p className="text-sm font-bold">{pending && !expired ? "Hoàn tất trước khi đồng hồ kết thúc" : title}</p></div>
            </div>
            {pending && <span className={`font-mono text-2xl font-black ${remaining < 60_000 ? "text-public-error" : "text-primary"}`}>{countdown}</span>}
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
            <h1 className="text-xl font-extrabold mb-1">{title}</h1>
            <p className="text-xs text-muted-foreground mb-5">{order.orderCode} · Email nhận vé: {order.buyerEmail}</p>
            <div className="space-y-3">{order.items.map((item) => <div key={item.ticketTypeId} className="flex justify-between text-sm"><span>{item.ticketTypeName} × {item.quantity}</span><b>{formatPrice(item.lineTotal)}</b></div>)}</div>
            <div className="border-t border-border my-5 pt-4 flex justify-between"><b>Tổng thanh toán mô phỏng</b><b className="text-primary text-lg">{formatPrice(order.totalAmount)}</b></div>
            <p className="mb-4 text-xs text-muted-foreground">Luồng này phục vụ đồ án và không chuyển tiền thật.</p>
            {error && <div role="alert" className="text-xs text-public-error bg-red-500/10 rounded-lg px-3 py-2 mb-4">{error} {needsLookup && <button onClick={retryLookup} className="underline focus-visible:outline-2">Tải lại trạng thái</button>}</div>}
            {confirmed && <div className="relative">
                <p className="text-sm text-muted-foreground mb-4">Thanh toán mô phỏng đã được ghi nhận. Hãy kiểm tra email nhận vé; nếu chưa nhận được, bạn có thể yêu cầu gửi lại vé.</p>
                <TicketRetrievalForm />
            </div>}
            {(cancelled || expired) && <p className="text-sm text-muted-foreground">Đơn này không thể thanh toán. Vui lòng chọn vé và tạo đơn mới nếu sự kiện còn mở bán.</p>}
            {pending && <button onClick={handlePayment} disabled={expired || paying || needsLookup} className="w-full py-3.5 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {paying ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}{paying ? "Đang tạo và gửi vé..." : "Xác nhận thanh toán mô phỏng"}
            </button>}
        </div>
    </div>;
}
