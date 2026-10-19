import { Edit3 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, SlideOver, StatusBadge } from "@/components/admin/ui";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/admin-format";
import { canEditTier, salesWindow, tierState } from "@/lib/admin-ticket-types";
import type { AdminEvent } from "@/services/admin-events.service";
import type { AdminTicketType } from "@/services/admin-ticket-types.service";
import { TierBar } from "./TierTable";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="tt-dl-row"><dt>{label}</dt><dd>{children}</dd></div>;
}

/** Read-only inventory audit of one tier. Keeps the last tier while closing so focus returns. */
export function TierDetailPanel({ tier, event, now, onClose, onEdit }: {
  tier: AdminTicketType | null; event: AdminEvent; now: number; onClose: () => void; onEdit: (tier: AdminTicketType) => void;
}) {
  const [kept, setKept] = useState<AdminTicketType | null>(tier);
  if (tier && tier !== kept) setKept(tier);
  const shown = tier ?? kept;
  if (!shown) return null;
  const edit = canEditTier(event);
  const sales = salesWindow(shown, event);
  return (
    <SlideOver
      open={Boolean(tier)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      size="md"
      title={shown.name}
      description={event.name}
      headerExtra={<div className="tt-detail-flags"><StatusBadge domain="tier" status={tierState(shown, event, now)} size="sm" /></div>}
      footer={<Button variant="primary" icon={Edit3} disabled={!edit.allowed} disabledReason={edit.reason} onClick={() => onEdit(shown)}>Chỉnh sửa</Button>}
    >
      <div className="tt-detail">
        <p className="tt-detail-price tb-num">{shown.price === 0 ? "Miễn phí" : formatMoney(shown.price)}</p>
        {shown.description && <p className="tt-detail-desc">{shown.description}</p>}
        <section className="tt-detail-sec" aria-label="Tồn kho">
          <TierBar tier={shown} />
          <dl className="tt-dl">
            <Row label="Số vé phát hành"><span className="tb-num">{formatNumber(shown.capacity)}</span></Row>
            <Row label="Đã bán"><span className="tb-num">{formatNumber(shown.soldQuantity)}</span></Row>
            <Row label="Đang giữ chỗ"><span className="tb-num">{formatNumber(shown.reservedQuantity)}</span></Row>
            <Row label="Còn lại"><span className="tb-num">{formatNumber(Math.max(0, shown.availableQuantity))}</span></Row>
          </dl>
        </section>
        <section className="tt-detail-sec" aria-label="Quy tắc bán">
          <dl className="tt-dl">
            <Row label="Tối đa mỗi đơn"><span className="tb-num">{shown.maxPerOrder} vé</span></Row>
            <Row label="Mở bán"><span className="tb-num">{sales.start ? formatDateTime(sales.start) : "Ngay khi công bố"}{sales.inherited ? " (theo sự kiện)" : ""}</span></Row>
            <Row label="Kết thúc bán"><span className="tb-num">{sales.end ? formatDateTime(sales.end) : "Khi sự kiện kết thúc"}{sales.inherited ? " (theo sự kiện)" : ""}</span></Row>
            <Row label="Giá trị đã bán (mô phỏng)"><span className="tb-num">{formatMoney(shown.soldQuantity * shown.price)}</span></Row>
            <Row label="Cập nhật lần cuối"><span className="tb-num">{formatDateTime(shown.updatedAt)}</span></Row>
          </dl>
        </section>
        <p className="tt-detail-note">Đơn hàng giữ và bán vé trong cùng giao dịch có khóa, nên không bán vượt số vé phát hành.</p>
      </div>
    </SlideOver>
  );
}
