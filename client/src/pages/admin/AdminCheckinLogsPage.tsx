import { CheckCircle2, Clock3, Copy, Download, Eye, RefreshCw, ScanLine, ShieldAlert, XCircle, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { LogDetailPanel } from "@/components/admin/checkins/LogDetailPanel";
import { EventScopeSelect } from "@/components/admin/EventScopeSelect";
import {
  BentoCard, BentoGrid, Button, DataTable, FilterBar, FilterDate, FilterSelect, IconButton, KpiCard, KpiGrid, Notice,
  PageHeader, PageLayout, StatusBadge, type Column, type FilterChip, type KpiTone,
} from "@/components/admin/ui";
import { useAuth } from "@/context/AuthContext";
import {
  exportFileName, filterKey, filtersFromKey, filtersFromParams, otherRejected, RESULT_CODES, RESULT_LABEL,
  RESULT_SEGMENTS, resultLabel, shareOf, type ResultFilter,
} from "@/lib/admin-checkin-logs";
import { presetOf, presetRange, rangeText, type RangePreset } from "@/lib/admin-date-range";
import { formatDate, formatNumber, formatPercent, formatTime } from "@/lib/admin-format";
import { listAdminStaff, type AdminStaff } from "@/services/admin-staff.service";
import { ApiRequestError } from "@/services/api";
import {
  exportOperations, loadAdminLogs, PAGE_SIZE, type AdminCheckinLog, type CheckinLogMeta, type CheckinLogStats, type SnapshotInfo,
} from "@/services/report.service";
import "@/styles/admin/checkins.css";

const SEGMENT_STYLE: Record<string, { icon: LucideIcon; tone: KpiTone }> = {
  "": { icon: ScanLine, tone: "primary" },
  SUCCESS: { icon: CheckCircle2, tone: "success" },
  FAILED: { icon: XCircle, tone: "danger" },
  ALREADY_CHECKED_IN: { icon: Copy, tone: "warning" },
  INVALID: { icon: ShieldAlert, tone: "danger" },
};

interface Loaded {
  key: string; logs: AdminCheckinLog[]; total: number; stats: CheckinLogStats;
  scope: CheckinLogMeta["scope"]; snapshot: SnapshotInfo;
}

const message = (cause: unknown, fallback: string) => (cause instanceof Error && cause.message ? cause.message : fallback);

export function AdminCheckinLogsPage() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  // Filters live in the URL (shareable, Back-aware); every new filter captures a new snapshot.
  const filters = filtersFromParams(params);
  const key = filterKey(filters);
  const result = (filters.result ?? "") as ResultFilter;

  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [selected, setSelected] = useState<AdminCheckinLog | null>(null);
  const [eventName, setEventName] = useState("");
  const [customRange, setCustomRange] = useState(false);
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [now] = useState(() => Date.now());
  // Paging reuses the snapshot being viewed so the numbers do not move while gates keep scanning.
  const snapshot = useRef<{ key: string; id: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const snapshotId = snapshot.current?.key === key ? snapshot.current.id : null;
    let retrying = false;
    loadAdminLogs(filtersFromKey(key), page, snapshotId, token, controller.signal)
      .then(({ data, meta }) => {
        if (controller.signal.aborted || !meta) return;
        const lastPage = Math.max(1, Math.ceil(meta.total / PAGE_SIZE));
        snapshot.current = { key, id: meta.snapshot.id };
        if (page > lastPage) { retrying = true; setPage(lastPage); return; }
        setLoaded({ key, logs: data, total: meta.total, stats: meta.stats, scope: meta.scope, snapshot: meta.snapshot });
        setError("");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiRequestError && cause.code === "SNAPSHOT_EXPIRED") {
          // 15-minute snapshot lapsed (or the server restarted): take a fresh one from page 1.
          snapshot.current = null; retrying = true;
          setNotice("Dữ liệu chụp đã hết hạn nên trang đã tải bản mới nhất.");
          setPage(1); setReload((n) => n + 1);
          return;
        }
        setError(message(cause, "Không thể tải nhật ký check-in."));
      })
      .finally(() => { if (!controller.signal.aborted && !retrying) setLoading(false); });
    return () => controller.abort();
  }, [key, page, reload, token]);

  useEffect(() => {
    let active = true;
    listAdminStaff()
      .then((people) => { if (active) setStaff(people.filter((person) => person.approvalStatus === "approved").sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"))); })
      .catch(() => { if (active) setStaff([]); });
    return () => { active = false; };
  }, []);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [name, value] of Object.entries(changes)) { if (value) next.set(name, value); else next.delete(name); }
    setLoading(true); setPage(1); setNotice(""); setExportError("");
    setParams(next, { replace: true });
  }
  function selectResult(next: ResultFilter) { update({ result: next || null }); }
  function choosePreset(preset: RangePreset) {
    if (preset === "custom") { setCustomRange(true); return; }
    setCustomRange(false);
    const range = presetRange(preset, now);
    update({ from: range.from || null, to: range.to || null });
  }
  function refresh() {
    snapshot.current = null;
    setLoading(true); setNotice(""); setExportError(""); setReload((n) => n + 1);
  }
  function clearAll() {
    setCustomRange(false); setEventName("");
    update({ eventId: null, from: null, to: null, staffId: null, result: null });
  }

  const current = loaded?.key === key ? loaded : null;
  const stats = current?.stats ?? null;
  const preset = customRange ? "custom" : presetOf(filters, now);
  const showEvent = !filters.eventId;
  const scopeName = filters.eventId ? eventName || current?.scope.eventName || `Sự kiện #${filters.eventId}` : "Tất cả sự kiện";
  const staffName = (id: string) => staff.find((person) => String(person.id) === id)?.fullName ?? `Nhân viên #${id}`;
  const exportReady = Boolean(current) && !loading && !exporting && !error;

  async function download() {
    if (!current || !exportReady) return;
    setExporting(true); setExportError("");
    try {
      const blob = await exportOperations("checkins", filters, current.snapshot.id, token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = exportFileName(filters, Date.parse(current.snapshot.generatedAt));
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
    ...(filters.staffId ? [{ id: "staff", label: `Nhân viên: ${staffName(filters.staffId)}`, onRemove: () => update({ staffId: null }) }] : []),
    ...(result ? [{ id: "result", label: `Kết quả: ${RESULT_LABEL[result]}`, onRemove: () => selectResult("") }] : []),
  ];

  const columns: Column<AdminCheckinLog>[] = [
    { id: "time", header: "Thời điểm", nowrap: true, cell: (row) => <span className="ck-time"><strong className="tb-num">{formatTime(row.checkedAt, true)}</strong><span className="tb-num">{formatDate(row.checkedAt)}</span></span> },
    { id: "result", header: "Kết quả", cell: (row) => <StatusBadge domain="scan" status={row.result} size="sm" label={resultLabel(row.result)} /> },
    {
      id: "ticket", header: "Vé", cell: (row) => row.ticketCode
        ? <span className="ck-ticket"><strong className="tb-num">{row.ticketCode}</strong><span>{row.ticketTypeName ?? "Chưa rõ hạng vé"}</span></span>
        : <span className="ck-ticket is-unknown"><strong>Không khớp vé nào</strong><span className="tb-num">Mã đã che {row.scannedCode ?? "—"}</span></span>,
    },
    {
      id: "holder", header: "Người giữ vé", hideable: true, cell: (row) => row.ticketCode
        ? <span className="ck-person"><strong>{row.holderName ?? row.buyerName ?? "Chưa có tên"}</strong><span>{row.holderEmail ?? row.buyerEmail ?? ""}</span></span>
        : <span className="ck-muted">—</span>,
    },
    ...(showEvent ? [{ id: "event", header: "Sự kiện", hideable: true, cell: (row: AdminCheckinLog) => <span className="ck-event">{row.eventName}</span> }] : []),
    { id: "staff", header: "Nhân viên quét", hideable: true, cell: (row) => <span className="ck-staff">{row.staffName}</span> },
    { id: "open", header: <span className="sr-only">Chi tiết</span>, label: "Chi tiết", align: "right", cell: (row) => <IconButton size="sm" variant="ghost" icon={Eye} label={`Xem chi tiết lượt quét lúc ${formatTime(row.checkedAt, true)}`} onClick={() => setSelected(row)} /> },
  ];

  const emptyTitle = result ? `Không có lượt quét "${RESULT_LABEL[result].toLowerCase()}"` : "Chưa có lượt quét nào";

  return (
    <PageLayout className="ckp">
      <PageHeader
        title="Nhật ký check-in"
        description="Mọi lượt quét tại cổng của tất cả sự kiện, gồm cả lượt bị từ chối. Nhật ký chỉ đọc."
        meta={current ? <span className="tb-num"><Clock3 size={13} aria-hidden="true" /> Dữ liệu chụp lúc {formatTime(current.snapshot.generatedAt, true)} · Excel xuất đúng bản này</span> : null}
        actions={<>
          <Button icon={RefreshCw} loading={loading && Boolean(current)} onClick={refresh}>Làm mới</Button>
          <Button variant="primary" icon={Download} loading={exporting} disabled={!exportReady} onClick={() => void download()}>Xuất Excel</Button>
        </>}
      />

      {error && <Notice tone="danger" title="Không thể tải nhật ký check-in" action={<Button size="sm" icon={RefreshCw} onClick={refresh}>Thử lại</Button>}>{error}</Notice>}
      {exportError && <Notice tone="danger" title="Chưa xuất được Excel">{exportError}</Notice>}
      {notice && <Notice tone="info">{notice}</Notice>}

      <KpiGrid label="Lọc theo kết quả quét" className="ckp-kpis">
        {RESULT_SEGMENTS.map((segment) => {
          const count = stats ? stats[segment.stat] : 0;
          const style = SEGMENT_STYLE[segment.key];
          return (
            <KpiCard
              key={segment.stat}
              label={segment.label}
              value={formatNumber(count)}
              hint={!stats ? "…" : segment.key === "" ? rangeText(filters) : segment.key === "FAILED" && otherRejected(stats) > 0
                ? `${formatPercent(shareOf(stats, segment.stat), true)} · ${formatNumber(otherRejected(stats))} lý do khác`
                : `${formatPercent(shareOf(stats, segment.stat), true)} số lượt quét`}
              icon={style.icon}
              tone={style.tone}
              loading={!stats}
              selected={result === segment.key}
              disabled={loading}
              onClick={() => selectResult(segment.key)}
              ariaLabel={segment.key === "" ? `Xem tất cả ${count} lượt quét` : `Lọc ${count} lượt quét: ${segment.label.toLowerCase()}`}
            />
          );
        })}
      </KpiGrid>

      <BentoGrid>
        <BentoCard span={12} title="Lịch sử lượt quét" subtitle={`${scopeName} · ${rangeText(filters)} · mới nhất trước`}>
          <FilterBar
            label="Lọc nhật ký check-in"
            chips={chips}
            onClearAll={clearAll}
            resultText={current ? <span className="tb-num">{formatNumber(current.total)} lượt</span> : null}
          >
            <EventScopeSelect value={filters.eventId} label={scopeName} onChange={(id, name) => { setEventName(name); update({ eventId: id || null }); }} />
            <FilterSelect label="Thời gian" value={preset} onChange={(event) => choosePreset(event.target.value as RangePreset)}>
              <option value="all">Toàn bộ</option>
              <option value="today">Hôm nay</option>
              <option value="7d">7 ngày qua</option>
              <option value="30d">30 ngày qua</option>
              <option value="custom">Tùy chọn…</option>
            </FilterSelect>
            {preset === "custom" && <>
              <FilterDate label="Từ" value={filters.from} max={filters.to || undefined} onChange={(event) => update({ from: event.target.value || null })} />
              <FilterDate label="Đến hết" value={filters.to} min={filters.from || undefined} onChange={(event) => update({ to: event.target.value || null })} />
            </>}
            <FilterSelect label="Nhân viên" value={filters.staffId ?? ""} onChange={(event) => update({ staffId: event.target.value || null })}>
              <option value="">Tất cả</option>
              {filters.staffId && !staff.some((person) => String(person.id) === filters.staffId) && <option value={filters.staffId}>Nhân viên #{filters.staffId}</option>}
              {staff.map((person) => <option key={person.id} value={person.id}>{person.fullName}{person.isActive ? "" : " · đã vô hiệu hóa"}</option>)}
            </FilterSelect>
            <FilterSelect label="Kết quả" value={result} onChange={(event) => selectResult(event.target.value as ResultFilter)}>
              <option value="">Tất cả</option>
              <option value="FAILED">{RESULT_LABEL.FAILED}</option>
              {RESULT_CODES.map((code) => <option key={code} value={code}>{RESULT_LABEL[code]}</option>)}
            </FilterSelect>
          </FilterBar>

          <DataTable
            caption="Lịch sử lượt quét check-in, mới nhất trước"
            columns={columns}
            rows={current?.logs ?? []}
            getRowId={(row) => row.id}
            loading={loading}
            onRowClick={setSelected}
            rowActionLabel={(row) => `Xem chi tiết lượt quét lúc ${formatTime(row.checkedAt, true)}`}
            rowClassName={(row) => (row.result === "SUCCESS" ? undefined : "ck-row-rejected")}
            pagination={{ mode: "server", page, pageSize: PAGE_SIZE, total: current?.total ?? 0, onPageChange: (next) => { setLoading(true); setPage(next); } }}
            storageKey="admin-checkin-logs"
            empty={
              <div className="ck-empty">
                <ScanLine size={30} aria-hidden="true" />
                <strong>{emptyTitle}</strong>
                <span>{chips.length ? "Đổi sự kiện, thời gian, nhân viên hoặc kết quả để xem lượt khác." : "Lượt quét sẽ xuất hiện khi nhân viên bắt đầu check-in tại cổng."}</span>
              </div>
            }
          />
          <p className="ck-foot">
            Mã QR gốc không được lưu hay xuất; "Mã đã che" chỉ dùng để đối chiếu. File Excel gồm toàn bộ {current ? formatNumber(current.total) : ""} lượt khớp bộ lọc (tối đa 10.000), không chỉ trang đang xem.
          </p>
        </BentoCard>
      </BentoGrid>

      <LogDetailPanel log={selected} onClose={() => setSelected(null)} />
    </PageLayout>
  );
}
