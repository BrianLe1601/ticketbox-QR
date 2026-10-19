import { CircleDollarSign, Clock3, Eye, PackageSearch, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { OrderDetailPanel, type OrderTab } from "@/components/admin/orders/OrderDetailPanel";
import { RefundCentre } from "@/components/admin/orders/RefundCentre";
import {
  BentoCard, BentoGrid, Button, DataTable, FilterBar, FilterSelect, IconButton, Notice, PageHeader, PageLayout, SkeletonBlock, StatusBadge,
  type Column, type FilterChip,
} from "@/components/admin/ui";
import { formatDateTime, formatMoney, formatNumber, formatTime } from "@/lib/admin-format";
import { hasRefundWorkflow, refundCentre, statusFromParam, type OrderStatusFilter } from "@/lib/admin-orders";
import { statusStyle } from "@/lib/admin-status";
import { cn } from "@/lib/utils";
import {
  getAdminOrderFilterOptions, getAdminOrderStats, listAdminOrders,
  type AdminOrderEventOption, type AdminOrderListItem, type ListOrdersFilters, type OrderStats,
} from "@/services/admin-orders.service";
import "@/styles/admin/orders.css";

const PAGE_SIZE = 8;
const STATUS_CHIPS: Array<{ key: OrderStatusFilter; label: string; stat: keyof OrderStats }> = [
  { key: "all", label: "Tổng đơn hàng", stat: "total" },
  { key: "pending_payment", label: "Chờ thanh toán", stat: "pendingPayment" },
  { key: "confirmed", label: "Đã xác nhận", stat: "confirmed" },
  { key: "expired", label: "Đã hết hạn", stat: "expired" },
  { key: "cancelled", label: "Đã hủy", stat: "cancelled" },
];

const message = (caught: unknown, fallback: string) => (caught instanceof Error && caught.message ? caught.message : fallback);

export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  // Filters that are worth sharing / Back-navigating live in the URL (Ctrl+K opens ?focus=<id>).
  const status = statusFromParam(params.get("status"));
  const eventId = params.get("eventId") ?? "";
  const focusId = Number(params.get("focus")) || null;
  const [panelTab, setPanelTab] = useState<OrderTab>("overview");

  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statsResult, setStatsResult] = useState<{ eventId: string; data: OrderStats } | null>(null);
  const [eventOptions, setEventOptions] = useState<AdminOrderEventOption[]>([]);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    const filters: ListOrdersFilters = { page, limit: PAGE_SIZE };
    if (status !== "all") filters.status = status;
    if (eventId && Number(eventId) > 0) filters.eventId = Number(eventId);
    if (buyerEmail) filters.buyerEmail = buyerEmail;
    listAdminOrders(filters).then(
      (response) => {
        if (!active) return;
        const nextTotal = response.meta?.total ?? response.data.length;
        const lastPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
        setTotal(nextTotal);
        if (page > lastPage) { setPage(lastPage); return; }
        setOrders(response.data); setError(""); setLoadedAt(new Date()); setNow(Date.now());
      },
      (caught: unknown) => { if (active) setError(message(caught, "Không thể tải danh sách đơn hàng.")); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, eventId, buyerEmail, page, refresh]);

  useEffect(() => {
    let active = true;
    getAdminOrderStats(eventId && Number(eventId) > 0 ? Number(eventId) : undefined)
      .then((data) => { if (active) setStatsResult({ eventId, data }); })
      .catch(() => { if (active) setStatsResult(null); });
    return () => { active = false; };
  }, [eventId, refresh]);

  useEffect(() => {
    let active = true;
    getAdminOrderFilterOptions().then((result) => { if (active) setEventOptions(result.events); }).catch(() => { if (active) setEventOptions([]); }).finally(() => { if (active) setOptionsLoaded(true); });
    return () => { active = false; };
  }, [refresh]);

  function setParam(key: string, value: string | null, replace = true) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace });
  }

  function selectStatus(next: OrderStatusFilter) {
    // Summary-filter contract: picking a segment resets the email search and the page.
    setLoading(true); setBuyerEmail(""); setPage(1);
    setParam("status", next === "all" ? null : next);
  }

  function openOrder(order: Pick<AdminOrderListItem, "id">, tab: OrderTab = "overview") {
    setPanelTab(tab);
    setParam("focus", String(order.id), false);
  }


  const stats = statsResult?.eventId === eventId ? statsResult.data : null;
  const selectedEvent = eventOptions.find((event) => String(event.id) === eventId) ?? null;
  const centre = useMemo(() => refundCentre(eventOptions), [eventOptions]);
  const showCentre = centre.rows.length > 0 || centre.totals.finished > 0;
  const view = params.get("view");

  // ?view=refunds (task bell, Event cancellation toast): bring the refund centre into view once.
  useEffect(() => {
    if (view !== "refunds" || !optionsLoaded) return;
    // Scroll the whole card (scroll-margin keeps it below the sticky header), then focus its summary.
    document.querySelector(".ordp .rc, .ordp .rc-done")?.scrollIntoView({ block: "start", behavior: "auto" });
    document.getElementById("hoan-tien")?.focus({ preventScroll: true });
  }, [view, optionsLoaded]);

  const chips: FilterChip[] = [
    ...(status !== "all" ? [{ id: "status", label: `Trạng thái: ${statusStyle("order", status).label}`, onRemove: () => selectStatus("all") }] : []),
    ...(selectedEvent ? [{ id: "event", label: `Sự kiện: ${selectedEvent.name}`, onRemove: () => { setPage(1); setParam("eventId", null); } }] : []),
    ...(buyerEmail ? [{ id: "email", label: `Email: ${buyerEmail}`, onRemove: () => { setBuyerEmail(""); setPage(1); } }] : []),
  ];

  const columns: Column<AdminOrderListItem>[] = [
    { id: "code", header: "Mã đơn", nowrap: true, cell: (row) => <span className="ord-code"><strong className="tb-num">{row.orderCode}</strong><span className="tb-num">{formatDateTime(row.createdAt)}</span></span> },
    { id: "buyer", header: "Người mua", cell: (row) => <span className="ord-buyer"><strong>{row.buyerName}</strong><span>{row.buyerEmail}</span></span> },
    { id: "event", header: "Sự kiện", hideable: true, cell: (row) => <span className="ord-event">{row.eventName}{row.eventStatus === "cancelled" && <StatusBadge domain="event" status="cancelled" size="sm" />}</span> },
    { id: "tiers", header: "Hạng vé", hideable: true, defaultHidden: true, cell: (row) => <span className="ord-tiers"><span title={row.ticketTypeNames}>{row.ticketTypeNames}</span><span className="tb-num">{row.totalQuantity} vé</span></span> },
    { id: "amount", header: "Tổng tiền", align: "right", nowrap: true, cell: (row) => <span className="ord-amount"><strong className="tb-num">{formatMoney(row.totalAmount)}</strong><span className="tb-num">{row.totalQuantity} vé</span></span> },
    {
      id: "status", header: "Trạng thái", cell: (row) => (
        <span className="ord-status">
          <StatusBadge domain="order" status={row.status} size="sm" />
          {hasRefundWorkflow(row) && row.refundStatus && <StatusBadge domain="refund" status={row.refundStatus} size="sm" label={`Hoàn tiền · ${statusStyle("refund", row.refundStatus).label.replace("Hoàn tiền (mô phỏng) · ", "")}`} />}
        </span>
      ),
    },
    {
      id: "actions", header: <span className="sr-only">Thao tác</span>, label: "Thao tác", align: "right", cell: (row) => (
        <span className="ord-actions">
          {hasRefundWorkflow(row) && <Button size="sm" icon={CircleDollarSign} onClick={() => openOrder(row, "refund")} aria-label={`Xử lý hoàn tiền mô phỏng cho đơn ${row.orderCode}`}>Hoàn tiền</Button>}
          <IconButton size="sm" variant="ghost" icon={Eye} label={`Xem chi tiết đơn ${row.orderCode}`} onClick={() => openOrder(row)} />
        </span>
      ),
    },
  ];


  return (
    <PageLayout className="ordp">
      <PageHeader
        title="Đơn hàng"
        description="Tra cứu giao dịch, vé đã phát hành và email; thanh toán và hoàn tiền đều là mô phỏng."
        meta={loadedAt ? <span className="tb-num"><Clock3 size={13} aria-hidden="true" /> Cập nhật lúc {formatTime(loadedAt, true)}</span> : null}
        actions={<Button icon={RefreshCw} loading={loading && Boolean(loadedAt)} onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}>Làm mới</Button>}
      />

      {error && <Notice tone="danger" title="Có lỗi khi xử lý đơn hàng">{error}</Notice>}

      <BentoGrid>
        {/* The refund centre comes from a separate request. Until it is known whether it shows, one
            placeholder holds the top slot; then each card mounts in its final place (no push-down). */}
        {!optionsLoaded ? (
          <BentoCard span={12} title="Danh sách đơn hàng" subtitle="Đang tải…">
            <SkeletonBlock lines={8} label="Đang tải đơn hàng" />
          </BentoCard>
        ) : <>
        {showCentre && (
          <RefundCentre rows={centre.rows} totals={centre.totals}
            onFilter={(id) => { setLoading(true); setPage(1); setParam("eventId", String(id)); document.querySelector(".ord-chips")?.scrollIntoView({ block: "start" }); }}
            onDone={() => { setLoading(true); setRefresh((value) => value + 1); }} />
        )}

        <BentoCard span={12} title="Danh sách đơn hàng" subtitle={selectedEvent ? `Số đếm của sự kiện ${selectedEvent.name}` : "Số đếm trên toàn bộ đơn hàng"}>
          <div className="ord-chips" role="group" aria-label="Lọc theo trạng thái đơn">
            {STATUS_CHIPS.map((chip) => (
              <button key={chip.key} type="button" className={cn("ord-chip", status === chip.key && "is-active")} aria-pressed={status === chip.key}
                aria-label={`Lọc đơn hàng: ${chip.label}${stats ? ` (${stats[chip.stat]})` : ""}`} disabled={!stats} onClick={() => selectStatus(chip.key)}>
                {chip.label}<span className="ord-chip-count tb-num">{stats ? formatNumber(stats[chip.stat]) : "—"}</span>
              </button>
            ))}
          </div>
          <FilterBar
            label="Lọc đơn hàng"
            search={{ value: buyerEmail, onChange: (value) => { setLoading(true); setBuyerEmail(value.trim()); setPage(1); }, placeholder: "Tìm theo email người mua", debounceMs: 400, searching: loading && Boolean(buyerEmail) }}
            chips={chips}
            onClearAll={() => { setBuyerEmail(""); setPage(1); const next = new URLSearchParams(params); next.delete("status"); next.delete("eventId"); setParams(next, { replace: true }); }}
            resultText={<span className="tb-num">{formatNumber(total)} đơn</span>}
          >
            <FilterSelect label="Sự kiện" value={eventId} onChange={(e) => { setLoading(true); setPage(1); setParam("eventId", e.target.value || null); }}>
              <option value="">Tất cả sự kiện</option>
              {eventOptions.map((event) => <option key={event.id} value={event.id}>{event.name}{event.status === "cancelled" ? " · Đã hủy" : ""}</option>)}
            </FilterSelect>
          </FilterBar>
          <DataTable
            caption="Danh sách đơn hàng"
            columns={columns}
            rows={orders}
            getRowId={(row) => row.id}
            loading={loading}
            onRowClick={(row) => openOrder(row)}
            rowActionLabel={(row) => `Xem chi tiết đơn ${row.orderCode}`}
            pagination={{ mode: "server", page, pageSize: PAGE_SIZE, total, onPageChange: (next) => { setLoading(true); setPage(next); } }}
            storageKey="admin-orders"
            empty={
              <div className="ord-empty">
                <PackageSearch size={30} aria-hidden="true" />
                <strong>{status === "all" ? "Không tìm thấy đơn hàng" : `Không có đơn ${statusStyle("order", status).label.toLowerCase()}`}</strong>
                <span>Thay đổi bộ lọc trạng thái, sự kiện hoặc email người mua.</span>
              </div>
            }
          />
          <p className="ord-note">Giá trị tiền là mô phỏng; dự án không chuyển tiền thật.</p>
        </BentoCard>
        </>}
      </BentoGrid>

      <OrderDetailPanel
        orderId={focusId}
        initialTab={panelTab}
        now={now || 0}
        onClose={() => { setPanelTab("overview"); setParam("focus", null); }}
        onChanged={() => setRefresh((value) => value + 1)}
      />

    </PageLayout>
  );
}
