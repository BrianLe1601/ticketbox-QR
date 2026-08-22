import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Loader2, MailCheck } from "lucide-react";
import type { Event } from "@/types/event.types";
import type { TicketSelection } from "@/types/order.types";
import { fetchEventById } from "@/services/event.service";
import { confirmEmailVerification, createOrder, requestEmailVerification } from "@/services/order.service";
import { ApiRequestError } from "@/services/api";
import { formatPrice } from "@/lib/utils";

interface LocationState {
    selections?: TicketSelection[];
}

export function CheckoutPlaceholder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const selections = useMemo(
        () => (location.state as LocationState | null)?.selections ?? [],
        [location.state],
    );

    const [event, setEvent] = useState<Event | null | undefined>(undefined);
    const [notFoundId, setNotFoundId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [verificationToken, setVerificationToken] = useState("");
    const [sendingCode, setSendingCode] = useState(false);
    const [verifyingCode, setVerifyingCode] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        fetchEventById(id).then((result) => {
            if (cancelled) return;
            if (!result) setNotFoundId(id);
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

    if (!id || notFoundId === id) return <Navigate to="/events" replace />;

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
        if (!verificationToken) { setError("Vui lòng xác minh Gmail trước khi tiếp tục"); return; }
        setSubmitting(true);
        setError(null);
        try {
            const order = await createOrder({
                eventId: event.id,
                emailVerificationToken: verificationToken,
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

    async function handleSendCode() {
        if (sendingCode) return;
        setSendingCode(true); setError(null); setVerificationToken("");
        try {
            await requestEmailVerification(email.trim());
            setCodeSent(true);
        } catch (err) { setError(err instanceof ApiRequestError ? err.message : "Không gửi được mã xác minh"); }
        finally { setSendingCode(false); }
    }

    async function handleVerifyCode() {
        if (verifyingCode) return;
        setVerifyingCode(true); setError(null);
        try {
            const result = await confirmEmailVerification(email.trim(), verificationCode.trim());
            setVerificationToken(result.verificationToken);
        } catch (err) { setError(err instanceof ApiRequestError ? err.message : "Không xác minh được Gmail"); }
        finally { setVerifyingCode(false); }
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
                        <div className="flex gap-2">
                            <input required type="email" value={email} disabled={Boolean(verificationToken)} onChange={(e) => { setEmail(e.target.value); setCodeSent(false); setVerificationToken(""); }} placeholder="ban@gmail.com" className="min-w-0 flex-1 px-3.5 py-2.5 rounded-xl bg-card border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-70" />
                            <button type="button" onClick={handleSendCode} disabled={sendingCode || Boolean(verificationToken) || !email} className="px-3 rounded-xl border border-primary/30 text-primary text-xs font-bold disabled:opacity-50">{sendingCode ? "Đang gửi..." : "Gửi mã"}</button>
                        </div>
                        {codeSent && !verificationToken && <div className="flex gap-2 mt-2">
                            <input value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Nhập mã 6 số" className="min-w-0 flex-1 px-3.5 py-2.5 rounded-xl bg-card border border-white/[0.08] text-sm text-foreground" />
                            <button type="button" onClick={handleVerifyCode} disabled={verifyingCode || verificationCode.length !== 6} className="px-3 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50">{verifyingCode ? "Đang kiểm tra..." : "Xác minh"}</button>
                        </div>}
                        {verificationToken && <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1"><MailCheck size={13} /> Gmail đã được xác minh</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Số điện thoại <span className="text-muted-foreground/60 font-normal">(không bắt buộc)</span></label>
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" />
                    </div>

                    {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                    <button type="submit" disabled={submitting || !verificationToken} className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/30 transition-all">
                        {submitting && <Loader2 size={15} className="animate-spin" />}
                        {submitting ? "Đang giữ vé..." : "Tiếp tục"}
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
