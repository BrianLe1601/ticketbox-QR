import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Calendar, MapPin, Users, ChevronRight, CheckCircle2, Ticket } from "lucide-react";
import type { Event } from "@/types/event.types";
import { fetchEventById } from "@/services/event.service";
import { CITY_LABELS } from "@/constants/eventconstants";
import { EventHeader } from "@/components/event/EventHeader";
import { TicketSelector } from "@/components/event/TicketSelector";
import { EVENT_LIFECYCLE_FALLBACK_REFRESH_MS } from "@/constants/eventconstants";
import { subscribeToEventLifecycleUpdates } from "@/services/event-realtime.service";

export function EventDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [event, setEvent] = useState<Event | null | undefined>(undefined); // undefined = đang tải
    const [notFoundId, setNotFoundId] = useState<string | null>(null);

    const [error, setError] = useState<{ id: string; message: string } | null>(null);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const refresh = async () => {
            try {
                const result = await fetchEventById(id, true);
                if (cancelled) return;
                setError(null);
                if (!result) setNotFoundId(id);
                else { setNotFoundId(null); setEvent(result); }
            } catch {
                if (!cancelled) setError({ id, message: 'Không thể tải chi tiết sự kiện. Vui lòng thử lại.' });
            }
        };
        void refresh();
        const unsubscribeRealtime = subscribeToEventLifecycleUpdates((message) => {
            if (message.type === "event.lifecycle.reconnected" || message.changes.some((change) => String(change.eventId) === id)) {
                void refresh();
            }
        });
        const refreshTimer = window.setInterval(
            () => void refresh(),
            EVENT_LIFECYCLE_FALLBACK_REFRESH_MS,
        );
        return () => {
            cancelled = true;
            unsubscribeRealtime();
            window.clearInterval(refreshTimer);
        };
    }, [id, retry]);

    if (!id) return <Navigate to="/events" replace />;
    if (error?.id === id) return <div className="max-w-7xl mx-auto px-4 py-16"><p role="alert" className="text-red-400">{error.message}</p><button className="mt-4 text-primary underline focus-visible:outline-2" onClick={() => { setError(null); setEvent(undefined); setRetry(value => value + 1); }}>Thử lại</button></div>;
    if (notFoundId === id || event === null) return <div role="status" className="max-w-7xl mx-auto px-4 py-16">Sự kiện không tồn tại hoặc không còn được công bố.</div>;
    if (event === undefined || event.id !== id) {
        return <div role="status" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-sm text-muted-foreground">Đang tải...</div>;
    }

    const cityLabel = event.city ? (CITY_LABELS[event.city] ?? event.city) : "";
    return (
        <div>
            <EventHeader event={event} />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { Icon: Calendar, label: "Ngày & Giờ", value: event.displayDate, sub: `${event.time} – ${event.endTimeLabel}` },
                                { Icon: MapPin, label: "Địa điểm", value: event.venue, sub: cityLabel },
                                { Icon: Users, label: "Sức chứa", value: `${event.totalCapacity.toLocaleString("vi-VN")} chỗ`, sub: `${event.tickets.length} loại vé` },
                            ].map(({ Icon, label, value, sub }) => (
                                <div key={label} className="bg-card border border-white/[0.08] rounded-xl p-4 flex gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0"><Icon size={16} className="text-primary" /></div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">{label}</p>
                                        <p className="text-sm font-semibold text-foreground leading-snug truncate">{value}</p>
                                        <p className="text-xs text-muted-foreground truncate">{sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div>
                            <h3 className="font-extrabold text-foreground text-base mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Giới thiệu sự kiện</h3>
                            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
                                {event.description.split("\n\n").map((para, i) => <p key={i}>{para}</p>)}
                            </div>
                        </div>

                        <div className="border-t border-white/[0.07] pt-8">
                            <h3 className="font-extrabold text-foreground text-base mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Địa điểm</h3>
                            <div className="bg-card border border-white/[0.08] rounded-xl overflow-hidden">
                                <div className="p-4">
                                    <p className="text-sm font-semibold text-foreground">{event.venue}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{event.address}, {cityLabel}</p>
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.venue, event.address, cityLabel].filter(Boolean).join(", "))}`} target="_blank" rel="noopener noreferrer" className="mt-3 text-xs text-primary font-semibold hover:text-primary/80 focus-visible:outline-2 flex items-center gap-1">Xem trên bản đồ <ChevronRight size={12} /></a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:sticky lg:top-24 space-y-4">
                        <TicketSelector tickets={event.tickets} eventId={event.id} eventStatus={event.saleStatus} />
                        <div className="p-4 bg-card border border-white/[0.08] rounded-xl space-y-2.5">
                            {[
                                { Icon: CheckCircle2, text: "Vé điện tử gửi qua email sau thanh toán mô phỏng" },
                                { Icon: Ticket, text: "QR code độc nhất, tra cứu không cần đăng nhập" },
                            ].map(({ Icon, text }, i) => (
                                <div key={i} className="flex items-start gap-2.5"><Icon size={13} className="text-emerald-400 mt-0.5 shrink-0" /><span className="text-xs text-muted-foreground">{text}</span></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
