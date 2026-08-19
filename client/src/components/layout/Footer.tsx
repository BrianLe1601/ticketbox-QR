import { Phone, Mail, FileText, Shield, AlertCircle, Ticket } from "lucide-react";

export function Footer() {
    const col1Links = [
        { label: "Trang chủ", href: "#" }, { label: "Tất cả sự kiện", href: "#" },
        { label: "Giới thiệu", href: "#" }, { label: "Liên hệ", href: "#" },
    ];
    const col2Links = [
        { label: "Trung tâm hỗ trợ", href: "#" }, { label: "Câu hỏi thường gặp", href: "#" },
        { label: "Chính sách hoàn vé", href: "#" }, { label: "Liên hệ chúng tôi", href: "#" },
    ];
    const col3Links = [
        { label: "Điều khoản dịch vụ", href: "#", Icon: FileText },
        { label: "Chính sách bảo mật", href: "#", Icon: Shield },
        { label: "Chính sách Cookie", href: "#", Icon: Shield },
        { label: "Báo cáo sự cố", href: "#", Icon: AlertCircle },
    ];

    return (
        <footer className="border-t border-white/[0.07] mt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                    <div className="lg:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center"><Ticket size={13} className="text-white" /></div>
                            <span className="font-extrabold text-foreground text-lg" style={{ fontFamily: "Manrope, sans-serif" }}>Tick<span className="text-primary">Flow</span></span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                            Nền tảng bán vé và check-in QR thông minh hàng đầu Việt Nam. Mua vé dễ dàng, check-in nhanh chóng, không cần đăng nhập.
                        </p>
                        <div className="space-y-2.5">
                            <a href="tel:19006868" className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
                                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/15 transition-colors"><Phone size={12} className="group-hover:text-primary transition-colors" /></div>
                                <div><p className="font-semibold text-foreground">1900-6868</p><p className="text-[10px]">Hotline hỗ trợ 24/7</p></div>
                            </a>
                            <a href="mailto:support@tickflow.vn" className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
                                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/15 transition-colors"><Mail size={12} className="group-hover:text-primary transition-colors" /></div>
                                <div><p className="font-semibold text-foreground">support@tickflow.vn</p><p className="text-[10px]">Phản hồi trong 2 giờ</p></div>
                            </a>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-extrabold text-foreground uppercase tracking-widest mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Khám phá</p>
                        <ul className="space-y-2.5">{col1Links.map(({ label, href }) => <li key={label}><a href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</a></li>)}</ul>
                    </div>

                    <div>
                        <p className="text-xs font-extrabold text-foreground uppercase tracking-widest mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Hỗ trợ</p>
                        <ul className="space-y-2.5">{col2Links.map(({ label, href }) => <li key={label}><a href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</a></li>)}</ul>
                    </div>

                    <div>
                        <p className="text-xs font-extrabold text-foreground uppercase tracking-widest mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Pháp lý</p>
                        <ul className="space-y-2.5">
                            {col3Links.map(({ label, href, Icon }) => (
                                <li key={label}><a href={href} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"><Icon size={12} className="shrink-0 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />{label}</a></li>
                            ))}
                        </ul>
                        <div className="mt-5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest mb-1">Được chứng nhận</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">Nền tảng được Bộ Công Thương cấp phép hoạt động và bảo vệ người dùng theo quy định pháp luật Việt Nam.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-white/[0.07] bg-card/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>© 2026 TickFlow Technology Co., Ltd. — Mã số doanh nghiệp: 0315XXXXXXX</span>
                    <div className="flex items-center gap-4">
                        <a href="#" className="hover:text-foreground transition-colors">Điều khoản</a>
                        <a href="#" className="hover:text-foreground transition-colors">Bảo mật</a>
                        <a href="#" className="hover:text-foreground transition-colors">Cookie</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}