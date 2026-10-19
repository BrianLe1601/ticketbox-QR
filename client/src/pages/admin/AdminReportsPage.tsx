import { BarChart3, Clock3, Download, RefreshCw, ScanLine, Ticket, Users, Wallet, WalletCards } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

import { EventScopeSelect } from "@/components/admin/EventScopeSelect";
import {
  BentoCard, BentoGrid, Button, ButtonLink, DataTable, EmptyState, FilterBar, FilterDate, FilterSelect, KpiCard, KpiGrid,
  Notice, PageHeader, PageLayout, SegmentedControl, Skeleton, StatusBadge, type Column, type FilterChip,
} from "@/components/admin/ui";
import { useAuth } from "@/context/AuthContext";
import { PRESET_LABEL, presetOf, presetRange, rangeText, type FixedPreset, type RangePreset } from "@/lib/admin-date-range";
import { formatDate, formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatTime } from "@/lib/admin-format";
import {
  GROUP_LABEL, periodLabel, periodTitle, rejectedShare, reportFileName, reportFiltersFromKey, reportFiltersFromParams, reportKey,
  ticketFunnel, type GroupBy,
} from "@/lib/admin-reports";
import { cn } from "@/lib/utils";
import { ApiRequestError } from "@/services/api";
import { exportOperations, loadReport, PAGE_SIZE, type BreakdownRow, type EventReport } from "@/services/report.service";
import "@/styles/admin/reports.css";

const PRESETS: FixedPreset[] = ["all", "7d", "30d", "month", "year"];
const message = (cause: unknown, fallback: string) => (cause instanceof Error && cause.message ? cause.message : fallback);

function RevenueTip({ active, payload, label, groupBy }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string; groupBy: GroupBy }) {
  if (!active || !payload?.length || !label) return null;
  const pick = (key: string) => Number(payload.find((p) => p.dataKey === key)?.value ?? 0);
  return (
    <div className="rp-tip">
      <span>{periodTitle(label, groupBy)}</span>
      <strong className="tb-num">Đã thu {formatMoney(pick("grossRevenue"))}</strong>
      <strong className="tb-num">Đã hoàn {formatMoney(pick("refundedAmount"))}</strong>
      <strong className="tb-num">Thu ròng {formatMoney(pick("netRevenue"))}</strong>
    </div>
  );
}

