export function EventCardSkeleton() {
    return (
        <div className="bg-card border border-white/[0.08] rounded-2xl overflow-hidden animate-pulse">
            <div className="aspect-[16/10] bg-secondary" />
            <div className="p-5 space-y-4">
                <div className="space-y-2">
                    <div className="h-4 bg-secondary rounded-md w-4/5" />
                    <div className="h-3 bg-secondary rounded-md w-3/4" />
                </div>
                <div className="space-y-2">
                    <div className="h-3 bg-secondary rounded-md w-1/2" />
                    <div className="h-3 bg-secondary rounded-md w-2/5" />
                    <div className="h-3 bg-secondary rounded-md w-3/5" />
                </div>
                <div className="pt-4 border-t border-white/[0.07] flex justify-between">
                    <div className="h-5 bg-secondary rounded-md w-24" />
                    <div className="h-5 bg-secondary rounded-md w-20" />
                </div>
            </div>
        </div>
    );
}