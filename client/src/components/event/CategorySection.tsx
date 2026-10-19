import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { CategorySlug, Event } from "@/types/event.types";
import { fetchEventList } from "@/services/event.service";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { EventCard } from "@/components/event/EventCard";
import { EventCardSkeleton } from "@/components/event/EventCardSkeleton";
import { EVENT_LIFECYCLE_FALLBACK_REFRESH_MS } from "@/constants/eventconstants";
import { subscribeToEventLifecycleUpdates } from "@/services/event-realtime.service";

/**
 * One genre row on the Home page. The Home page lists every active genre, so a row only starts
 * loading (and refreshing) when it comes near the screen instead of all rows at once.
 */
export function CategorySection({ category, label }: { category: CategorySlug; label: string }) {
    const navigate = useNavigate();
    const sectionRef = useRef<HTMLElement | null>(null);
    const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const node = sectionRef.current;
        if (visible || !node) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
        }, { rootMargin: "400px 0px" });
        observer.observe(node);
        return () => observer.disconnect();
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        const refresh = async (initial: boolean) => {
            try {
                const result = await fetchEventList({ category, limit: 3, sort: "upcoming" });
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
    }, [category, visible]);

    return (
        <section ref={sectionRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label={label}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-primary"><CategoryIcon category={category} size={15} /></span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-foreground" style={{ fontFamily: "Manrope, sans-serif" }}>{label}</h2>
                </div>
                <button onClick={() => navigate(`/events?category=${encodeURIComponent(category)}`)} className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors shrink-0">
                    Xem tất cả <ChevronRight size={14} />
                </button>
            </div>
            {error && <p role="alert" className="mb-4 text-sm text-public-error">{error}</p>}
            {!loading && !error && events.length === 0 && <p role="status" className="text-sm text-muted-foreground">Chưa có sự kiện thuộc thể loại này. Hãy quay lại sau nhé.</p>}
            <div aria-busy={loading} aria-label={`Sự kiện ${label}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => <EventCardSkeleton key={i} />)
                    : events.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
        </section>
    );
}
