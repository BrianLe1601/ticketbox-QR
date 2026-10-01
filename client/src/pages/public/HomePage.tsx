import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, TrendingUp } from "lucide-react";
import type { Event } from "@/types/event.types";
import { fetchEventList, getPublicStats, type PublicStats, type PublicEventSummary } from "@/services/event.service";
import { EventCard } from "@/components/event/EventCard";
import { EventCardSkeleton } from "@/components/event/EventCardSkeleton";
import { CategorySection } from "@/components/event/CategorySection";
import { CITY_LABELS, getCategoryLabel, EVENT_LIFECYCLE_FALLBACK_REFRESH_MS } from "@/constants/eventconstants";
import { subscribeToEventLifecycleUpdates } from "@/services/event-realtime.service";

import { TicketRetrievalForm } from "@/components/event/TicketRetrievalForm";

export function HomePage() {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState<PublicStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [popularEvent, setPopularEvent] = useState<PublicEventSummary | null>(null);
    const [popularLoading, setPopularLoading] = useState(true);

    useEffect(() => {
        let active = true;
        async function loadPopular() {
            try {
                const first = await fetchEventList({ sort: 'popular', limit: 1 });
                let selected = first.events[0] ?? null;
                // Keep the server ranking, selecting the first available event across pages.
                if (selected && !selected.hasAvailable) {
                    for (let page = 1; (page - 1) * 50 < first.total; page++) {
                        if (!active) return;
                        const batch = await fetchEventList({ sort: 'popular', limit: 50, page });
                        const available = batch.events.find(event => event.hasAvailable);   
                        if (available) { selected = available; break; }
                    }
                }
                if (active) setPopularEvent(selected);
            } catch { if (active) setPopularEvent(null); }
            finally { if (active) setPopularLoading(false); }
        }
        void loadPopular();
        return () => { active = false; };
    }, []);

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
            <section className="relative min-h-155 flex items-center overflow-hidden">
                <div className="absolute inset-0 bg-secondary">
                    <div className="absolute inset-0 bg-linear-to-b from-background/20 via-background/50 to-background" />
                    <div className="absolute inset-0 bg-linear-to-r from-background/60 via-transparent to-background/20" />
                </div>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
                <div className={`relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 ${(popularLoading || popularEvent) ? 'lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-12' : ''}`}>
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
                    {(popularLoading || popularEvent) && <div className="relative min-w-0 mt-10 px-6 py-10 sm:px-8 lg:mt-0">
                        <style>{`
                            @keyframes public-hero-ticket-float {
                                0%, 100% { transform: translateY(0); }
                                50% { transform: translateY(-8px); }
                            }
                            @keyframes public-hero-ticket-twinkle {
                                0%, 100% { opacity: .35; }
                                50% { opacity: .85; }
                            }
                            .public-hero-ticket { --ticket-tilt: -2deg; isolation: isolate; }
                            .public-hero-ticket-float {
                                animation: public-hero-ticket-float 8s ease-in-out infinite;
                                will-change: transform;
                            }
                            .public-hero-ticket:has(.public-hero-ticket-link:is(:hover, :focus-visible, :active)) .public-hero-ticket-float {
                                animation-play-state: paused;
                            }
                            .public-hero-ticket-link {
                                transform: rotate(var(--ticket-tilt));
                                transition: transform 300ms cubic-bezier(.2,.8,.2,1);
                                box-shadow: 0 24px 48px -12px rgba(0,0,0,.6), 0 12px 55px rgba(124,58,237,.25);
                            }
                            .public-hero-ticket-link:is(:hover, :focus-visible, :active) {
                                transform: translateY(-10px) rotate(0deg) scale(1.02);
                                box-shadow: 0 28px 55px -12px rgba(0,0,0,.7), 0 16px 65px rgba(124,58,237,.4);
                            }
                            .public-hero-ticket-glow {
                                background: radial-gradient(ellipse, rgba(139,92,246,.45), rgba(109,40,217,.12) 50%, transparent 72%);
                                opacity: .65;
                                transition: opacity 300ms ease;
                            }
                            .public-hero-ticket:has(.public-hero-ticket-link:is(:hover, :focus-visible, :active)) .public-hero-ticket-glow { opacity: 1; }
                            .public-hero-ticket-orbits { transform: scale(.94); }
                            .public-hero-ticket-dot {
                                animation: public-hero-ticket-twinkle 6s ease-in-out infinite;
                                box-shadow: 0 0 12px rgba(196,181,253,.75);
                            }
                            .public-hero-ticket-dot:nth-child(4) { animation-delay: -2s; }
                            .public-hero-ticket-dot:nth-child(5) { animation-delay: -4s; }
                            .public-hero-ticket-dot:nth-child(6) { animation-delay: -1s; }
                            @media (min-width: 1024px) {
                                .public-hero-ticket { --ticket-tilt: -4deg; }
                                .public-hero-ticket-orbits { transform: scale(1.08); }
                            }
                            @media (prefers-reduced-motion: reduce) {
                                .public-hero-ticket-float, .public-hero-ticket-dot { animation: none; will-change: auto; }
                                .public-hero-ticket-dot { opacity: .65; }
                                .public-hero-ticket-link, .public-hero-ticket-glow { transition: none; }
                                .public-hero-ticket-link:is(:hover, :focus-visible, :active) { transform: rotate(0deg); }
                            }
                        `}</style>
                        {popularLoading ? <div role="status" aria-label="Đang tải sự kiện bán chạy" className="mx-auto h-100 w-full max-w-97.5 rounded-3xl border border-white/10 bg-secondary" /> : popularEvent && <div className="public-hero-ticket relative mx-auto w-full max-w-97.5">
                            <div aria-hidden="true" className="public-hero-ticket-glow pointer-events-none absolute -inset-x-8 -inset-y-12 -z-10" />
                            <div aria-hidden="true" className="public-hero-ticket-orbits pointer-events-none absolute -inset-x-4 -inset-y-5 -z-10">
                                <span className="absolute inset-x-0 inset-y-6 rotate-18 rounded-[50%] border border-violet-300/15" />
                                <span className="absolute inset-x-2 inset-y-0 -rotate-20 rounded-[50%] border border-violet-300/10" />
                                <span className="public-hero-ticket-dot absolute left-0 top-1/4 h-1.5 w-1.5 rounded-full bg-violet-200" />
                                <span className="public-hero-ticket-dot absolute right-3 top-8 h-2 w-2 rounded-full bg-violet-300" />
                                <span className="public-hero-ticket-dot absolute bottom-10 -right-1 h-1.5 w-1.5 rounded-full bg-violet-200" />
                                <span className="public-hero-ticket-dot absolute bottom-1 left-1/4 h-1 w-1 rounded-full bg-white" />
                            </div>
                            <div className="public-hero-ticket-float relative">
                                <div aria-hidden="true" className="pointer-events-none absolute inset-0 translate-x-2 translate-y-3 -rotate-4 rounded-3xl border border-violet-300/20 bg-linear-to-br from-violet-500/20 to-indigo-950/40 lg:translate-x-4 lg:translate-y-4 lg:-rotate-6" />
                                <Link to={`/events/${popularEvent.id}`} aria-label={`Xem sự kiện ${popularEvent.name}`} className="public-hero-ticket-link relative block h-100 rounded-3xl border border-violet-200/30 bg-linear-to-br from-violet-500 via-violet-700 to-indigo-950 text-white focus-visible:outline-4 focus-visible:outline-offset-8 focus-visible:outline-violet-200">
                                    <div className="h-54.5 px-5 pt-7 pb-5 sm:px-7">
                                        <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-widest">
                                            <span className="truncate text-violet-100">{getCategoryLabel(popularEvent.category)}</span>
                                            {popularEvent.soldCount > 0 && <span className="shrink-0 rounded-full bg-white/15 px-3 py-1">Bán chạy</span>}
                                        </div>
                                        <h2 className="mt-5 line-clamp-3 text-2xl font-extrabold leading-tight">{popularEvent.name}</h2>
                                        {popularEvent.shortDesc && <p className="mt-3 line-clamp-2 text-sm text-violet-100">{popularEvent.shortDesc}</p>}
                                    </div>
                                    <div aria-hidden="true" className="relative mx-5 border-t border-dashed border-violet-200/50">
                                        <span className="absolute -left-8 -top-3 h-6 w-6 rounded-full bg-background" />
                                        <span className="absolute -right-8 -top-3 h-6 w-6 rounded-full bg-background" />
                                    </div>
                                    <div className="flex items-center gap-3 px-5 py-6 sm:gap-4 sm:px-7">
                                        <dl className="min-w-0 flex-1 text-xs sm:text-sm">
                                            <div className="flex gap-3 sm:gap-5">
                                                <div><dt className="text-[10px] tracking-widest text-violet-200">NGÀY</dt><dd className="mt-1 font-semibold">{new Date(popularEvent.startTime).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</dd></div>
                                                <div><dt className="text-[10px] tracking-widest text-violet-200">GIỜ</dt><dd className="mt-1 font-semibold">{new Date(popularEvent.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}</dd></div>
                                            </div>
                                            <dt className="mt-4 text-[10px] tracking-widest text-violet-200">ĐỊA ĐIỂM</dt><dd className="mt-1 line-clamp-2 font-semibold">{popularEvent.venue}, {CITY_LABELS[popularEvent.city] ?? popularEvent.city}</dd>
                                        </dl>
                                        <svg aria-hidden="true" focusable="false" viewBox="0 0 64 64" className="h-16 w-16 shrink-0 rounded-lg sm:h-20 sm:w-20 bg-white p-2 text-indigo-950">
                                            <path fill="currentColor" d="M2 2h20v20H2zm40 0h20v20H42zM2 42h20v20H2zM28 2h6v10h-6zm0 16h8v8h-8zm-2 14h10v6H26zm16-4h8v8h-8zm12 2h8v12h-8zM28 44h8v18h-8zm14-2h8v8h-8zm0 14h20v6H42zm14-10h6v6h-6zM2 28h8v8H2zm14 0h6v8h-6z" />
                                            <path fill="white" d="M6 6h12v12H6zm40 0h12v12H46zM6 46h12v12H6z" />
                                            <path fill="currentColor" d="M9 9h6v6H9zm40 0h6v6h-6zM9 49h6v6H9z" />
                                        </svg>
                                    </div>
                                </Link>
                            </div>
                        </div>}
                    </div>}
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
