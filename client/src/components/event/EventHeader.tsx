import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { Event } from "@/types/event.types";
import { getCategoryLabel } from "@/constants/eventconstants";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CategoryIcon } from "@/components/shared/CategoryIcon";

export function EventHeader({ event }: { event: Event }) {
    const navigate = useNavigate();
    return (
        <div className="relative">
            <div className="relative h-72 sm:h-96 overflow-hidden bg-secondary">
                <img src={event.coverImage} alt={event.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent" />
            </div>
            <div className="absolute top-4 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <button onClick={() => navigate("/events")} className="flex items-center gap-2 text-sm text-white/80 hover:text-white bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 transition-colors">
                    <ArrowLeft size={14} /> Quay lại
                </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
                <div className="flex items-center gap-2 mb-3">
                    <StatusBadge status={event.saleStatus} />
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-black/30 backdrop-blur-sm text-white border border-white/10">
                        <CategoryIcon category={event.category} size={11} />
                        {getCategoryLabel(event.category)}
                    </span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight max-w-2xl" style={{ fontFamily: "Manrope, sans-serif" }}>{event.name}</h1>
            </div>
        </div>
    );
}