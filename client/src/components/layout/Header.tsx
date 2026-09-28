import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, Search } from "lucide-react";
import { NavSearch } from "@/components/layout/NavSearch";
import { cn } from "@/lib/utils";
import ticketboxLogoDark from "@/assets/brand/ticketbox-logo-dark.svg";
import ticketboxMascot from "@/assets/brand/ticketbox-mascot.svg";

export function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [mobileQuery, setMobileQuery] = useState("");

    const handleMobileSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const q = mobileQuery.trim();
        if (!q) return;
        setMenuOpen(false);
        navigate(`/events?q=${encodeURIComponent(q)}`);
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#0D0B1A]/85 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-4 h-16">
                    <button
            onClick={() => navigate("/")}
            className="flex items-center shrink-0 transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7C5CFC] rounded-lg"
            aria-label="Về trang chủ TicketBox"
          >
            <img className="h-11 w-11 object-contain drop-shadow-[0_2px_12px_rgba(124,92,252,0.35)] sm:hidden" src={ticketboxMascot} alt="TicketBox" aria-hidden="true" />
            <img className="hidden h-11 sm:h-12 w-auto max-w-[205px] object-contain object-left drop-shadow-[0_2px_14px_rgba(124,92,252,0.25)] sm:block" src={ticketboxLogoDark} alt="TicketBox" />
          </button>

                    <nav className="hidden md:flex items-center gap-1 shrink-0">
                        {[{ label: "Trang chủ", path: "/" }, { label: "Sự kiện", path: "/events" }].map(({ label, path }) => (
                            <button key={path} onClick={() => navigate(path)} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", isActive(path) ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5")}>
                                {label}
                            </button>
                        ))}
                    </nav>

                    <div className="flex-1 flex justify-center"><NavSearch /></div>

                    <button className="md:hidden ml-auto p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
                        {menuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {menuOpen && (
                <div className="md:hidden border-t border-white/[0.07] bg-[#0D0B1A]">
                    <div className="px-4 py-3 space-y-1">
                        <form onSubmit={handleMobileSearch} className="pb-2">
                            <div className="flex items-center h-10 rounded-[10px] border border-white/[0.12] bg-[#1A1730] focus-within:border-[#7C5CFC]/70 transition-all overflow-hidden">
                                <Search size={15} className="shrink-0 ml-3 text-[#9CA3AF] pointer-events-none" />
                                <input type="text" value={mobileQuery} onChange={(e) => setMobileQuery(e.target.value)} placeholder="Tìm kiếm sự kiện..." className="flex-1 h-full bg-transparent px-2.5 text-[13px] text-foreground placeholder:text-[#9CA3AF] focus:outline-none" />
                            </div>
                        </form>
                        {[{ label: "Trang chủ", path: "/" }, { label: "Sự kiện", path: "/events" }].map(({ label, path }) => (
                            <button key={path} onClick={() => { navigate(path); setMenuOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
                                {label}
                            </button>
                        ))}

                    </div>
                </div>
            )}
        </header>
    );
}
