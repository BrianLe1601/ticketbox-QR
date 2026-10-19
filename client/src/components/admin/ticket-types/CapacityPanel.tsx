import { formatMoney, formatNumber } from "@/lib/admin-format";
import type { Inventory } from "@/lib/admin-ticket-types";
import type { AdminTicketType } from "@/services/admin-ticket-types.service";

/**
 * Venue seats split by tier (each tier's allocated capacity), then what is left unallocated.
 * Colours match the swatches in the tier table; every share is also written as text.
 */
export function CapacityPanel({ tiers, inv, swatch }: { tiers: AdminTicketType[]; inv: Inventory; swatch: (id: number) => string }) {
  const venue = inv.venueCapacity;
  const share = (value: number) => (venue > 0 ? Math.min(100, (value / venue) * 100) : 0);
  return (
    <div className="tt-cap">
      <p className="tt-cap-total">
        <strong className="tb-num">{formatNumber(inv.allocated)}</strong>
        <span className="tb-num"> / {formatNumber(venue)} chỗ đã phân bổ · còn trống {formatNumber(inv.unallocated)}</span>
      </p>
      <span className="tt-cap-bar" role="img" aria-label={`Đã phân bổ ${inv.allocated} trên ${venue} chỗ, còn trống ${inv.unallocated}`}>
        {tiers.map((tier) => <span key={tier.id} style={{ width: `${share(tier.capacity)}%`, background: swatch(tier.id) }} />)}
      </span>
      <ul className="tt-cap-list">
        {tiers.map((tier) => (
          <li key={tier.id}>
            <span className="tt-swatch" style={{ background: swatch(tier.id) }} aria-hidden="true" />
            <span className="tt-cap-name">{tier.name}</span>
            <span className="tt-cap-val tb-num">{formatNumber(tier.capacity)} <small>({Math.round(share(tier.capacity))}%)</small></span>
          </li>
        ))}
        <li className="is-free">
          <span className="tt-swatch is-free" aria-hidden="true" />
          <span className="tt-cap-name">Chưa phân bổ</span>
          <span className="tt-cap-val tb-num">{formatNumber(inv.unallocated)} <small>({Math.round(share(inv.unallocated))}%)</small></span>
        </li>
      </ul>
      <dl className="tt-cap-figures">
        <div><dt>Đã bán</dt><dd className="tb-num">{formatNumber(inv.sold)} vé</dd></div>
        <div><dt>Đang giữ chỗ</dt><dd className="tb-num">{formatNumber(inv.reserved)} vé</dd></div>
        <div><dt>Giá trị đã bán (mô phỏng)</dt><dd className="tb-num">{formatMoney(inv.soldValue)}</dd></div>
        <div><dt>Tối đa nếu bán hết (mô phỏng)</dt><dd className="tb-num">{formatMoney(inv.maxValue)}</dd></div>
      </dl>
    </div>
  );
}
