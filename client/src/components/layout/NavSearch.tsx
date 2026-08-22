import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import type { Event } from "@/types/event.types";
import { fetchEventList } from "@/services/event.service";
import { cn } from "@/lib/utils";

export function NavSearch() {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [focused, setFocused] = useState(false);
    const [suggestions, setSuggestions] = useState<Event[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) return;
        let cancelled = false;
        const t = setTimeout(() => {
            fetchEventList({ q: trimmed, limit: 5 })
                .then(({ events }) => { if (!cancelled) setSuggestions(events); })
                .catch(() => { if (!cancelled) setSuggestions([]); });
        }, 300);
        return () => { cancelled = true; clearTimeout(t); };
    }, [query]);

    const showDropdown = focused && query.trim().length > 0 && suggestions.length > 0;

    useEffect(() => {
        function onMouseDown(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setFocused(false);
        }
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, []);

    const handleSubmit = (q: string) => {
        const trimmed = q.trim();
        if (!trimmed) return;
        setFocused(false);
        navigate(`/events?q=${encodeURIComponent(trimmed)}`);
    };

    return (
        <div ref={containerRef} className="relative hidden lg:block">
            <div className={cn(
                "flex items-center h-10 w-[300px] rounded-[10px] border bg-[#1A1730] transition-all duration-200",
                focused ? "border-[#7C5CFC]/70 shadow-[0_0_0_3px_rgba(124,92,252,0.14)]" : "border-white/[0.12] hover:border-white/[0.22]"
            )}>
                <button type="button" tabIndex={-1} onClick={() => handleSubmit(query)} className="shrink-0 ml-3 text-[#9CA3AF] hover:text-foreground transition-colors">
                    <Search size={15} />
                </button>
                <input
                    type="text" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setFocused(true)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSubmit(query);
                        if (e.key === "Escape") { setFocused(false); (e.target as HTMLInputElement).blur(); }
                    }}
                    placeholder="Tìm kiếm sự kiện..."
                    className="flex-1 h-full bg-transparent px-2.5 text-[13px] text-foreground placeholder:text-[#9CA3AF] focus:outline-none"
                />
                {query && (
                    <button type="button" tabIndex={-1} onClick={() => setQuery("")} className="shrink-0 mr-2 text-[#9CA3AF] hover:text-foreground transition-colors">
                        <X size={13} />
                    </button>
                )}
            </div>

            {showDropdown && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-[360px] rounded-xl border border-white/[0.09] bg-[#1A1730] shadow-2xl shadow-black/50 overflow-hidden z-50">
                    <div className="py-1.5">
                        {suggestions.map((event) => (
                            <button key={event.id} onMouseDown={(e) => { e.preventDefault(); navigate(`/events/${event.id}`); setQuery(""); setFocused(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] transition-colors text-left">
                                <img src={event.image} alt={event.name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/[0.08]" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-foreground truncate leading-snug">{event.name}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{event.displayDate} · {event.city}</p>
                                </div>
                                <span className="shrink-0 text-[10px] font-medium text-primary/80 bg-primary/10 rounded-full px-2 py-0.5 border border-primary/20">{event.category}</span>
                            </button>
                        ))}
                    </div>
                    <div className="border-t border-white/[0.07] px-3 py-2.5">
                        <button onMouseDown={(e) => { e.preventDefault(); handleSubmit(query); }} className="w-full flex items-center gap-2 text-[12px] text-primary hover:text-primary/80 transition-colors font-semibold">
                            <Search size={12} /> Xem tất cả kết quả cho &ldquo;{query}&rdquo;
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
