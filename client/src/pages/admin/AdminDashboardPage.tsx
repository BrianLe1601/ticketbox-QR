import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Clock3, Minus, PackageCheck, RefreshCw, ScanLine, Search, Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

import {
  BentoCard, BentoGrid, Button, ButtonLink, DonutRing, EmptyState, ErrorState, Gauge, PageHeader, PageLayout, SegmentedControl, Skeleton, SparkBars,
} from "@/components/admin/ui";
import { useAuth } from "@/context/AuthContext";
import type { AdminOutletContext } from "@/layouts/AdminLayout";
import { formatMoney, formatMoneyCompact, formatNumber, formatTime } from "@/lib/admin-format";
import { buildSuggestions, sellThrough, startsInLabel, upcomingEvents } from "@/lib/admin-insights";
import { cn } from "@/lib/utils";
import type { AdminEvent } from "@/services/admin-events.service";
import { getStoredToken } from "@/services/auth.service";
import { loadReport } from "@/services/report.service";
import "@/styles/admin/dashboard.css";

interface GateStats { admissions: number; soldTickets: number }
type TableScope = "ongoing" | "upcoming";

const RINGS = ["var(--tb-ring-1)", "var(--tb-ring-2)", "var(--tb-ring-3)", "var(--tb-ring-4)"];

function dayMonth(iso: string) {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

function vnDay(iso: string) {
  const date = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return { day: String(date.getUTCDate()).padStart(2, "0"), month: `TH${date.getUTCMonth() + 1}` };
}

/** Admissions for open gates. Fetched once per visit/refresh, never polled: every report call
 *  creates an Admin snapshot and polling would evict the one the Reports page is exporting. */
function useGateStats(events: AdminEvent[], refreshKey: number) {
  const ids = events.map((event) => event.id).join(",");
  const [stats, setStats] = useState<{ key: string; byId: Record<number, GateStats | null> }>({ key: "", byId: {} });
  const key = `${ids}#${refreshKey}`;
  useEffect(() => {
    if (!ids) return;
    const controller = new AbortController();
    const token = getStoredToken();
    Promise.all(ids.split(",").map(async (id) => {
      try {
        const response = await loadReport({ eventId: id, from: "", to: "", groupBy: "day" }, 1, null, token, controller.signal);
        return [Number(id), { admissions: response.data.admissions, soldTickets: response.data.soldTickets }] as const;
      } catch {
        return [Number(id), null] as const;
      }
    })).then((entries) => { if (!controller.signal.aborted) setStats({ key: `${ids}#${refreshKey}`, byId: Object.fromEntries(entries) }); });
    return () => controller.abort();
  }, [ids, refreshKey]);
  return { byId: stats.byId, loading: Boolean(ids) && stats.key !== key };
}

function TrendTip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  const tickets = Number(payload.find((p) => p.dataKey === "ticketsSold")?.value ?? 0);
  const revenue = Number(payload.find((p) => p.dataKey === "revenue")?.value ?? 0);
  return (
    <div className="bento-tip">
      <span>Ngày {dayMonth(label)}</span>
      <strong className="tb-num">{formatNumber(tickets)} vé · {formatMoneyCompact(revenue)}</strong>
    </div>
  );
}

