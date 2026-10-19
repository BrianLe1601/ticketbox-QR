/**
 * Pure report math. Every ratio is computed from summed numerator and denominator,
 * never by averaging per-Event percentages (which would weight a 10-seat Event like a 10,000-seat one).
 */
export interface EventCounts {
  confirmedOrders: number; soldTickets: number; issuedTickets: number; admissions: number;
  scans: number; rejectedScans: number; capacity: number; grossRevenue: number; refundedAmount: number;
}
export interface EventMetrics extends EventCounts { netRevenue: number; fillRate: number; attendanceRate: number }
export interface RateBasis { numerator: number; denominator: number; percent: number }
export interface RateBasisSet { fillRate: RateBasis; attendanceRate: RateBasis }

const COUNT_KEYS = [
  'confirmedOrders', 'soldTickets', 'issuedTickets', 'admissions', 'scans', 'rejectedScans', 'capacity',
] as const;

export const roundMoney = (value: number) => Math.round(value * 100) / 100;
export const percent = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

export function withDerived(counts: EventCounts): EventMetrics {
  return {
    ...counts,
    netRevenue: roundMoney(counts.grossRevenue - counts.refundedAmount),
    fillRate: percent(counts.soldTickets, counts.capacity),
    attendanceRate: percent(counts.admissions, counts.soldTickets),
  };
}

export function sumCounts(rows: EventCounts[]): EventMetrics {
  const totals = {
    confirmedOrders: 0, soldTickets: 0, issuedTickets: 0, admissions: 0, scans: 0, rejectedScans: 0,
    capacity: 0, grossRevenue: 0, refundedAmount: 0,
  };
  for (const row of rows) {
    for (const key of COUNT_KEYS) totals[key] += Number(row[key]);
    totals.grossRevenue += Number(row.grossRevenue);
    totals.refundedAmount += Number(row.refundedAmount);
  }
  totals.grossRevenue = roundMoney(totals.grossRevenue);
  totals.refundedAmount = roundMoney(totals.refundedAmount);
  return withDerived(totals);
}

export function rateBasis(metrics: EventMetrics): RateBasisSet {
  return {
    fillRate: { numerator: metrics.soldTickets, denominator: metrics.capacity, percent: metrics.fillRate },
    attendanceRate: { numerator: metrics.admissions, denominator: metrics.soldTickets, percent: metrics.attendanceRate },
  };
}