export function AdminReportsPage() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  // Filters live in the URL; a new filter captures a new snapshot, paging the breakdown reuses it.
  const filters = reportFiltersFromParams(params);
  const key = reportKey(filters);

  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; report: EventReport } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [eventName, setEventName] = useState("");
  const [customRange, setCustomRange] = useState(false);
  const [now] = useState(() => Date.now());
  const snapshot = useRef<{ key: string; id: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const snapshotId = snapshot.current?.key === key ? snapshot.current.id : null;
    let retrying = false;
    loadReport(reportFiltersFromKey(key), page, snapshotId, token, controller.signal)
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        snapshot.current = { key, id: data.snapshot.id };
        const lastPage = Math.max(1, Math.ceil(data.breakdown.meta.total / data.breakdown.meta.limit));
        if (page > lastPage) { retrying = true; setPage(lastPage); return; }
        setLoaded({ key, report: data }); setError("");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiRequestError && cause.code === "SNAPSHOT_EXPIRED") {
          snapshot.current = null; retrying = true;
          setNotice("Dữ liệu chụp đã hết hạn nên trang đã tải bản mới nhất.");
          setPage(1); setReload((n) => n + 1);
          return;
        }
        setError(message(cause, "Không thể tải báo cáo."));
      })
      .finally(() => { if (!controller.signal.aborted && !retrying) setLoading(false); });
    return () => controller.abort();
  }, [key, page, reload, token]);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [name, value] of Object.entries(changes)) { if (value) next.set(name, value); else next.delete(name); }
    setLoading(true); setPage(1); setNotice(""); setExportError("");
    setParams(next, { replace: true });
  }
  function choosePreset(preset: RangePreset) {
    if (preset === "custom") { setCustomRange(true); return; }
    setCustomRange(false);
    const range = presetRange(preset, now);
    update({ from: range.from || null, to: range.to || null });
  }
  function refresh() { snapshot.current = null; setLoading(true); setNotice(""); setExportError(""); setReload((n) => n + 1); }
  function clearAll() { setCustomRange(false); setEventName(""); update({ eventId: null, from: null, to: null, groupBy: null }); }
  function focusEvent(row: BreakdownRow) { setEventName(row.name); update({ eventId: String(row.id) }); window.scrollTo({ top: 0 }); }

  const report = loaded?.key === key ? loaded.report : null;
  const all = !filters.eventId;
  const preset = customRange ? "custom" : presetOf(filters, now, PRESETS);
  const scopeName = all ? "Tất cả sự kiện" : eventName || report?.scope.eventName || `Sự kiện #${filters.eventId}`;
  const exportReady = Boolean(report) && !loading && !exporting && !error;
  const groupBy = filters.groupBy;
  const logsLink = `/admin/checkins?${new URLSearchParams(Object.entries({ eventId: filters.eventId, from: filters.from, to: filters.to }).filter(([, v]) => v)).toString()}`;

  async function download() {
    if (!report || !exportReady) return;
    setExporting(true); setExportError("");
    try {
      const blob = await exportOperations("reports", filters, report.snapshot.id, token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = reportFileName(filters, Date.parse(report.snapshot.generatedAt));
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setExportError(cause instanceof ApiRequestError && cause.code === "SNAPSHOT_EXPIRED"
        ? "Dữ liệu chụp đã hết hạn. Bấm “Làm mới” rồi xuất Excel lại."
        : message(cause, "Không thể xuất Excel."));
    } finally { setExporting(false); }
  }

  const chips: FilterChip[] = [
    ...(filters.eventId ? [{ id: "event", label: `Sự kiện: ${scopeName}`, onRemove: () => { setEventName(""); update({ eventId: null }); } }] : []),
    ...(filters.from || filters.to ? [{ id: "range", label: `Thời gian: ${rangeText(filters)}`, onRemove: () => { setCustomRange(false); update({ from: null, to: null }); } }] : []),
  ];

  const columns: Column<BreakdownRow>[] = [
    {
      id: "event", header: "Sự kiện", cell: (row) => (
        <span className="rp-event">
          <strong>{row.name}</strong>
          <span className="rp-event-meta">{row.startTime && <span className="tb-num">{formatDate(row.startTime)}</span>}<StatusBadge domain="event" status={row.status} size="sm" /></span>
        </span>
      ),
    },
    {
      id: "fill", header: "Vé bán / sức chứa", cell: (row) => (
        <span className="rp-meter">
          <span className="tb-num"><strong>{formatNumber(row.soldTickets)}</strong> / {formatNumber(row.capacity)} · {formatPercent(row.fillRate)}</span>
          <span className="rp-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, row.fillRate)}%` }} /></span>
        </span>
      ),
    },
    { id: "attendance", header: "Vào cổng", hideable: true, cell: (row) => <span className="rp-two"><strong className="tb-num">{formatNumber(row.admissions)} vé</strong><span className="tb-num">{formatPercent(row.attendanceRate)} vé bán</span></span> },
    { id: "scans", header: "Lượt quét", hideable: true, align: "right", cell: (row) => <span className="rp-two is-right"><strong className="tb-num">{formatNumber(row.scans)}</strong><span className={cn("tb-num", row.rejectedScans > 0 && "rp-warn")}>{formatNumber(row.rejectedScans)} bị từ chối</span></span> },
    { id: "gross", header: "Đã thu", align: "right", nowrap: true, cell: (row) => <span className="tb-num">{formatMoney(row.grossRevenue)}</span> },
    { id: "refunded", header: "Đã hoàn", align: "right", nowrap: true, hideable: true, cell: (row) => <span className="tb-num">{formatMoney(row.refundedAmount)}</span> },
    { id: "net", header: "Thu ròng", align: "right", nowrap: true, cell: (row) => <strong className={cn("tb-num", row.netRevenue < 0 && "rp-negative")}>{formatMoney(row.netRevenue)}</strong> },
    {
      id: "logs", header: <span className="sr-only">Nhật ký</span>, label: "Nhật ký", align: "right", cell: (row) => (
        <ButtonLink to={`/admin/checkins?eventId=${row.id}`} size="sm" variant="ghost" icon={ScanLine} className="adm-btn--icon"
          aria-label={`Xem nhật ký check-in của ${row.name}`} title="Xem nhật ký check-in" onClick={(event) => event.stopPropagation()} />
      ),
    },
  ];

  const series = report?.revenueSeries ?? [];
  const funnel = report ? ticketFunnel(report) : [];
  const firstLoad = loading && !report;

  return (
    <PageLayout className="rpp">
      <PageHeader
        title="Báo cáo"
        description="Doanh thu mô phỏng, tỷ lệ lấp đầy và tham dự; mặc định gồm mọi sự kiện đã mở bán."
        meta={report ? <span className="tb-num"><Clock3 size={13} aria-hidden="true" /> Dữ liệu chụp lúc {formatTime(report.snapshot.generatedAt, true)} · Excel xuất đúng bản này</span> : null}
        actions={<>
          <Button icon={RefreshCw} loading={loading && Boolean(report)} onClick={refresh}>Làm mới</Button>
          <Button variant="primary" icon={Download} loading={exporting} disabled={!exportReady} onClick={() => void download()}>Xuất Excel</Button>
        </>}
      />

      <FilterBar label="Phạm vi báo cáo" chips={chips} onClearAll={clearAll}
        resultText={report ? <span className="tb-num">{all ? `${formatNumber(report.scope.eventCount)} sự kiện` : "1 sự kiện"}</span> : null}>
        <EventScopeSelect value={filters.eventId} label={scopeName} onChange={(id, name) => { setEventName(name); update({ eventId: id || null }); }} />
        <FilterSelect label="Thời gian" value={preset} onChange={(event) => choosePreset(event.target.value as RangePreset)}>
          {PRESETS.map((item) => <option key={item} value={item}>{PRESET_LABEL[item]}</option>)}
          <option value="custom">{PRESET_LABEL.custom}</option>
        </FilterSelect>
        {preset === "custom" && <>
          <FilterDate label="Từ" value={filters.from} max={filters.to || undefined} onChange={(event) => update({ from: event.target.value || null })} />
          <FilterDate label="Đến hết" value={filters.to} min={filters.from || undefined} onChange={(event) => update({ to: event.target.value || null })} />
        </>}
      </FilterBar>

      {error && <Notice tone="danger" title="Không thể tải báo cáo" action={<Button size="sm" icon={RefreshCw} onClick={refresh}>Thử lại</Button>}>{error}</Notice>}
      {exportError && <Notice tone="danger" title="Chưa xuất được Excel">{exportError}</Notice>}
      {notice && <Notice tone="info">{notice}</Notice>}

      <KpiGrid label="Chỉ số tổng hợp của phạm vi đang xem" className="rpp-kpis">
        <KpiCard label="Đã thu (mô phỏng)" icon={WalletCards} tone="success" loading={firstLoad}
          value={report ? formatMoney(report.grossRevenue) : ""} hint={report ? `${formatNumber(report.confirmedOrders)} đơn đã xác nhận` : ""}
          formula="Tổng thanh toán mô phỏng thành công, theo ngày thanh toán" />
        <KpiCard label="Thu ròng (mô phỏng)" icon={Wallet} tone="primary" loading={firstLoad}
          value={report ? formatMoney(report.netRevenue) : ""} hint={report ? `Đã hoàn ${formatMoney(report.refundedAmount)}` : ""}
          formula="Đã thu − hoàn tiền mô phỏng đã hoàn tất trong kỳ; có thể âm" />
        <KpiCard label="Tỷ lệ lấp đầy" icon={Ticket} tone="info" loading={firstLoad}
          value={report ? formatPercent(report.rates.fillRate.percent) : ""}
          hint={report ? `${formatNumber(report.rates.fillRate.numerator)} / ${formatNumber(report.rates.fillRate.denominator)} vé` : ""}
          formula="Tổng vé đã bán ÷ tổng sức chứa hạng vé (không lấy trung bình % từng sự kiện)" />
        <KpiCard label="Tỷ lệ tham dự" icon={Users} tone="warning" loading={firstLoad}
          value={report ? formatPercent(report.rates.attendanceRate.percent) : ""}
          hint={report ? `${formatNumber(report.rates.attendanceRate.numerator)} / ${formatNumber(report.rates.attendanceRate.denominator)} vé đã bán` : ""}
          formula="Vé đã vào cổng ÷ vé đã bán; khi lọc ngày có thể vượt 100%" />
      </KpiGrid>

      <BentoGrid>
        <BentoCard span={8} title="Doanh thu mô phỏng theo kỳ" subtitle={`${scopeName} · ${rangeText(filters)}`}
          actions={<SegmentedControl<GroupBy> size="sm" ariaLabel="Nhóm theo" value={groupBy}
            options={(["day", "month", "year"] as GroupBy[]).map((value) => ({ value, label: GROUP_LABEL[value] }))}
            onChange={(next) => update({ groupBy: next === "day" ? null : next })} />}>
          {report && (
            <ul className="rp-legend" aria-label="Chú thích và tổng trong kỳ">
              <li><span className="is-gross" aria-hidden="true" />Đã thu <strong className="tb-num">{formatMoney(report.grossRevenue)}</strong></li>
              <li><span className="is-refund" aria-hidden="true" />Đã hoàn <strong className="tb-num">{formatMoney(report.refundedAmount)}</strong></li>
              <li><span className="is-net" aria-hidden="true" />Thu ròng <strong className="tb-num">{formatMoney(report.netRevenue)}</strong></li>
            </ul>
          )}
          {firstLoad ? <Skeleton height="240px" /> : series.length === 0 ? (
            <EmptyState compact icon={BarChart3} title="Chưa có thanh toán hay hoàn tiền trong kỳ" description="Biểu đồ xuất hiện khi có thanh toán mô phỏng hoặc hoàn tiền đã hoàn tất." />
          ) : (
            <div className="rp-chart" role="img" aria-label={`Doanh thu mô phỏng theo ${GROUP_LABEL[groupBy].toLowerCase()}, ${series.length} kỳ: đã thu ${formatMoney(report?.grossRevenue)}, đã hoàn ${formatMoney(report?.refundedAmount)}, thu ròng ${formatMoney(report?.netRevenue)}`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={3}>
                  <CartesianGrid stroke="var(--tb-grid)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={(value: string) => periodLabel(value, groupBy)} tickLine={false} axisLine={false} tick={{ fill: "var(--tb-secondary)", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} width={68} tick={{ fill: "var(--tb-secondary)", fontSize: 12 }} tickFormatter={(value: number) => formatMoneyCompact(value)} />
                  <ChartTooltip content={<RevenueTip groupBy={groupBy} />} cursor={{ fill: "var(--tb-accent-soft)" }} />
                  <Bar dataKey="grossRevenue" fill="var(--tb-chart-1)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="refundedAmount" fill="var(--tb-chart-2)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  <Line dataKey="netRevenue" stroke="var(--tb-accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--tb-accent)" }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </BentoCard>

        <BentoCard span={4} title="Hành trình vé" subtitle="Từ sức chứa tới vé đã vào cổng"
          actions={<ButtonLink to={logsLink} size="sm" icon={ScanLine}>Nhật ký</ButtonLink>}>
          {firstLoad ? <Skeleton height="220px" /> : report && (
            <>
              <ol className="rp-funnel">
                {funnel.map((step) => (
                  <li key={step.key} className={`is-${step.key}`}>
                    <span className="rp-funnel-head"><span>{step.label}</span><strong className="tb-num">{formatNumber(step.value)}</strong></span>
                    <span className="rp-funnel-bar" aria-hidden="true"><span style={{ width: `${step.share * 100}%` }} /></span>
                    <span className="rp-funnel-note">{step.note}</span>
                  </li>
                ))}
              </ol>
              <p className="rp-scans tb-num">
                <ScanLine size={15} aria-hidden="true" /> {formatNumber(report.scans)} lượt quét · <span className={cn(report.rejectedScans > 0 && "rp-warn")}>{formatNumber(report.rejectedScans)} bị từ chối ({formatPercent(rejectedShare(report), true)})</span>
              </p>
            </>
          )}
        </BentoCard>

        <BentoCard span={12} title="Theo sự kiện" subtitle={all ? "Mọi sự kiện đã mở bán (không gồm bản nháp), gồm đã kết thúc, đã hủy và chưa có hoạt động · bấm một dòng để xem riêng" : "Sự kiện đang xem"}>
          <DataTable
            caption="Số liệu từng sự kiện trong phạm vi báo cáo"
            columns={columns}
            rows={report?.breakdown.items ?? []}
            getRowId={(row) => row.id}
            loading={loading}
            onRowClick={all ? focusEvent : undefined}
            rowActionLabel={(row) => `Xem riêng báo cáo của ${row.name}`}
            pagination={{ mode: "server", page, pageSize: report?.breakdown.meta.limit ?? PAGE_SIZE, total: report?.breakdown.meta.total ?? 0, onPageChange: (next) => { setLoading(true); setPage(next); } }}
            storageKey="admin-reports"
            empty={<EmptyState compact icon={BarChart3} title="Không có sự kiện trong phạm vi" description="Chỉ sự kiện đã mở bán mới có trong báo cáo." />}
          />
          {report && all && (
            <p className="rp-total tb-num">
              Tổng cộng {formatNumber(report.scope.eventCount)} sự kiện: {formatNumber(report.soldTickets)} / {formatNumber(report.capacity)} vé bán · {formatNumber(report.admissions)} vé vào cổng · đã thu {formatMoney(report.grossRevenue)} · thu ròng {formatMoney(report.netRevenue)}
            </p>
          )}
          <p className="rp-note">
            Tiền là dữ liệu thanh toán và hoàn tiền mô phỏng, không có giao dịch thật. Mỗi chỉ số lọc theo thời điểm riêng (xác nhận đơn, phát hành vé, vào cổng, thanh toán, hoàn tiền), nên khi lọc ngày tỷ lệ tham dự có thể vượt 100%.
          </p>
        </BentoCard>
      </BentoGrid>
    </PageLayout>
  );
}
