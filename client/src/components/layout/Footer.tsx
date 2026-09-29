import { Link } from "react-router-dom";
import ticketboxLogoDark from "@/assets/brand/ticketbox-logo-dark.svg";

export function Footer() {
    return (
        <footer className="border-t border-white/[0.07] mt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-8 lg:gap-12">
                    <div className="lg:col-span-1">
                        <div className="mb-4">
                            <img className="h-12 w-auto max-w-[210px] object-contain object-left drop-shadow-[0_2px_14px_rgba(124,92,252,0.25)]" src={ticketboxLogoDark} alt="TicketBox" />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                            Nền tảng bán vé và check-in QR thông minh. Mua vé dễ dàng, check-in nhanh chóng, không cần đăng nhập.
                        </p>

                    </div>

                    <div>
                        <p className="text-xs font-extrabold text-foreground uppercase tracking-widest mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Khám phá</p>
                        <ul className="space-y-2.5">
                            <li><Link to="/" className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2">Trang chủ</Link></li>
                            <li><Link to="/events" className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2">Tất cả sự kiện</Link></li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="border-t border-white/[0.07] bg-card/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>TicketBoxQR · Dự án mô phỏng bán vé và check-in</span>

                </div>
            </div>
        </footer>
    );
}
