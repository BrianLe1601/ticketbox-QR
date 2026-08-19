import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { fetchEventById } from "@/services/event.service";

export function CheckoutPlaceholder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const event = id ? fetchEventById(id) : undefined;
    if (!event) return <Navigate to="/events" replace />;

    return (
        <div className="max-w-lg mx-auto px-4 py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center mx-auto mb-6"><ShoppingCart size={24} className="text-primary" /></div>
            <h1 className="text-2xl font-extrabold text-foreground mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>Checkout</h1>
            <p className="text-muted-foreground text-sm mb-2 leading-relaxed">
                Trang thanh toán cho sự kiện <span className="text-foreground font-semibold">{event.shortTitle}</span>.
            </p>
            <p className="text-xs text-muted-foreground/70 mb-8">(Chức năng thanh toán chưa được triển khai trong phiên bản này)</p>
            <button onClick={() => navigate(`/events/${event.id}`)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-white/[0.08] text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors mx-auto">
                <ArrowLeft size={14} /> Quay lại sự kiện
            </button>
        </div>
    );
}