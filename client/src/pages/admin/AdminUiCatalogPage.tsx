import {
  CalendarDays, CalendarRange, Copy, Eye, KanbanSquare, LayoutGrid, List, Mail, Pencil, Plus, ScanLine, Ticket, Trash2, Users, Wallet,
} from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
  ActionMenu, Avatar, Button, ButtonLink, ConfirmDialog, DataTable, EmptyState, ErrorState, Field, FilterBar, FilterDate,
  FilterSelect, IconButton, Input, KpiCard, KpiGrid, Notice, PageHeader, PageLayout, Panel, Popover, PopoverClose,
  SegmentedControl, Select, SkeletonBlock, SlideOver, StatusBadge, Switch, TabPanel, Tabs, Textarea, ThemeSegmented,
  notify, type Column,
} from "@/components/admin/ui";
import { formatDateTime, formatMoney } from "@/lib/admin-format";
import { statusValues, type StatusDomain } from "@/lib/admin-status";
import type { RowId } from "@/lib/admin-table";
import type { AdminOutletContext } from "@/layouts/AdminLayout";
import "@/styles/admin/catalog.css";

/**
 * Design-system catalogue (/admin/_ui). Not in the navigation; for review and visual QA in
 * both themes. All figures here are labelled illustrations, never system data.
 */
interface SampleOrder { id: number; code: string; buyer: string; email: string; status: string; amount: number; createdAt: string }

const SAMPLE: SampleOrder[] = [
  { id: 1, code: "MẪU-0001", buyer: "Nguyễn Văn An", email: "an@example.com", status: "confirmed", amount: 1500000, createdAt: "2026-10-17T12:30:00Z" },
  { id: 2, code: "MẪU-0002", buyer: "[DEMO] 1 Trần Bình", email: "binh@example.com", status: "pending_payment", amount: 850000, createdAt: "2026-10-17T13:05:00Z" },
  { id: 3, code: "MẪU-0003", buyer: "Lê Thu Hà", email: "ha@example.com", status: "expired", amount: 450000, createdAt: "2026-10-16T09:10:00Z" },
  { id: 4, code: "MẪU-0004", buyer: "Phạm Quốc Huy", email: "huy@example.com", status: "cancelled", amount: 2300000, createdAt: "2026-10-15T15:45:00Z" },
  { id: 5, code: "MẪU-0005", buyer: "Đặng Mỹ Linh", email: "linh@example.com", status: "confirmed", amount: 3600000, createdAt: "2026-10-14T11:00:00Z" },
];

const DOMAINS: StatusDomain[] = ["event", "visibility", "order", "payment", "refund", "ticket", "staff", "tier", "scan", "email", "category"];

const SWATCHES = [
  ["--tb-bg", "Nền trang"], ["--tb-surface", "Thẻ"], ["--tb-surface-2", "Hover / header bảng"], ["--tb-border", "Viền"],
  ["--tb-text", "Chữ"], ["--tb-muted", "Chữ phụ"], ["--tb-accent", "Chính (indigo)"], ["--tb-success", "Thành công"],
  ["--tb-warning", "Cảnh báo"], ["--tb-danger", "Nguy hiểm"], ["--tb-info", "Thông tin"], ["--tb-live", "Đang diễn ra"],
  ["--tb-nav-bg", "Sidebar"],
] as const;

