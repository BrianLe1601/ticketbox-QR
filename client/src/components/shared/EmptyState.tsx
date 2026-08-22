import { Search } from "lucide-react";

export function EmptyState({ query, onReset }: { query: string; onReset: () => void }) {
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-card border border-white/[0.08] flex items-center justify-center">
                <Search size={24} className="text-muted-foreground" />
            </div>
            <div>
                <p className="text-foreground font-semibold text-lg" style={{ fontFamily: "Manrope, sans-serif" }}>
                    Không tìm thấy sự kiện
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                    {query ? `Không có kết quả cho "${query}".` : "Không có sự kiện nào phù hợp với bộ lọc hiện tại."}
                </p>
            </div>
            <button onClick={onReset} className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors underline underline-offset-2">
                Xóa tất cả bộ lọc
            </button>
        </div>
    );
}