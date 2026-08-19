import { Calendar, Clock, MapPin, ChevronRight } from "lucide-react";
import type { Event } from "@/types/event.types";
import { formatPrice } from "@/lib/utils";
import { getCategoryLabel } from "@/constants/eventconstants";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { useNavigate } from "react-router-dom";

export function EventCard({ event }: { event: Event }) {
    const navigate = useNavigate();
    return (
        <article className="group bg-card border border-white/[0.08] rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 flex flex-col">
            <div className="relative overflow-hidden bg-secondary aspect-[16/10]">
                <img src={event.image ?? event.coverImage} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute top-3 left-3"><StatusBadge status={event.saleStatus} /></div>
                <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-black/40 backdrop-blur-sm text-white border border-white/10">
                        <CategoryIcon category={event.category} size={11} />
                        {getCategoryLabel(event.category)}
                    </span>
                </div>
            </div>

            <div className="p-5 flex flex-col flex-1 gap-4">
                <div>
                    <h3 className="font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors" style={{ fontFamily: "Manrope, sans-serif" }}>
                        {event.shortTitle}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{event.shortDesc}</p>
                </div>

                <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2"><Calendar size={13} className="shrink-0 text-primary/70" /><span>{event.displayDate}</span></div>
                    <div className="flex items-center gap-2"><Clock size={13} className="shrink-0 text-primary/70" /><span>{event.time} – {event.endTimeLabel}</span></div>
                    <div className="flex items-center gap-2"><MapPin size={13} className="shrink-0 text-primary/70" /><span className="line-clamp-1">{event.venue}, {event.city}</span></div>
                </div>

                <div className="mt-auto pt-4 border-t border-white/[0.07] flex items-center justify-between">
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Giá từ</p>
                        <p className="text-base font-extrabold text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{formatPrice(event.minPrice)}</p>
                    </div>
                    <button onClick={() => navigate(`/events/${event.id}`)} className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors group/btn">
                        Xem chi tiết
                        <ChevronRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </div>
        </article>
    );
}