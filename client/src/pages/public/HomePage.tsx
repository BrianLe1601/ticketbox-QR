import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, TrendingUp } from "lucide-react";
import type { Event } from "@/types/event.types";
import { fetchEventList } from "@/services/event.service";
import { EventCard } from "@/components/event/EventCard";
import { EventCardSkeleton } from "@/components/event/EventCardSkeleton";
import { CategorySection } from "@/components/event/CategorySection";

export function HomePage() {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchEventList({ limit: 3, sort: "upcoming" })
            .then(({ events }) => {
                if (!cancelled) setEvents(events);
            })
            .catch(() => {
                if (!cancelled) setEvents([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div>
            <section className="relative min-h-[620px] flex items-center overflow-hidden">
                <div className="absolute inset-0 bg-secondary">
                    <img src="https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&h=700&fit=crop&auto=format" alt="Concert crowd" className="w-full h-full object-cover opacity-40" />
                    <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/50 to-background" />
                    <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/20" />
                </div>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20 mb-6">
                            <TrendingUp size={12} /> Nền tảng bán vé #1 Việt Nam
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-5" style={{ fontFamily: "Manrope, sans-serif" }}>
                            Bán vé dễ dàng. <span className="text-primary">Check-in</span> thông minh.
                        </h1>
                        <p className="text-base sm:text-lg text-white/60 leading-relaxed mb-7 max-w-lg">
                            Khám phá hàng trăm sự kiện âm nhạc, hội nghị, lễ hội ẩm thực và nhiều hơn nữa trên toàn Việt Nam. Mua vé không cần đăng nhập.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => navigate("/events")} className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-xl shadow-primary/30 hover:shadow-primary/50 active:scale-[0.98]">
                                Khám phá sự kiện <ChevronRight size={16} />
                            </button>
                            <button className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/10 text-white font-bold text-sm hover:bg-white/15 transition-all border border-white/10 backdrop-blur-sm">Tìm hiểu thêm</button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y border-white/[0.07] bg-card/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="grid grid-cols-3 divide-x divide-white/[0.07]">
                        {[{ value: "500+", label: "Sự kiện mỗi năm" }, { value: "120K+", label: "Người dùng tin tưởng" }, { value: "99.9%", label: "Check-in thành công" }].map(({ value, label }) => (
                            <div key={label} className="px-6 text-center">
                                <p className="text-2xl sm:text-3xl font-extrabold text-primary" style={{ fontFamily: "Manrope, sans-serif" }}>{value}</p>
                                <p className="text-xs text-muted-foreground mt-1">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="flex items-end justify-between mb-8 gap-4">
                    <div>
                        <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-2">Nổi bật</p>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground" style={{ fontFamily: "Manrope, sans-serif" }}>Sự kiện đang hot</h2>
                    </div>
                    <button onClick={() => navigate("/events")} className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors shrink-0">
                        Xem tất cả <ChevronRight size={14} />
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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