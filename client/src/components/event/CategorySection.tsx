import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { CategorySlug, Event } from "@/types/event.types";
import { getCategoryLabel } from "@/constants/eventconstants";
import { fetchEventList } from "@/services/event.service";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { EventCard } from "@/components/event/EventCard";
import { EventCardSkeleton } from "@/components/event/EventCardSkeleton";

export function CategorySection({ category }: { category: CategorySlug }) {
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchEventList({ category, limit: 3, sort: "upcoming" })
            .then(({ events }) => { if (!cancelled) setEvents(events); })
            .catch(() => { if (!cancelled) setEvents([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [category]);

    if (!loading && events.length === 0) return null;

    const label = getCategoryLabel(category);

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => <EventCardSkeleton key={i} />)
                    : events.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
        </section>
    );
}