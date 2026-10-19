import { Edit3, Eye, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

import { ActionMenu, IconButton, StatusBadge } from "@/components/admin/ui";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatTime } from "@/lib/admin-format";
import { canDeleteTier, canEditTier, canToggleSales, salesWindow, tierState } from "@/lib/admin-ticket-types";
import { cn } from "@/lib/utils";
import type { AdminEvent } from "@/services/admin-events.service";
import type { AdminTicketType } from "@/services/admin-ticket-types.service";

export interface TierHandlers {
  edit: (tier: AdminTicketType) => void;
  detail: (tier: AdminTicketType) => void;
  toggle: (tier: AdminTicketType) => void;
  remove: (tier: AdminTicketType) => void;
}

/** Stacked bar of one tier: sold, reserved, rest available (values are also written as text). */
export function TierBar({ tier }: { tier: Pick<AdminTicketType, "capacity" | "soldQuantity" | "reservedQuantity"> }) {
  const pct = (value: number) => (tier.capacity > 0 ? `${(value / tier.capacity) * 100}%` : "0%");
  return (
    <span className="tt-bar" role="img" aria-label={`Đã bán ${tier.soldQuantity}, đang giữ ${tier.reservedQuantity} trên ${tier.capacity} vé`}>
      <span className="is-sold" style={{ width: pct(tier.soldQuantity) }} />
      <span className="is-reserved" style={{ width: pct(tier.reservedQuantity) }} />
    </span>
  );
}

/** "08/11 19:00": the year is the Event's, shown in the context row and in the title text. */
const short = (iso: string) => `${formatDate(iso).slice(0, 5)} ${formatTime(iso)}`;

const INTERACTIVE = "button, a, input, [role='menuitem']";

/**
 * Side-by-side comparison of an Event's tiers (price, sales progress, window, state). Rows open
 * the detail panel; actions stay in the last column. Below 760px each row becomes a card.
 */
export function TierTable({ tiers, event, now, handlers, pendingId, swatch }: {
  tiers: AdminTicketType[]; event: AdminEvent; now: number; handlers: TierHandlers; pendingId: number | null; swatch: (id: number) => string;
}) {
  const onSale = event.status === "published" || event.status === "ongoing";
  const activeCount = tiers.filter((tier) => tier.isActive).length;
  const edit = canEditTier(event);
  const total = tiers.reduce((acc, tier) => ({
    capacity: acc.capacity + tier.capacity, sold: acc.sold + tier.soldQuantity, reserved: acc.reserved + tier.reservedQuantity, available: acc.available + Math.max(0, tier.availableQuantity),
  }), { capacity: 0, sold: 0, reserved: 0, available: 0 });

  function open(event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>, tier: AdminTicketType) {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    if ("key" in event && event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handlers.detail(tier);
  }

  return (
    <div className="tt-table-wrap">
      <table className="tt-table">
        <caption className="sr-only">Hạng vé của {event.name}, sắp xếp theo giá</caption>
        <thead>
          <tr>
            <th scope="col">Hạng vé</th>
            <th scope="col" className="is-num">Giá</th>
            <th scope="col">Bán · Giữ · Còn</th>
            <th scope="col">Khung bán</th>
            <th scope="col" className="is-actions"><span className="sr-only">Thao tác</span></th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => {
            const toggle = canToggleSales(tier, event, activeCount - (tier.isActive ? 1 : 0), now);
            const remove = canDeleteTier(tier, event, activeCount - (tier.isActive ? 1 : 0));
            const sales = salesWindow(tier, event);
            const state = tierState(tier, event, now);
            const used = tier.soldQuantity + tier.reservedQuantity;
            return (
              <tr key={tier.id} className={cn(`is-${state}`)} tabIndex={0} aria-label={`${tier.name}: xem chi tiết`}
                onClick={(e) => open(e, tier)} onKeyDown={(e) => open(e, tier)}>
                <td data-label="Hạng vé">
                  <span className="tt-name">
                    <span className="tt-swatch" style={{ background: swatch(tier.id) }} aria-hidden="true" />
                    <span className="tt-name-text">
                      <strong>{tier.name}</strong>
                      <StatusBadge domain="tier" status={state} size="sm" />
                      {tier.description && <span className="tt-desc">{tier.description}</span>}
                    </span>
                  </span>
                </td>
                <td data-label="Giá" className="is-num">
                  <strong className="tt-price tb-num">{tier.price === 0 ? "Miễn phí" : formatMoney(tier.price)}</strong>
                  <span className="tt-sub tb-num">tối đa {tier.maxPerOrder}/đơn</span>
                </td>
                <td data-label="Bán · Giữ · Còn">
                  <span className="tt-progress">
                    <TierBar tier={tier} />
                    <span className="tt-sub tb-num">
                      <strong>{formatNumber(tier.soldQuantity)}</strong> · {formatNumber(tier.reservedQuantity)} · {formatNumber(Math.max(0, tier.availableQuantity))}
                      <span className="tt-of">trên {formatNumber(tier.capacity)} vé ({tier.capacity ? Math.round((used / tier.capacity) * 100) : 0}%)</span>
                    </span>
                  </span>
                </td>
                <td data-label="Khung bán">
                  <span className="tt-window tb-num" title={`${sales.start ? formatDateTime(sales.start) : "Khi công bố"} → ${sales.end ? formatDateTime(sales.end) : "hết sự kiện"}`}>
                    <span>{sales.start ? short(sales.start) : "Khi công bố"}</span>
                    <span>→ {sales.end ? short(sales.end) : "hết sự kiện"}</span>
                  </span>
                  {sales.inherited && <span className="tt-inherit">theo sự kiện</span>}
                </td>
                <td className="is-actions">
                  <span className="tt-actions">
                    {onSale && (
                      <IconButton
                        size="sm"
                        variant={tier.isActive ? "secondary" : "primary"}
                        icon={tier.isActive ? PauseCircle : PlayCircle}
                        label={tier.isActive ? `Tạm dừng ${tier.name}` : `Mở bán ${tier.name}`}
                        loading={pendingId === tier.id}
                        disabled={!toggle.allowed}
                        disabledReason={toggle.reason}
                        onClick={() => handlers.toggle(tier)}
                      />
                    )}
                    <IconButton size="sm" variant="secondary" icon={Edit3} label={`Sửa ${tier.name}`} disabled={!edit.allowed} disabledReason={edit.reason} onClick={() => handlers.edit(tier)} />
                    <ActionMenu
                      label={`Thao tác khác cho ${tier.name}`}
                      actions={[
                        { label: "Xem chi tiết", icon: Eye, onSelect: () => handlers.detail(tier) },
                        { label: "Xóa hạng vé", icon: Trash2, tone: "danger", onSelect: () => handlers.remove(tier), disabled: !remove.allowed, disabledReason: remove.reason },
                      ]}
                    />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        {tiers.length > 1 && (
          <tfoot>
            <tr>
              <th scope="row">Tổng {tiers.length} hạng</th>
              <td className="is-num" />
              <td colSpan={3}>
                <span className="tt-sub tb-num"><strong>{formatNumber(total.sold)}</strong> · {formatNumber(total.reserved)} · {formatNumber(total.available)}<span className="tt-of"> / {formatNumber(total.capacity)} vé</span></span>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
