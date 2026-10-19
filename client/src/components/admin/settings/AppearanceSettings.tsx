import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { BentoCard, Button, Notice, SegmentedControl, StatusBadge, ThemeSegmented } from "@/components/admin/ui";
import { adminFonts, adminFontSizes, defaultAdminAppearance, type AdminAppearance } from "@/lib/admin-appearance";
import type { ThemePreference } from "@/lib/ticketbox-theme";

const FONT_OPTIONS = (Object.keys(adminFonts) as Array<AdminAppearance["font"]>).map((value) => ({ value, label: adminFonts[value].label }));
const SIZE_LABEL: Record<AdminAppearance["size"], string> = { small: "Nhỏ", default: "Mặc định", large: "Lớn" };
const SIZE_OPTIONS = (Object.keys(adminFontSizes) as Array<AdminAppearance["size"]>).map((value) => ({ value, label: `${SIZE_LABEL[value]} · ${adminFontSizes[value]}px` }));

/** Per-browser Admin preferences (theme, font, size). Nothing here reaches the server or other roles. */
export function AppearanceSettings({ appearance, onAppearance, theme, onTheme }: {
  appearance: AdminAppearance; onAppearance: (next: AdminAppearance) => boolean;
  theme: ThemePreference; onTheme: (next: ThemePreference) => void;
}) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const change = (next: AdminAppearance) => setSaved(onAppearance(next));
  const isDefault = appearance.font === defaultAdminAppearance.font && appearance.size === defaultAdminAppearance.size;

  return (
    <>
      <BentoCard span={5} title="Chủ đề" subtitle="Áp dụng ngay cho khu vực Admin; cũng đổi được ở thanh trên cùng">
        <ThemeSegmented preference={theme} onChange={onTheme} />
        <ul className="st-list">
          <li><strong>Sáng</strong> là mặc định.</li>
          <li><strong>Tự động</strong> theo giờ Việt Nam: sáng 06:00–17:59, tối 18:00–05:59 (không theo cài đặt máy).</li>
          <li>Chỉ ảnh hưởng tài khoản này trên trình duyệt này; khách mua vé và nhân viên không bị ảnh hưởng.</li>
        </ul>
      </BentoCard>

      <BentoCard span={7} title="Chữ" subtitle="Font và cỡ chữ của khu vực Admin, kể cả các khung trượt và hộp thoại"
        actions={<Button size="sm" icon={RotateCcw} disabled={isDefault} disabledReason="Đang dùng mặc định" onClick={() => change({ ...defaultAdminAppearance })}>Khôi phục mặc định</Button>}>
        <div className="st-choice">
          <span className="st-choice-label" id="st-font">Font chữ</span>
          <SegmentedControl<AdminAppearance["font"]> ariaLabel="Font chữ" value={appearance.font} options={FONT_OPTIONS} onChange={(font) => change({ ...appearance, font })} />
        </div>
        <div className="st-choice">
          <span className="st-choice-label" id="st-size">Cỡ chữ</span>
          <SegmentedControl<AdminAppearance["size"]> ariaLabel="Cỡ chữ" value={appearance.size} options={SIZE_OPTIONS} onChange={(size) => change({ ...appearance, size })} />
        </div>
        <figure className="st-preview" style={{ fontFamily: adminFonts[appearance.font].family, fontSize: adminFontSizes[appearance.size] }}>
          <figcaption>Xem trước</figcaption>
          <strong>Đêm nhạc Acoustic · 20/11/2026 20:00</strong>
          <p>Vé VIP còn 12 · 3 nhân viên được phân công · Sẵn sàng check-in</p>
          <span className="st-preview-badges"><StatusBadge domain="event" status="published" size="sm" /><StatusBadge domain="scan" status="SUCCESS" size="sm" label="Vào cổng thành công" /></span>
        </figure>
        {saved === true && <Notice tone="success">Đã lưu cho tài khoản này trên trình duyệt này.</Notice>}
        {saved === false && <Notice tone="warning">Đã áp dụng trong phiên này, nhưng trình duyệt không cho lưu; lần sau sẽ về mặc định.</Notice>}
        <p className="st-note">Lưu trên trình duyệt, không đồng bộ sang thiết bị khác.</p>
      </BentoCard>
    </>
  );
}
