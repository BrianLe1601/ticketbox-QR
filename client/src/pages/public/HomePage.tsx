import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, TrendingUp } from "lucide-react";
import type { Event } from "@/types/event.types";
import { fetchEventList, getPublicStats, type PublicStats } from "@/services/event.service";
import { EventCard } from "@/components/event/EventCard";
import { EventCardSkeleton } from "@/components/event/EventCardSkeleton";
import { CategorySection } from "@/components/event/CategorySection";
import { EVENT_LIFECYCLE_FALLBACK_REFRESH_MS } from "@/constants/eventconstants";
import { subscribeToEventLifecycleUpdates } from "@/services/event-realtime.service";

import { TicketRetrievalForm } from "@/components/event/TicketRetrievalForm";

export function HomePage() {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState<PublicStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        getPublicStats().then(result => { if (active) setStats(result); })
            .catch(() => { if (active) setStats(null); })
            .finally(() => { if (active) setStatsLoading(false); });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const refresh = async (initial: boolean) => {
            try {
                const result = await fetchEventList({ limit: 3, sort: "upcoming" });
                if (!cancelled) { setEvents(result.events); setError(''); }
            } catch {
                if (!cancelled) { setEvents([]); setError('Không thể tải sự kiện. Vui lòng thử lại sau.'); }
            } finally {
                if (!cancelled && initial) setLoading(false);
            }
        };
        void refresh(true);
        const unsubscribeRealtime = subscribeToEventLifecycleUpdates(() => void refresh(false));
        const refreshTimer = window.setInterval(
            () => void refresh(false),
            EVENT_LIFECYCLE_FALLBACK_REFRESH_MS,
        );
        return () => {
            cancelled = true;
            unsubscribeRealtime();
            window.clearInterval(refreshTimer);
        };
    }, []);

    return (
        <div>
            <section className="relative min-h-[620px] flex items-center overflow-hidden">
                <div className="absolute inset-0 bg-secondary">
                    <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/50 to-background" />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/20" />
                </div>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
                <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20 mb-6">
                            <TrendingUp size={12} aria-hidden="true" /> Mua vé không cần đăng nhập
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-5" style={{ fontFamily: "Manrope, sans-serif" }}>
                            Bán vé dễ dàng. <span className="text-primary">Check-in</span> thông minh.
                        </h1>
                        <p className="text-base sm:text-lg text-white/60 leading-relaxed mb-7 max-w-lg">
                            Khám phá các sự kiện âm nhạc, hội nghị, lễ hội ẩm thực và nhiều hơn nữa. Mua vé không cần đăng nhập.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => navigate("/events")} className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-transform motion-reduce:transition-none shadow-xl shadow-primary/30 hover:shadow-primary/50 active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                                Khám phá sự kiện <ChevronRight size={16} />
                            </button>
                        </div>
                        <TicketRetrievalForm />
                    </div>
                </div>
            </section>

            {(statsLoading || stats) && <section aria-label="Thống kê từ hệ thống" aria-busy={statsLoading} className="border-y border-white/[0.07] bg-card/50">
                {statsLoading ? <div role="status" aria-label="Đang tải thống kê" className="max-w-7xl mx-auto grid grid-cols-3 gap-4 px-4 py-6">
                    {["events", "buyers", "checkins"].map(key => <div key={key} aria-hidden="true" className="mx-auto h-14 w-full max-w-40 rounded-lg bg-secondary animate-pulse motion-reduce:animate-none" />)}
                </div> : stats && <dl className={`max-w-7xl mx-auto grid ${stats.checkinRate === null ? "grid-cols-2" : "grid-cols-3"} divide-x divide-white/[0.07] px-4 py-6`}>
                    {[
                        { label: "Sự kiện năm nay", value: new Intl.NumberFormat('vi-VN').format(stats.eventsThisYear) },
                        { label: "Khách đã mua vé", value: new Intl.NumberFormat('vi-VN').format(stats.buyers) },
                        ...(stats.checkinRate === null ? [] : [{ label: "Tỷ lệ check-in", value: new Intl.NumberFormat('vi-VN', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(stats.checkinRate / 100) }]),
                    ].map(({ label, value }) => <div key={label} className="flex flex-col-reverse gap-1 px-2 text-center sm:px-6">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="text-2xl font-extrabold text-primary sm:text-3xl">{value}</dd>
                    </div>)}
                </dl>}
            </section>}

            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="flex items-end justify-between mb-8 gap-4">
                    <div>
                        <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-2">Khám phá</p>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground" style={{ fontFamily: "Manrope, sans-serif" }}>Sự kiện sắp diễn ra</h2>
                    </div>
                    <button onClick={() => navigate("/events")} className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors shrink-0">
                        Xem tất cả <ChevronRight size={14} />
                    </button>
                </div>
                {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}
                {!loading && !error && events.length === 0 && <p role="status" className="text-sm text-muted-foreground">Chưa có sự kiện để hiển thị.</p>}
                <div aria-busy={loading} aria-label="Sự kiện sắp diễn ra" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {loading
                        ? Array.from({ length: 3 }).map((_, i) => <EventCardSkeleton key={i} />)
                        : events.map((event) => <EventCard key={event.id} event={event} />)}
                </div>
            </section>

            <div className="space-y-16 pb-16">
                <CategorySection category="music" />
                <CategorySection category="conference" />
                <CategorySection category="food" />
            </div>
        </div>
    );
}
