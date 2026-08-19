import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import type { SortKey, Event, CategorySlug } from "@/types/event.types";
import { fetchEventList } from "@/services/event.service";
import {
    CATEGORY_FILTER_OPTIONS, CITY_OPTIONS, CITY_LABELS,
    TIME_OPTIONS, SORT_OPTIONS, PAGE_SIZE,
} from "@/constants/eventconstants";
import type { CategoryFilter } from "@/constants/eventconstants";
import { daysDiff, cn } from "@/lib/utils";
import { EventCard } from "@/components/event/EventCard";
import { EventCardSkeleton } from "@/components/event/EventCardSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { NativeSelect } from "@/components/shared/NativeSelect";

export function EventListPage() {
    const [searchParams] = useSearchParams();
    const [query, setQuery] = useState(searchParams.get("q") ?? "");
    const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(
        (searchParams.get("category") as CategoryFilter) ?? "all"
    );
    const [selectedCity, setSelectedCity] = useState("all");
    const [selectedTime, setSelectedTime] = useState("all");
    const [sortBy, setSortBy] = useState<SortKey>("upcoming");
    const [filterOpen, setFilterOpen] = useState(false);

    const [events, setEvents] = useState<Event[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const loadPage = useCallback(
        async (targetPage: number, append: boolean) => {
            append ? setLoadingMore(true) : setLoading(true);
            try {
                const { events: pageEvents, total: pageTotal } = await fetchEventList({
                    q: query || undefined,
                    category: selectedCategory === "all" ? undefined : (selectedCategory as CategorySlug),
                    city: selectedCity === "all" ? undefined : selectedCity,
                    sort: sortBy,
                    page: targetPage,
                    limit: PAGE_SIZE,
                });
                setEvents((prev) => (append ? [...prev, ...pageEvents] : pageEvents));
                setTotal(pageTotal);
                setPage(targetPage);
            } catch {
                if (!append) { setEvents([]); setTotal(0); }
            } finally {
                append ? setLoadingMore(false) : setLoading(false);
            }
        },
        [query, selectedCategory, selectedCity, sortBy]
    );

    // reset & fetch lại từ trang 1 mỗi khi filter/sort đổi (debounce cho ô tìm kiếm)
    useEffect(() => {
        const t = setTimeout(() => loadPage(1, false), query ? 400 : 0);
        return () => clearTimeout(t);
    }, [loadPage]);

    const timeFiltered = events.filter((event) => {
        if (selectedTime === "all") return true;
        const diff = daysDiff(event.startTime);
        if (selectedTime === "week") return diff >= 0 && diff <= 7;
        if (selectedTime === "month") return diff >= 0 && diff <= 30;
        return true;
    });

    const hasMore = page * PAGE_SIZE < total;

    function resetFilters() {
        setQuery(""); setSelectedCategory("all"); setSelectedCity("all"); setSelectedTime("all"); setSortBy("upcoming");
    }

    const hasActiveFilters = query || selectedCategory !== "all" || selectedCity !== "all" || selectedTime !== "all";
    const selectedCategoryLabel = CATEGORY_FILTER_OPTIONS.find((c) => c.value === selectedCategory)?.label;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="mb-8">
                <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-2">Khám phá</p>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground" style={{ fontFamily: "Manrope, sans-serif" }}>Tất cả sự kiện</h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                    {loading ? "Đang tải..." : `Hiển thị ${timeFiltered.length}/${total} sự kiện`}
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input type="text" placeholder="Tìm kiếm sự kiện, địa điểm, thành phố..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full pl-11 pr-10 py-3 rounded-xl bg-card border border-white/[0.08] text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all" />
                    {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded"><X size={14} /></button>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <ArrowUpDown size={14} className="text-muted-foreground hidden sm:block" />
                    <NativeSelect value={sortBy} onChange={(v) => setSortBy(v as SortKey)} options={SORT_OPTIONS} className="min-w-[160px]" />
                </div>

                <button onClick={() => setFilterOpen(!filterOpen)} className={cn("flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors sm:hidden", filterOpen || hasActiveFilters ? "bg-primary/15 border-primary/30 text-primary" : "bg-card border-white/[0.08] text-muted-foreground")}>
                    <SlidersHorizontal size={15} /> Bộ lọc {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
            </div>

            <div className={cn("mb-8", !filterOpen && "hidden sm:block")}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex flex-wrap gap-2 flex-1">
                        {CATEGORY_FILTER_OPTIONS.map(({ value, label }) => (
                            <button key={value} onClick={() => setSelectedCategory(value)} className={cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all", selectedCategory === value ? "bg-primary text-white border-primary shadow-lg shadow-primary/25" : "bg-card text-muted-foreground border-white/[0.08] hover:border-primary/30 hover:text-foreground")}>
                                {value !== "all" && <CategoryIcon category={value} size={11} />} {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <NativeSelect value={selectedCity} onChange={setSelectedCity} options={CITY_OPTIONS} className="min-w-[160px]" />
                        <NativeSelect value={selectedTime} onChange={setSelectedTime} options={TIME_OPTIONS} className="min-w-[160px]" />
                    </div>
                </div>

                {hasActiveFilters && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-xs text-muted-foreground">Đang lọc:</span>
                        {selectedCategory !== "all" && <button onClick={() => setSelectedCategory("all")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/25 transition-colors">{selectedCategoryLabel} <X size={10} /></button>}
                        {selectedCity !== "all" && <button onClick={() => setSelectedCity("all")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/25 transition-colors">{CITY_OPTIONS.find((c) => c.value === selectedCity)?.label} <X size={10} /></button>}
                        {selectedTime !== "all" && <button onClick={() => setSelectedTime("all")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/25 transition-colors">{TIME_OPTIONS.find((t) => t.value === selectedTime)?.label} <X size={10} /></button>}
                        {query && <button onClick={() => setQuery("")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/25 transition-colors">"{query}" <X size={10} /></button>}
                        <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">Xóa tất cả</button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <EventCardSkeleton key={i} />)
                    : timeFiltered.length > 0
                        ? timeFiltered.map((event) => <EventCard key={event.id} event={event} />)
                        : <EmptyState query={query} onReset={resetFilters} />}
            </div>

            {!loading && timeFiltered.length > 0 && (
                <div className="mt-10 flex flex-col items-center gap-4">
                    {hasMore && (
                        <button disabled={loadingMore} onClick={() => loadPage(page + 1, true)} className="flex items-center gap-2 px-8 py-3 rounded-xl border border-white/[0.08] bg-card text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-50">
                            {loadingMore ? "Đang tải..." : `Xem thêm (${total - events.length} sự kiện)`} <ChevronDown size={15} />
                        </button>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Đang xem <span className="text-foreground font-semibold">{timeFiltered.length}</span> trong <span className="text-foreground font-semibold">{total}</span> sự kiện
                    </p>
                </div>
            )}
        </div>
    );
}