/** Day-over-day change from the real 7-day series (no invented trend). */
function Change({ today, yesterday, money }: { today: number; yesterday: number; money?: boolean }) {
  const diff = today - yesterday;
  const Icon: LucideIcon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const text = diff === 0 ? "bằng hôm qua" : `${diff > 0 ? "+" : "−"}${money ? formatMoneyCompact(Math.abs(diff)) : formatNumber(Math.abs(diff))} so với hôm qua`;
  return <span className={cn("bento-change", diff > 0 && "is-up", diff < 0 && "is-down")}><Icon size={14} aria-hidden="true" />{text}</span>;
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const { signals, openSearch } = useOutletContext<AdminOutletContext>();
  const { summary, activeEvents, openGates, loading, error, updatedAt, refresh } = signals;
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // null = automatic: show events happening now when there are any, otherwise upcoming ones.
  const [scopeChoice, setScope] = useState<TableScope | null>(null);
  const [insightPage, setInsightPage] = useState(0);
  const gate = useGateStats(openGates, refreshKey);

  const trend = useMemo(() => summary?.salesTrend ?? [], [summary]);
  const totals = trend.reduce((acc, point) => ({ tickets: acc.tickets + point.ticketsSold, revenue: acc.revenue + point.revenue }), { tickets: 0, revenue: 0 });
  const peak = trend.reduce<(typeof trend)[number] | null>((best, point) => (!best || point.ticketsSold > best.ticketsSold ? point : best), null);
  const today = trend.at(-1);
  const yesterday = trend.at(-2);
  const upcoming = useMemo(() => upcomingEvents(activeEvents, new Date(), 12), [activeEvents]);
  const rings = upcoming.slice(0, 4);
  // Counts come from every active Event, not the 12-item list, so the pill labels stay exact.
  const ongoingCount = activeEvents.filter((event) => event.status === "ongoing").length;
  const upcomingCount = useMemo(() => upcomingEvents(activeEvents, new Date(), Infinity).filter((event) => event.status !== "ongoing").length, [activeEvents]);
  const scope: TableScope = scopeChoice ?? (ongoingCount > 0 ? "ongoing" : "upcoming");
  const tableRows = upcoming.filter((event) => (scope === "ongoing") === (event.status === "ongoing")).slice(0, 6);
  const staffed = activeEvents.filter((event) => event.activeStaffCount > 0).length;
  const firstLoad = loading && !summary;

  const gateEvent = openGates[0];
  const gateStats = gateEvent ? gate.byId[gateEvent.id] : undefined;
  const gateRatio = gateStats && gateStats.soldTickets > 0 ? gateStats.admissions / gateStats.soldTickets : 0;
  const staffRatio = activeEvents.length ? staffed / activeEvents.length : 0;

  const insights = useMemo(() => {
    const unstaffed = upcoming.filter((event) => event.status !== "ongoing" && event.activeStaffCount === 0);
    const list: Array<{ id: string; kind: "staff" | "stock"; title: string; text: string; to: string; action: string }> = [];
    if (unstaffed.length) list.push({ id: "staff", kind: "staff", title: "Cần phân công nhân sự", text: `Có ${unstaffed.length} sự kiện sắp tới chưa có nhân viên phụ trách check-in.`, to: "/admin/staff", action: "Phân công" });
    for (const s of buildSuggestions(activeEvents)) list.push({ id: s.id, kind: "stock", title: s.title, text: s.detail, to: s.to, action: s.action });
    if (!list.some((item) => item.kind === "stock")) list.push({ id: "stock-ok", kind: "stock", title: "Tồn kho & lịch sự kiện", text: "Hiện không có sự kiện nào bán chậm hoặc sắp hết vé.", to: "/admin/ticket-types", action: "Xem hạng vé" });
    return list;
  }, [upcoming, activeEvents]);
  const pageCount = Math.max(1, Math.ceil(insights.length / 2));
  const page = Math.min(insightPage, pageCount - 1);

  async function onRefresh() {
    setRefreshing(true);
    try { await refresh(); setRefreshKey((value) => value + 1); } finally { setRefreshing(false); }
  }

  return (
    <PageLayout className="dash">
      <PageHeader
        title="Tổng quan"
        description={`Xin chào, ${user?.fullName ?? "Quản trị viên"}.`}
        meta={updatedAt ? <span className="tb-num"><Clock3 size={13} aria-hidden="true" /> Cập nhật lúc {formatTime(updatedAt, true)} · tự cập nhật mỗi phút</span> : null}
        actions={<Button icon={RefreshCw} loading={refreshing} onClick={() => void onRefresh()}>Làm mới</Button>}
      />

      {error && !summary && <ErrorState title="Không tải được số liệu tổng quan" description={error} onRetry={() => void onRefresh()} retrying={refreshing} />}

      <BentoGrid>
        {/* Row 1A — sales */}
        <BentoCard
          span={7}
          title="Vé bán 7 ngày"
          subtitle="Chỉ tính đơn đã xác nhận"
          actions={peak && peak.ticketsSold > 0 ? <span className="bento-peak tb-num">Cao nhất {dayMonth(peak.date)} · {formatNumber(peak.ticketsSold)} vé · {formatMoneyCompact(peak.revenue)}</span> : undefined}
        >
          <ul className="bento-legend" aria-label="Chú thích">
            <li><span className="is-1" aria-hidden="true" />Vé bán <strong className="tb-num">{formatNumber(totals.tickets)}</strong></li>
            <li><span className="is-2" aria-hidden="true" />Doanh thu (mô phỏng) <strong className="tb-num">{formatMoney(totals.revenue)}</strong></li>
          </ul>
          {firstLoad ? <Skeleton height="220px" /> : totals.tickets === 0 && totals.revenue === 0 ? (
            <EmptyState compact icon={PackageCheck} title="Chưa có đơn xác nhận trong 7 ngày qua" />
          ) : (
            <div className="bento-chart" role="img" aria-label={`Vé bán và doanh thu theo ngày, 7 ngày gần nhất: tổng ${formatNumber(totals.tickets)} vé, ${formatMoney(totals.revenue)}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={4}>
                  <CartesianGrid stroke="var(--tb-grid)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={dayMonth} tickLine={false} axisLine={false} tick={{ fill: "var(--tb-secondary)", fontSize: 12 }} />
                  <YAxis yAxisId="tickets" allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fill: "var(--tb-secondary)", fontSize: 12 }} />
                  <YAxis yAxisId="revenue" orientation="right" tickLine={false} axisLine={false} width={64} tick={{ fill: "var(--tb-secondary)", fontSize: 12 }} tickFormatter={(value: number) => formatMoneyCompact(value)} />
                  <ChartTooltip content={<TrendTip />} cursor={{ fill: "var(--tb-accent-soft)" }} />
                  <Bar yAxisId="tickets" dataKey="ticketsSold" fill="var(--tb-chart-1)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  <Bar yAxisId="revenue" dataKey="revenue" fill="var(--tb-chart-2)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </BentoCard>

        {/* Row 1B — gate gauges */}
        <BentoCard span={5} title="Trực cổng check-in" subtitle={gateEvent ? "Sự kiện đang mở cổng" : "Không có cổng đang mở"}
          actions={<ButtonLink to={gateEvent ? `/admin/checkins?eventId=${gateEvent.id}` : "/admin/checkins"} size="sm" variant="primary" icon={ScanLine}>Nhật ký</ButtonLink>}>
          <div className="bento-gauges">
            <figure className="bento-gauge">
              {firstLoad || (gateEvent && gate.loading) ? <Skeleton height="120px" /> : (
                <Gauge
                  value={gateRatio}
                  label={gateEvent ? `Đã vào cổng ${gateStats ? `${gateStats.admissions} trên ${gateStats.soldTickets} vé` : "chưa tải được"}` : "Không có cổng đang mở"}
                  zones={[{ to: 0.4, color: "var(--tb-gauge-bad)" }, { to: 0.75, color: "var(--tb-gauge-mid)" }, { to: 1, color: "var(--tb-gauge-good)" }]}
                >
                  <strong className="tb-num">{gateEvent ? (gateStats ? `${formatNumber(gateStats.admissions)} / ${formatNumber(gateStats.soldTickets)} vé` : "—") : "0"}</strong>
                </Gauge>
              )}
              <figcaption>
                <span className="bento-gauge-name">{gateEvent ? gateEvent.name : upcoming[0] ? `Tiếp theo: ${upcoming[0].name}` : "Chưa có sự kiện sắp tới"}</span>
                <span className="bento-gauge-rate tb-num">
                  {gateEvent ? `Đã vào cổng · ${Math.round(gateRatio * 100)}%` : upcoming[0] ? startsInLabel(upcoming[0].startTime, upcoming[0].status) : "—"}
                </span>
              </figcaption>
            </figure>
            <figure className="bento-gauge">
              {firstLoad ? <Skeleton height="120px" /> : (
                <Gauge
                  value={staffRatio}
                  label={`${staffed} trên ${activeEvents.length} sự kiện đang hoạt động có nhân viên trực`}
                  zones={[{ to: 0.5, color: "var(--tb-gauge-bad)" }, { to: 0.8, color: "var(--tb-gauge-mid)" }, { to: 1, color: "var(--tb-gauge-good)" }]}
                >
                  <strong className="tb-num">{formatNumber(staffed)} / {formatNumber(activeEvents.length)}</strong>
                </Gauge>
              )}
              <figcaption>
                <span className="bento-gauge-name">Sự kiện có nhân viên trực</span>
                <span className="bento-gauge-rate tb-num">Đã phân công · {Math.round(staffRatio * 100)}%</span>
              </figcaption>
            </figure>
          </div>
        </BentoCard>

        {/* Row 2 — stock rings */}
        <BentoCard span={12} title="Tồn kho vé" subtitle="Tỷ lệ đã bán của các sự kiện sắp tới"
          actions={<ButtonLink to="/admin/ticket-types" size="sm" variant="ghost" iconRight={ArrowRight}>Hạng vé</ButtonLink>}>
          {firstLoad ? <Skeleton height="96px" /> : rings.length === 0 ? (
            <EmptyState compact icon={CalendarDays} title="Không có sự kiện đã công bố sắp diễn ra" />
          ) : (
            <ul className="bento-rings">
              {rings.map((event, index) => {
                const { day, month } = vnDay(event.startTime);
                return (
                  <li key={event.id}>
                    <Link to={`/admin/ticket-types?eventId=${event.id}`} className="bento-ring">
                      <DonutRing value={sellThrough(event)} color={RINGS[index % RINGS.length]} />
                      <span className="bento-ring-text">
                        <strong className="bento-ring-name">{event.name}</strong>
                        <span className="bento-ring-sub">
                          {event.status === "ongoing" ? `Đang diễn ra · ${formatTime(event.startTime)}` : event.visibility === "hidden" ? `${day} ${month} · Đang ẩn` : `${day} ${month} · ${startsInLabel(event.startTime, event.status)}`}
                        </span>
                        <span className="bento-ring-count tb-num">{formatNumber(event.soldQuantity)}<small>/{formatNumber(event.allocatedCapacity)} vé</small></span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </BentoCard>

        {/* Row 3A — events table */}
        <BentoCard span={6} title={scope === "ongoing" ? "Sự kiện đang diễn ra" : "Sự kiện sắp tới"}
          actions={<>
            <button type="button" className="bento-search" onClick={openSearch} aria-keyshortcuts="Control+K Meta+K"><Search size={14} aria-hidden="true" />Tìm nhanh<kbd aria-hidden="true">Ctrl K</kbd></button>
            <SegmentedControl<TableScope> size="sm" ariaLabel="Phạm vi sự kiện" value={scope} onChange={setScope} options={[{ value: "ongoing", label: `Đang diễn ra (${ongoingCount})` }, { value: "upcoming", label: `Sắp tới (${upcomingCount})` }]} />
          </>}>
          {firstLoad ? <Skeleton height="200px" /> : tableRows.length === 0 ? (
            <EmptyState compact icon={CalendarDays} title={scope === "upcoming" ? "Không có sự kiện đã công bố sắp diễn ra" : "Không có sự kiện đang diễn ra"} />
          ) : (
            <div className="bento-table-wrap">
              <table className="bento-table">
                <caption className="sr-only">{scope === "ongoing" ? "Sự kiện đang diễn ra" : "Sự kiện sắp tới"} và phân công</caption>
                <thead><tr><th scope="col">Sự kiện</th><th scope="col">Vé đã bán</th><th scope="col">Trạng thái</th><th scope="col">Nhân sự trực</th></tr></thead>
                <tbody>
                  {tableRows.map((event) => {
                    const { day, month } = vnDay(event.startTime);
                    const status = event.status === "ongoing" ? { text: "Đang diễn ra", tone: "live" } : event.visibility === "hidden" ? { text: "Đang ẩn", tone: "bad" } : { text: "Đã công bố", tone: "good" };
                    return (
                      <tr key={event.id}>
                        <td>
                          <Link to={`/admin/events?focus=${event.id}`} className="bento-event">
                            <span className={cn("bento-date", event.status === "ongoing" && "is-live")} aria-hidden="true"><strong>{day}</strong><small>{month}</small></span>
                            <span className="bento-event-name">{event.name}</span>
                          </Link>
                        </td>
                        <td><span className="bento-pill tb-num">{formatNumber(event.soldQuantity)} / {formatNumber(event.allocatedCapacity)}</span></td>
                        <td><span className={cn("bento-status", `is-${status.tone}`)}><span aria-hidden="true" />{status.text}</span></td>
                        <td>{event.activeStaffCount
                          ? <strong className="bento-staff"><Users size={14} aria-hidden="true" />{event.activeStaffCount} nhân viên</strong>
                          : <span className="bento-staff is-warn"><Users size={14} aria-hidden="true" />Chưa có nhân viên</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </BentoCard>

        {/* Row 3B — order analytics */}
        <BentoCard span={3} title="Phân tích đơn hàng" subtitle="Thanh toán là mô phỏng">
          {firstLoad ? <Skeleton height="200px" /> : (
            <ul className="bento-metrics">
              <li>
                <span className="bento-metric-text">
                  <span className="bento-metric-label">Giá trị đơn (mô phỏng)</span>
                  <strong className="bento-metric-value tb-num">{formatMoneyCompact(summary?.orders.totalRevenue)}</strong>
                  {today && yesterday ? <Change today={today.revenue} yesterday={yesterday.revenue} money /> : null}
                </span>
                <SparkBars values={trend.map((point) => point.revenue)} color="var(--tb-spark-1)" />
              </li>
              <li>
                <span className="bento-metric-text">
                  <span className="bento-metric-label">Vé bán 7 ngày</span>
                  <strong className="bento-metric-value tb-num">{formatNumber(totals.tickets)}</strong>
                  {today && yesterday ? <Change today={today.ticketsSold} yesterday={yesterday.ticketsSold} /> : null}
                </span>
                <SparkBars values={trend.map((point) => point.ticketsSold)} color="var(--tb-spark-2)" />
              </li>
              <li>
                <span className="bento-metric-text">
                  <span className="bento-metric-label">Đơn chờ thanh toán</span>
                  <strong className="bento-metric-value tb-num">{formatNumber(summary?.orders.pending)}</strong>
                  <span className="bento-metric-note">Đang giữ vé · {formatNumber(summary?.orders.confirmed)} đơn đã xác nhận</span>
                </span>
              </li>
              <li>
                <span className="bento-metric-text">
                  <span className="bento-metric-label">Check-in hôm nay</span>
                  <strong className="bento-metric-value tb-num">{formatNumber(summary?.checkins.todaySuccess)}</strong>
                  <span className="bento-metric-note">Lượt quét hợp lệ · {formatNumber(summary?.tickets.issued)} vé chưa vào</span>
                </span>
              </li>
            </ul>
          )}
        </BentoCard>

        {/* Row 3C — suggestions */}
        <BentoCard span={3} title="Gợi ý vận hành" subtitle="Tự động từ lịch và tồn kho">
          {firstLoad ? <Skeleton height="200px" /> : (
            <>
              <ul className="bento-notes" aria-live="polite">
                {insights.slice(page * 2, page * 2 + 2).map((item) => (
                  <li key={item.id} className="bento-note">
                    <span className={cn("bento-note-icon", `is-${item.kind}`)} aria-hidden="true">{item.kind === "staff" ? <Users size={18} /> : <PackageCheck size={18} />}</span>
                    <div className="bento-note-body">
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                      <Link to={item.to} className="bento-note-link">{item.action}<ArrowRight size={13} aria-hidden="true" /></Link>
                    </div>
                  </li>
                ))}
              </ul>
              {pageCount > 1 && (
                <div className="bento-dots" role="group" aria-label="Trang gợi ý">
                  {Array.from({ length: pageCount }, (_, index) => (
                    <button key={index} type="button" className={cn(index === page && "is-active")} aria-label={`Trang ${index + 1}`} aria-pressed={index === page} onClick={() => setInsightPage(index)} />
                  ))}
                </div>
              )}
            </>
          )}
        </BentoCard>
      </BentoGrid>
    </PageLayout>
  );
}