export function AdminUiCatalogPage() {
  const { themePreference, setThemePreference } = useOutletContext<AdminOutletContext>();
  const [view, setView] = useState<"grid" | "list" | "calendar" | "kanban">("grid");
  const [tab, setTab] = useState("overview");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<RowId>>(new Set());
  const [slideOpen, setSlideOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [kpi, setKpi] = useState("all");
  const [loadingDemo, setLoadingDemo] = useState(false);

  const rows = SAMPLE.filter((row) => (filter === "all" || row.status === filter)
    && (!search || `${row.code} ${row.buyer} ${row.email}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))));
  const selectedRows = SAMPLE.filter((row) => selected.has(row.id));
  const eligible = selectedRows.filter((row) => row.status === "confirmed");

  const columns: Column<SampleOrder>[] = [
    { id: "code", header: "Mã đơn", cell: (row) => <span className="tb-mono">{row.code}</span>, sortValue: (row) => row.code, nowrap: true },
    { id: "buyer", header: "Người mua", cell: (row) => <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Avatar name={row.buyer} size="sm" />{row.buyer}</span>, sortValue: (row) => row.buyer },
    { id: "email", header: "Email", cell: (row) => row.email, hideable: true },
    { id: "status", header: "Trạng thái", cell: (row) => <StatusBadge domain="order" status={row.status} />, sortValue: (row) => row.status, hideable: true },
    { id: "amount", header: "Giá trị (mô phỏng)", label: "Giá trị", align: "right", cell: (row) => formatMoney(row.amount), sortValue: (row) => row.amount, hideable: true, nowrap: true },
    { id: "created", header: "Tạo lúc", cell: (row) => formatDateTime(row.createdAt), sortValue: (row) => row.createdAt, hideable: true, nowrap: true },
    {
      id: "actions", header: <span className="sr-only">Thao tác</span>, label: "Thao tác", align: "right",
      cell: (row) => (
        <span style={{ display: "inline-flex", gap: 4 }}>
          <IconButton icon={Eye} label={`Xem ${row.code}`} size="sm" onClick={() => setSlideOpen(true)} />
          <ActionMenu actions={[
            { label: "Gửi lại email vé", icon: Mail, onSelect: () => notify.info("Mẫu: thao tác gửi lại email") },
            { label: "Sao chép mã đơn", icon: Copy, onSelect: () => notify.success(`Mẫu: đã sao chép ${row.code}`) },
            { label: "Hủy đơn", icon: Trash2, tone: "danger", disabled: row.status !== "pending_payment", disabledReason: "Chỉ hủy được đơn đang chờ thanh toán", onSelect: () => setConfirmOpen(true) },
          ]} />
        </span>
      ),
    },
  ];

  async function fakeConfirm() {
    setPending(true);
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    setPending(false);
    setConfirmOpen(false);
    notify.success("Mẫu: đã xác nhận", { description: "Không có dữ liệu nào bị thay đổi." });
  }

  return (
    <PageLayout>
      <PageHeader
        title="Bộ giao diện Admin"
        description="Danh mục component dùng chung. Mọi số liệu trên trang này là mẫu minh họa, không phải dữ liệu hệ thống."
        meta={<StatusBadge label="Chỉ dùng để rà soát" tone="info" />}
        actions={<><Button icon={Plus} variant="primary">Nút chính duy nhất</Button><Button>Phụ</Button></>}
      />

      <Notice tone="warning" title="Trang nội bộ">Không có trong menu. Dùng để kiểm tra giao diện Sáng/Tối, bàn phím và tương phản.</Notice>

      <Panel title="Giao diện" description="Lựa chọn thủ công luôn thắng chế độ Tự động.">
        <ThemeSegmented preference={themePreference} onChange={setThemePreference} />
      </Panel>

      <Panel title="Màu (token)">
        <div className="catalog-swatches">
          {SWATCHES.map(([token, label]) => (
            <div key={token} className="catalog-swatch">
              <span style={{ background: `var(${token})` }} aria-hidden="true" />
              <strong>{label}</strong>
              <code>{token}</code>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Nút">
        <div className="catalog-stack">
          <div className="catalog-row">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="success">Success</Button>
            <Button variant="danger-ghost" icon={Trash2}>Danger ghost</Button>
            <Button variant="danger" icon={Trash2}>Danger</Button>
          </div>
          <div className="catalog-row">
            <Button size="sm">Nhỏ 32px</Button><Button size="md">Vừa 36px</Button><Button size="lg">Lớn 40px</Button>
            <IconButton icon={Pencil} label="Sửa" size="sm" /><IconButton icon={Pencil} label="Sửa" /><IconButton icon={Pencil} label="Sửa" size="lg" variant="secondary" />
          </div>
          <div className="catalog-row">
            <Button variant="primary" loading>Đang lưu</Button>
            <Button variant="primary" disabled disabledReason="Cần ít nhất 1 hạng vé hợp lệ trước khi công bố">Công bố</Button>
            <Button disabled>Khóa (không lý do)</Button>
            <ButtonLink to="/admin" icon={CalendarDays}>Liên kết dạng nút</ButtonLink>
          </div>
        </div>
      </Panel>

      <Panel title="Trạng thái (StatusBadge)" description="Một bảng màu duy nhất; nhãn lấy từ giá trị API.">
        <div className="catalog-stack">
          {DOMAINS.map((domain) => (
            <div key={domain} className="catalog-row">
              <code className="catalog-domain">{domain}</code>
              {statusValues(domain).map((value) => <StatusBadge key={value} domain={domain} status={value} />)}
            </div>
          ))}
        </div>
      </Panel>

      <KpiGrid label="Thẻ KPI mẫu">
        <KpiCard label="Tất cả (mẫu)" value="128" hint="Bấm để bỏ lọc" icon={LayoutGrid} onClick={() => setKpi("all")} selected={kpi === "all"} ariaLabel="Hiển thị tất cả" />
        <KpiCard label="Chờ thanh toán (mẫu)" value="12" tone="warning" icon={Wallet} onClick={() => setKpi("pending")} selected={kpi === "pending"} ariaLabel="Lọc đơn chờ thanh toán" />
        <KpiCard label="Tỷ lệ lấp đầy (mẫu)" value="72,5%" tone="success" icon={Ticket} formula="Vé đã bán ÷ sức chứa của các hạng vé" />
        <KpiCard label="Đi tới trang" value="Nhân viên" tone="primary" icon={Users} to="/admin/staff" ariaLabel="Mở trang Nhân viên" />
        <KpiCard label="Đang tải" value="" loading hint="…" icon={ScanLine} />
      </KpiGrid>

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: "Tìm mã đơn, email, tên người mua" }}
        advanced={<>
          <Field label="Giá trị từ">{({ id }) => <Input id={id} inputMode="numeric" placeholder="0" />}</Field>
          <Field label="Giá trị đến">{({ id }) => <Input id={id} inputMode="numeric" placeholder="5.000.000" />}</Field>
          <PopoverClose><Button variant="primary" size="sm">Áp dụng</Button></PopoverClose>
        </>}
        advancedCount={0}
        chips={filter !== "all" ? [{ id: "status", label: `Trạng thái: ${filter}`, onRemove: () => setFilter("all") }] : []}
        onClearAll={() => { setFilter("all"); setSearch(""); }}
        resultText={`${rows.length} đơn mẫu`}
      >
        <FilterSelect label="Trạng thái" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">Tất cả</option>
          {statusValues("order").map((value) => <option key={value} value={value}>{value}</option>)}
        </FilterSelect>
        <FilterDate label="Từ ngày" />
        <FilterDate label="Đến ngày" />
      </FilterBar>

      <DataTable
        caption="Đơn hàng mẫu"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        onRowClick={() => setSlideOpen(true)}
        rowActionLabel={(row) => `Xem đơn ${row.code}`}
        selectedIds={selected}
        onSelectionChange={setSelected}
        pagination={{ mode: "client", pageSize: 3 }}
        storageKey="catalog-orders"
        loading={loadingDemo}
        toolbar={selected.size > 0
          ? <><strong>{selected.size} đã chọn</strong><span>· {eligible.length}/{selected.size} đơn đủ điều kiện hoàn tiền</span></>
          : <Button size="sm" onClick={() => { setLoadingDemo(true); window.setTimeout(() => setLoadingDemo(false), 1500); }}>Thử trạng thái tải</Button>}
        empty={<EmptyState compact title="Không có đơn phù hợp" description="Thử bỏ bớt bộ lọc." />}
      />

      <Panel title="Điều khiển">
        <div className="catalog-grid">
          <SegmentedControl ariaLabel="Chế độ xem" value={view} onChange={setView} options={[
            { value: "grid", label: "Lưới", icon: LayoutGrid }, { value: "list", label: "Danh sách", icon: List },
            { value: "calendar", label: "Lịch", icon: CalendarRange }, { value: "kanban", label: "Kanban", icon: KanbanSquare },
          ]} />
          <Switch checked={switchOn} onCheckedChange={setSwitchOn} label="Đang hoạt động" description="Tắt để ẩn khỏi trang khách." />
          <Field label="Tên sự kiện" required hint="Tối đa 200 ký tự.">{({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} placeholder="Đêm nhạc…" />}</Field>
          <Field label="Sức chứa" error="Sức chứa không được vượt quá sức chứa địa điểm.">{({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} defaultValue="99999" />}</Field>
          <Field label="Danh mục">{({ id }) => <Select id={id}><option>Pop</option><option>Rock</option></Select>}</Field>
          <Field label="Mô tả">{({ id }) => <Textarea id={id} placeholder="Giới thiệu ngắn" />}</Field>
          <Popover label="Ví dụ popover" trigger={<Button>Mở popover</Button>}><p style={{ margin: 0 }}>Nội dung nổi, Esc để đóng.</p></Popover>
        </div>
      </Panel>

      <Tabs ariaLabel="Ví dụ tab" value={tab} onValueChange={setTab} items={[{ value: "overview", label: "Tổng quan" }, { value: "tiers", label: "Hạng vé", count: 3 }, { value: "history", label: "Lịch sử" }]}>
        <TabPanel value="overview"><p>Nội dung tab Tổng quan.</p></TabPanel>
        <TabPanel value="tiers"><p>Nội dung tab Hạng vé.</p></TabPanel>
        <TabPanel value="history"><p>Nội dung tab Lịch sử.</p></TabPanel>
      </Tabs>

      <div className="catalog-grid">
        <Panel title="Trống"><EmptyState title="Chưa có dữ liệu lượt xem" description="Cần bật theo dõi lượt xem sự kiện (Giai đoạn 2)." /></Panel>
        <Panel title="Lỗi"><ErrorState description="Máy chủ không phản hồi." onRetry={() => notify.info("Mẫu: thử lại")} /></Panel>
        <Panel title="Đang tải"><SkeletonBlock lines={4} /></Panel>
      </div>

      <Panel title="Phản hồi">
        <div className="catalog-row">
          <Button onClick={() => notify.success("Đã lưu sự kiện (mẫu)")}>Toast thành công</Button>
          <Button onClick={() => notify.error("Không lưu được (mẫu)", { description: "Kiểm tra kết nối rồi thử lại." })}>Toast lỗi</Button>
          <Button onClick={() => notify.info("Có sự kiện đang mở cổng (mẫu)", { action: { label: "Chuyển", onClick: () => setThemePreference("dark") } })}>Toast có hành động</Button>
          <Button onClick={() => setSlideOpen(true)}>Mở slide-over</Button>
          <Button variant="danger-ghost" icon={Trash2} onClick={() => setConfirmOpen(true)}>Mở xác nhận</Button>
        </div>
        <div className="catalog-row" style={{ marginTop: 12 }}>
          <Notice tone="info" title="Thông tin">Nội dung.</Notice>
          <Notice tone="success" title="Thành công">Nội dung.</Notice>
          <Notice tone="danger" title="Nguy hiểm">Nội dung.</Notice>
        </div>
      </Panel>

      <SlideOver
        open={slideOpen}
        onOpenChange={setSlideOpen}
        title="Đơn MẪU-0001"
        description="Ví dụ panel chi tiết"
        headerExtra={<Tabs ariaLabel="Chi tiết đơn" value={tab} onValueChange={setTab} items={[{ value: "overview", label: "Tổng quan" }, { value: "tiers", label: "Vé" }, { value: "history", label: "Lịch sử" }]}><span /></Tabs>}
        footer={<><Button onClick={() => setSlideOpen(false)}>Đóng</Button><Button variant="primary">Lưu</Button></>}
      >
        <p>Thông tin người mua, vé và lịch sử trạng thái hiển thị ở đây.</p>
      </SlideOver>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Hủy sự kiện “Đêm nhạc mẫu”?"
        description="Thao tác này không hoàn tác được."
        impact="Ảnh hưởng: 3/5 đơn đủ điều kiện hoàn tiền (mô phỏng)"
        consequences={["Sự kiện bị ẩn khỏi trang khách và đóng mọi hạng vé.", "Vé đã phát hành bị vô hiệu hóa.", "Tạo yêu cầu hoàn tiền mô phỏng cho đơn đã xác nhận."]}
        confirmLabel="Hủy sự kiện"
        pending={pending}
        onConfirm={fakeConfirm}
      />
    </PageLayout>
  );
}
