import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  LockKeyhole,
  MapPin,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { digitsOnly } from "@/lib/utils";

import { listAdminEvents, type AdminEvent } from "@/services/admin-events.service";
import {
  createAdminTicketType,
  deleteAdminTicketType,
  listAdminTicketTypes,
  setAdminTicketSalesStatus,
  updateAdminTicketType,
  type AdminTicketType,
} from "@/services/admin-ticket-types.service";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  capacity: "",
  maxPerOrder: "4",
  customSales: false,
  salesStart: "",
  salesEnd: "",
  active: true,
};

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const local = (value: string | null) =>
  value
    ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";

const PRESETS = [
  { name: "General Admission", price: "200000", desc: "Standard entrance access to all main stages and areas." },
  { name: "VIP Experience", price: "500000", desc: "Priority check-in lane, dedicated lounge, and premium front-row views." },
  { name: "Early Bird Pass", price: "150000", desc: "Discounted admission for early supporters with limited availability." },
  { name: "Free Registration", price: "0", desc: "Complimentary access with registration required for capacity tracking." },
];

const eventStatusLabels: Record<string, string> = {
  draft: "Bản nháp",
  published: "Đã công bố",
  ongoing: "Đang diễn ra",
  completed: "Đã kết thúc",
  cancelled: "Đã hủy",
};

export function AdminTicketTypesPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requestedId = Number(params.get("eventId"));

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedId, setSelectedId] = useState(requestedId || 0);
  const [ticketTypes, setTicketTypes] = useState<AdminTicketType[]>([]);
  const [referenceTime, setReferenceTime] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Level 1: Event Lifecycle filter
  const [eventLifecycleFilter, setEventLifecycleFilter] = useState<string>("all");

  // Level 2: Ticket Type filter
  const [ticketStatusFilter, setTicketStatusFilter] =
    useState<"all" | "active" | "paused" | "soldOut" | "hasReserved">("all");

  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; ticketId?: number } | null>(null);
  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    void listAdminEvents()
      .then(({ data }) => {
        setEvents(data);
        setSelectedId((current) =>
          data.some((item) => item.id === current) ? current : data[0]?.id ?? 0,
        );
      })
      .catch((error: Error) => setErrors([error.message]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void listAdminTicketTypes(selectedId)
      .then((data) => {
        setTicketTypes(data);
        setReferenceTime(Date.now());
      })
      .catch((error: Error) => setErrors([error.message]))
      .finally(() => setLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (!dialog && !detailTicketId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setDialog(null); setDetailTicketId(null); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [dialog, detailTicketId]);

  const selected = events.find((item) => item.id === selectedId);
  const filtered = useMemo(() => {
    return events.filter((event) => {
      const matchesQuery = `${event.name} ${event.venue} ${event.city}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesLifecycle =
        eventLifecycleFilter === "all" || event.status === eventLifecycleFilter;
      return matchesQuery && matchesLifecycle;
    });
  }, [events, query, eventLifecycleFilter]);

  const handleSelectEvent = (id: number) => {
    setSelectedId(id);
    setTicketStatusFilter("all");
  };

  const handleEventLifecycleChange = (nextLifecycle: string) => {
    setEventLifecycleFilter(nextLifecycle);
    const nextFiltered = events.filter((e) => {
      const matchesQuery = `${e.name} ${e.venue} ${e.city}`.toLowerCase().includes(query.toLowerCase());
      const matchesLifecycle = nextLifecycle === "all" || e.status === nextLifecycle;
      return matchesQuery && matchesLifecycle;
    });
    if (nextFiltered.length > 0 && !nextFiltered.some((e) => e.id === selectedId)) {
      setSelectedId(nextFiltered[0].id);
      setTicketStatusFilter("all");
    }
  };

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    const nextFiltered = events.filter((e) => {
      const matchesQuery = `${e.name} ${e.venue} ${e.city}`.toLowerCase().includes(nextQuery.toLowerCase());
      const matchesLifecycle = eventLifecycleFilter === "all" || e.status === eventLifecycleFilter;
      return matchesQuery && matchesLifecycle;
    });
    if (nextFiltered.length > 0 && !nextFiltered.some((e) => e.id === selectedId)) {
      setSelectedId(nextFiltered[0].id);
      setTicketStatusFilter("all");
    }
  };

  const venueCap = selected?.venueCapacity ?? 0;
  const allocated = ticketTypes.reduce((sum, item) => sum + item.capacity, 0);
  const sold = ticketTypes.reduce((sum, item) => sum + item.soldQuantity, 0);
  const reserved = ticketTypes.reduce((sum, item) => sum + item.reservedQuantity, 0);
  const available = ticketTypes.reduce((sum, item) => sum + item.availableQuantity, 0);
  const remaining = venueCap - allocated;

  const realizedRevenue = ticketTypes.reduce(
    (sum, item) => sum + item.soldQuantity * item.price,
    0,
  );
  const potentialRevenue = ticketTypes.reduce(
    (sum, item) => sum + item.capacity * item.price,
    0,
  );

  const ticketMetrics = useMemo(() => {
    const total = ticketTypes.length;
    const active = ticketTypes.filter((t) => t.isActive).length;
    const paused = ticketTypes.filter((t) => !t.isActive).length;
    const soldOut = ticketTypes.filter((t) => t.availableQuantity === 0).length;
    const hasReserved = ticketTypes.filter((t) => t.reservedQuantity > 0).length;
    return { total, active, paused, soldOut, hasReserved };
  }, [ticketTypes]);

  const visibleTicketTypes = useMemo(() => {
    return ticketTypes.filter((ticket) => {
      if (ticketStatusFilter === "active") return ticket.isActive;
      if (ticketStatusFilter === "paused") return !ticket.isActive;
      if (ticketStatusFilter === "soldOut") return ticket.availableQuantity === 0;
      if (ticketStatusFilter === "hasReserved") return ticket.reservedQuantity > 0;
      return true;
    });
  }, [ticketTypes, ticketStatusFilter]);

  const detailTicket = ticketTypes.find((ticket) => ticket.id === detailTicketId) ?? null;

  if (!selected) {
    return (
      <section className="ticket-types-page">
        <div className="ticket-empty">
          <Ticket size={40} className="text-cyan-400/80" />
          <h4>{loading ? "Loading Operations..." : "No Events Available"}</h4>
          <p>Please create an event draft before configuring ticket tiers.</p>
          <button
            className="events-primary-button mt-4"
            onClick={() => navigate("/admin/events")}
          >
            Go to Events Management
          </button>
        </div>
      </section>
    );
  }

  const selectedEvent = selected;
  const editingTicket = ticketTypes.find((ticket) => ticket.id === dialog?.ticketId) ?? null;
  const priceLocked =
    selected.status !== "draft" &&
    Boolean(
      editingTicket &&
        (editingTicket.reservedQuantity + editingTicket.soldQuantity > 0 || editingTicket.isActive),
    );

  const canCreate =
    ["draft", "published", "ongoing"].includes(selected.status) &&
    selected.venueCapacity !== null &&
    remaining > 0;

  const policy =
    selected.status === "draft"
      ? {
          tone: "free",
          title: "Chế độ cấu hình bản nháp",
          text: "Toàn quyền tùy chỉnh: thiết lập giá, số lượng và lịch mở bán tự do trước khi công bố sự kiện.",
        }
      : ["published", "ongoing"].includes(selected.status)
      ? {
          tone: "guarded",
          title: "Đang áp dụng bảo vệ quyền lợi người mua",
          text: "Số lượng vé đã hứa với người mua được bảo vệ. Sức chứa có thể tăng thêm. Điều chỉnh giá yêu cầu tạm dừng hạng vé chưa có đơn.",
        }
      : {
          tone: "locked",
          title: "Hồ sơ lưu trữ / Chỉ đọc",
          text: "Sự kiện này đã kết thúc hoặc đã bị hủy. Dữ liệu vé được lưu giữ như nhật ký vận hành bất biến.",
        };

  function openCreate() {
    setForm(emptyForm);
    setErrors([]);
    setDialog({ mode: "create" });
  }

  function openEdit(ticket: AdminTicketType) {
    setForm({
      name: ticket.name,
      description: ticket.description ?? "",
      price: String(ticket.price),
      capacity: String(ticket.capacity),
      maxPerOrder: String(ticket.maxPerOrder),
      customSales: Boolean(ticket.salesStartAt || ticket.salesEndAt),
      salesStart: local(ticket.salesStartAt),
      salesEnd: local(ticket.salesEndAt),
      active: ticket.isActive,
    });
    setErrors([]);
    setDialog({ mode: "edit", ticketId: ticket.id });
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setForm((prev) => ({
      ...prev,
      name: preset.name,
      price: preset.price,
      description: preset.desc,
    }));
  }

  function applyCapacityPercent(pct: number) {
    const base = dialog?.mode === "edit" ? remaining + (editingTicket?.capacity ?? 0) : remaining;
    const target = Math.max(1, Math.floor(base * (pct / 100)));
    setForm((prev) => ({ ...prev, capacity: String(target) }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const next: string[] = [];
    const capacity = Number(form.capacity);
    const price = Number(form.price);
    const max = Number(form.maxPerOrder);
    const editing = ticketTypes.find((item) => item.id === dialog?.ticketId);

    if (!form.name.trim()) next.push("Tên hạng vé là bắt buộc.");
    if (!Number.isFinite(price) || price < 0) next.push("Giá vé không được là số âm.");
    if (!Number.isInteger(capacity) || capacity < 1) next.push("Sức chứa phải là số nguyên dương.");
    if (!Number.isInteger(max) || max < 1) next.push("Số vé tối đa mỗi đơn phải ít nhất là 1.");
    if (max > 100) next.push("Số vé tối đa mỗi đơn không được vượt quá 100.");
    if (
      form.customSales &&
      (!form.salesStart || !form.salesEnd)
    ) {
      next.push("Cần nhập cả thời gian mở bán và kết thúc bán riêng.");
    }
    if (
      form.customSales &&
      form.salesStart &&
      form.salesEnd &&
      new Date(form.salesEnd) <= new Date(form.salesStart)
    ) {
      next.push("Thời gian kết thúc bán phải sau thời gian mở bán.");
    }
    if (form.customSales && form.salesEnd && new Date(form.salesEnd) > new Date(selectedEvent.endTime)) {
      next.push("Thời gian bán riêng không được kết thúc sau khi sự kiện kết thúc.");
    }
    if (editing && selectedEvent.status !== "draft" && capacity < editing.capacity) {
      next.push("Không thể giảm sức chứa vé sau khi sự kiện đã công bố.");
    }
    if (capacity - (editing?.capacity ?? 0) > remaining) {
      next.push(
        `Sự kiện này chỉ còn ${remaining.toLocaleString("vi-VN")} chỗ trống chưa phân bổ. Hãy mở rộng sức chứa địa điểm hoặc giảm các hạng vé khác trước.`,
      );
    }

    if (next.length) {
      setErrors(next);
      return;
    }

    const iso = (value: string) => (value ? new Date(value).toISOString() : null);
    const fullPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      capacity,
      maxPerOrder: max,
      salesStartAt: form.customSales ? iso(form.salesStart) : null,
      salesEndAt: form.customSales ? iso(form.salesEnd) : null,
      isActive: selectedEvent.status === "draft" ? form.active : editing?.isActive ?? false,
    };

    try {
      const saved =
        dialog?.mode === "create"
          ? await createAdminTicketType({ eventId: selectedEvent.id, ...fullPayload })
          : await updateAdminTicketType(editing!.id, fullPayload);

      setTicketTypes((current) =>
        dialog?.mode === "create"
          ? [...current, saved]
          : current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setDialog(null);
      setErrors([]);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save ticket type."]);
    }
  }

  async function remove(ticket: AdminTicketType) {
    if (
      ticket.soldQuantity + ticket.reservedQuantity > 0 ||
      !confirm(`Permanently delete ticket type “${ticket.name}”?`)
    ) {
      return;
    }
    try {
      await deleteAdminTicketType(ticket.id);
      setTicketTypes((current) => current.filter((item) => item.id !== ticket.id));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to delete ticket type."]);
    }
  }

  async function toggleSales(ticket: AdminTicketType) {
    if (!["published", "ongoing"].includes(selectedEvent.status)) return;
    try {
      const saved = await setAdminTicketSalesStatus(ticket.id, !ticket.isActive);
      setTicketTypes((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to change sales status."]);
    }
  }

  return (
    <section className="ticket-types-page">
      {/* Top Header */}
      <header className="ticket-types-header admin-command-header">
        <div>
          <div className="admin-live-label">
            <Ticket size={13} /> QUẢN LÝ KHO VÉ & DOANH THU
          </div>
          <h2>Quản lý hạng vé</h2>
          <p>
            Cấu hình phân bổ sức chứa, bảng giá và thời gian bán vé theo thời gian thực.
          </p>
        </div>
        <button className="events-primary-button" disabled={!canCreate} onClick={openCreate}>
          <Plus size={17} /> Thêm hạng vé
        </button>
      </header>

      {errors.length > 0 && (
        <div className="ticket-form-alert">
          <AlertTriangle size={16} className="flex-shrink-0 text-amber-400" />
          <div>
            {errors.map((error) => (
              <p key={error}>• {error}</p>
            ))}
          </div>
        </div>
      )}

      {/* Guided Banner from Event Setup */}
      {params.get("setup") === "1" && ticketTypes.length === 0 && (
        <div className="ticket-setup-guide">
          <Ticket size={22} className="flex-shrink-0 text-cyan-400" />
          <div>
            <strong>Bước 2 / 2 · Cấu hình vé cho {selected.name}</strong>
            <p>
              Tạo ít nhất một hạng vé hoạt động (ví dụ: Vé tiêu chuẩn). Hạng vé sẽ
              tự động kế thừa thời gian sự kiện.
            </p>
          </div>
        </div>
      )}

      {params.get("setup") === "1" && ticketTypes.length > 0 && (
        <div className="ticket-setup-guide complete">
          <ShieldCheck size={22} className="flex-shrink-0 text-emerald-400" />
          <div>
            <strong>Cấu hình vé hoàn tất</strong>
            <p>
              {selected.name} đã cấu hình {ticketTypes.length} hạng vé. Quay lại Sự kiện để xem xét và công bố!
            </p>
          </div>
          <button onClick={() => navigate("/admin/events")}>
            Xem lại & Công bố <ChevronRight size={15} />
          </button>
        </div>
      )}

      {selected.venueCapacity !== null && remaining === 0 && (
        <div className="ticket-capacity-warning">
          <AlertTriangle size={18} className="flex-shrink-0 text-amber-400" />
          <div>
            <strong>Toàn bộ {selected.venueCapacity.toLocaleString("vi-VN")} chỗ của địa điểm đã được phân bổ.</strong>
            <p>
              {selected.status === "draft"
                ? "Để thêm hạng vé mới, hãy giảm sức chứa của hạng vé nháp hiện có hoặc tăng sức chứa địa điểm."
                : "Mở rộng sức chứa địa điểm trong chi tiết sự kiện trước khi thêm hạng vé mới."}
            </p>
          </div>
          <button onClick={() => navigate("/admin/events")}>Sửa sức chứa địa điểm</button>
        </div>
      )}

      {/* Workspace Master-Detail */}
      <div className="ticket-types-workspace">
        {/* Left Event Browser Sidebar */}
        <aside className="ticket-event-browser">
          <div className="ticket-event-search">
            <select
              className="ticket-sidebar-filter"
              value={eventLifecycleFilter}
              onChange={(e) => handleEventLifecycleChange(e.target.value)}
              aria-label="Lọc sự kiện theo trạng thái"
            >
              <option value="all">Tất cả sự kiện ({events.length})</option>
              <option value="draft">Bản nháp ({events.filter((e) => e.status === "draft").length})</option>
              <option value="published">Đã công bố ({events.filter((e) => e.status === "published").length})</option>
              <option value="ongoing">Đang diễn ra ({events.filter((e) => e.status === "ongoing").length})</option>
              <option value="completed">Đã kết thúc ({events.filter((e) => e.status === "completed").length})</option>
              <option value="cancelled">Đã hủy ({events.filter((e) => e.status === "cancelled").length})</option>
            </select>
          </div>
          <div className="ticket-event-search">
            <Search size={15} className="text-cyan-400/70" />
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Tìm kiếm sự kiện..."
            />
          </div>
          <div className="ticket-event-list">
            {filtered.map((event) => (
              <button
                key={event.id}
                className={event.id === selectedId ? "selected" : ""}
                onClick={() => handleSelectEvent(event.id)}
              >
                <div>
                  <span className={`event-status ${event.status}`}>{eventStatusLabels[event.status] || event.status}</span>
                  <strong>{event.name}</strong>
                  <small>
                    <MapPin size={11} />
                    {event.venue}, {event.city}
                  </small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </aside>

        {/* Right Inventory Main Panel */}
        <div className="ticket-inventory-panel">
          {/* Event Header Banner */}
          <div className="ticket-event-summary">
            <div>
              <span>SỰ KIỆN ĐƯỢC CHỌN</span>
              <h3>{selected.name}</h3>
              <p>
                <CalendarClock size={13} />
                {new Date(selected.startTime).toLocaleString("vi-VN", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <i />
                <MapPin size={13} />
                {selected.venue}, {selected.city}
              </p>
            </div>
            <span className={`event-status ${selected.status}`}>
              {selected.status === "draft"
                ? "Bản nháp"
                : selected.status === "published"
                  ? "Đã công bố"
                  : selected.status === "ongoing"
                    ? "Đang diễn ra"
                    : selected.status === "completed"
                      ? "Đã kết thúc"
                      : "Đã hủy"}
            </span>
          </div>

          {/* Multi-Segment Inventory Meter */}
          <div className="ticket-inventory-bar-wrap">
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                <Users size={14} /> PHÂN BỔ SỨC CHỨA ĐỊA ĐIỂM
              </span>
              <span>
                <b>{allocated.toLocaleString("vi-VN")}</b> / {venueCap.toLocaleString("vi-VN")} Tổng sức chứa địa điểm (
                {venueCap > 0 ? Math.round((allocated / venueCap) * 100) : 0}%)
              </span>
            </div>

            {/* Segmented Bar */}
            <div className="ticket-inventory-segments">
              {venueCap > 0 && (
                <>
                  <div
                    className="ticket-segment-sold"
                    style={{ width: `${(sold / venueCap) * 100}%` }}
                    title={`Đã bán: ${sold.toLocaleString("vi-VN")}`}
                  />
                  <div
                    className="ticket-segment-reserved"
                    style={{ width: `${(reserved / venueCap) * 100}%` }}
                    title={`Đang giữ: ${reserved.toLocaleString("vi-VN")}`}
                  />
                  <div
                    className="ticket-segment-available"
                    style={{ width: `${(available / venueCap) * 100}%` }}
                    title={`Còn lại: ${available.toLocaleString("vi-VN")}`}
                  />
                  <div
                    className="ticket-segment-unallocated"
                    style={{ width: `${(Math.max(0, remaining) / venueCap) * 100}%` }}
                    title={`Chưa phân bổ: ${remaining.toLocaleString("vi-VN")}`}
                  />
                </>
              )}
            </div>

            {/* Segment Legend */}
            <div className="ticket-inventory-legend">
              <div className="ticket-legend-item">
                <span className="ticket-legend-dot bg-emerald-400" />
                <span>
                  Đã bán: <b>{sold.toLocaleString("vi-VN")}</b>
                </span>
              </div>
              <div className="ticket-legend-item">
                <span className="ticket-legend-dot bg-amber-400" />
                <span>
                  Đang giữ: <b>{reserved.toLocaleString("vi-VN")}</b>
                </span>
              </div>
              <div className="ticket-legend-item">
                <span className="ticket-legend-dot bg-cyan-400" />
                <span>
                  Còn lại: <b>{available.toLocaleString("vi-VN")}</b>
                </span>
              </div>
              <div className="ticket-legend-item">
                <span className="ticket-legend-dot bg-slate-500" />
                <span>
                  Chưa phân bổ: <b>{remaining.toLocaleString("vi-VN")}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Revenue KPI Summary Cards */}
          <div className="ticket-revenue-cards">
            <div className="ticket-revenue-card">
              <span>Doanh thu đã bán (thực tế)</span>
              <strong className="text-emerald-300">{money.format(realizedRevenue)}</strong>
            </div>
            <div className="ticket-revenue-card">
              <span>Doanh thu dự kiến tối đa</span>
              <strong className="text-cyan-300">{money.format(potentialRevenue)}</strong>
            </div>
            <div className="ticket-revenue-card">
              <span>Hạng vé đã cấu hình</span>
              <strong>{ticketTypes.length} hạng vé</strong>
            </div>
          </div>

          {/* Safety Policy Notice */}
          <div className={`ticket-policy ${policy.tone}`}>
            <LockKeyhole size={18} className="flex-shrink-0" />
            <div>
              <strong>{policy.title}</strong>
              <p>{policy.text}</p>
            </div>
          </div>

          {/* Level 2 Ticket Quick Filter Cards */}
          <div className="ticket-metric-grid" role="toolbar" aria-label="Bộ lọc nhanh hạng vé">
            <button
              type="button"
              className={`ticket-metric-card ${ticketStatusFilter === "all" ? "active" : ""}`}
              onClick={() => setTicketStatusFilter("all")}
              aria-pressed={ticketStatusFilter === "all"}
              aria-label={`Xem tất cả hạng vé (${ticketMetrics.total})`}
            >
              <span className="ticket-metric-label">Tổng hạng vé</span>
              <strong className="ticket-metric-val">{ticketMetrics.total}</strong>
            </button>
            <button
              type="button"
              className={`ticket-metric-card ${ticketStatusFilter === "active" ? "active" : ""}`}
              onClick={() => setTicketStatusFilter("active")}
              aria-pressed={ticketStatusFilter === "active"}
              aria-label={`Lọc hạng vé đang bán / đang hoạt động (${ticketMetrics.active})`}
            >
              <span className="ticket-metric-label">Đang bán / Hoạt động</span>
              <strong className="ticket-metric-val text-emerald-400">{ticketMetrics.active}</strong>
            </button>
            <button
              type="button"
              className={`ticket-metric-card ${ticketStatusFilter === "paused" ? "active" : ""}`}
              onClick={() => setTicketStatusFilter("paused")}
              aria-pressed={ticketStatusFilter === "paused"}
              aria-label={`Lọc hạng vé tạm dừng (${ticketMetrics.paused})`}
            >
              <span className="ticket-metric-label">Tạm dừng</span>
              <strong className="ticket-metric-val text-amber-400">{ticketMetrics.paused}</strong>
            </button>
            <button
              type="button"
              className={`ticket-metric-card ${ticketStatusFilter === "soldOut" ? "active" : ""}`}
              onClick={() => setTicketStatusFilter("soldOut")}
              aria-pressed={ticketStatusFilter === "soldOut"}
              aria-label={`Lọc hạng vé hết vé (${ticketMetrics.soldOut})`}
            >
              <span className="ticket-metric-label">Hết vé</span>
              <strong className="ticket-metric-val text-rose-400">{ticketMetrics.soldOut}</strong>
            </button>
            <button
              type="button"
              className={`ticket-metric-card ${ticketStatusFilter === "hasReserved" ? "active" : ""}`}
              onClick={() => setTicketStatusFilter("hasReserved")}
              aria-pressed={ticketStatusFilter === "hasReserved"}
              aria-label={`Lọc hạng vé có vé đang giữ (${ticketMetrics.hasReserved})`}
            >
              <span className="ticket-metric-label">Có vé đang giữ</span>
              <strong className="ticket-metric-val text-cyan-400">{ticketMetrics.hasReserved}</strong>
            </button>
          </div>

          {/* Ticket Types Table / Cards */}
          <div className="ticket-type-table">
            <div className="ticket-table-heading">
              <div>
                <span>
                  {ticketStatusFilter === "all"
                    ? `${ticketTypes.length} HẠNG VÉ`
                    : `${visibleTicketTypes.length}/${ticketTypes.length} HẠNG VÉ`}
                </span>
                <h3>Danh sách kho vé</h3>
              </div>
              {canCreate && (
                <button onClick={openCreate} className="events-primary-button !py-1.5 !px-3 !text-xs">
                  <Plus size={14} /> Thêm hạng vé
                </button>
              )}
            </div>

            {loading ? (
              <div className="ticket-empty">
                <p>Đang tải kho vé...</p>
              </div>
            ) : ticketTypes.length === 0 ? (
              <div className="ticket-empty">
                <Ticket size={36} className="text-cyan-400/70" />
                <h4>Chưa có hạng vé nào</h4>
                <p>Tạo ít nhất một hạng vé hợp lệ và đang hoạt động trước khi sự kiện có thể công bố.</p>
                {canCreate && (
                  <button onClick={openCreate} type="button">
                    <Plus size={15} /> Tạo hạng vé đầu tiên
                  </button>
                )}
              </div>
            ) : visibleTicketTypes.length === 0 ? (
              <div className="ticket-empty">
                <Ticket size={36} className="text-cyan-400/70" />
                <h4>
                  {ticketStatusFilter === "active"
                    ? "Không có hạng vé nào đang mở bán"
                    : ticketStatusFilter === "paused"
                      ? "Không có hạng vé nào đang tạm dừng"
                      : ticketStatusFilter === "soldOut"
                        ? "Không có hạng vé nào hết vé"
                        : "Không có hạng vé nào có vé đang giữ"}
                </h4>
                <p>Thử chọn bộ lọc khác hoặc xem toàn bộ hạng vé của sự kiện này.</p>
                <button
                  type="button"
                  className="events-secondary-button mt-3"
                  onClick={() => setTicketStatusFilter("all")}
                >
                  Xem tất cả hạng vé ({ticketTypes.length})
                </button>
              </div>
            ) : (
              visibleTicketTypes.map((ticket) => {
                const used = ticket.soldQuantity + ticket.reservedQuantity;
                const effectiveSalesStart = ticket.salesStartAt ?? selected.salesStartAt;
                const salesStartTime = effectiveSalesStart
                  ? new Date(effectiveSalesStart).getTime()
                  : Number.NaN;
                const isScheduled =
                  ticket.isActive &&
                  Number.isFinite(salesStartTime) &&
                  referenceTime > 0 &&
                  salesStartTime > referenceTime;
                const mayDelete =
                  used === 0 &&
                  (selected.status === "draft" ||
                    (["published", "ongoing"].includes(selected.status) && !ticket.isActive));

                return (
                  <article
                    className={`ticket-type-row ${
                      !ticket.isActive
                        ? "ticket-type-paused"
                        : isScheduled
                          ? "ticket-type-scheduled"
                          : ""
                    }`}
                    key={ticket.id}
                  >
                    {/* Identity */}
                    <div className="ticket-type-identity">
                      <span
                        className={
                          !ticket.isActive ? "paused" : isScheduled ? "scheduled" : "active"
                        }
                      >
                        {!ticket.isActive ? "TẠM DỪNG" : isScheduled ? "HẸN GIỜ MỞ BÁN" : "ĐANG BÁN"}
                      </span>
                      <h4>{ticket.name}</h4>
                      <p>{ticket.description || "Vé vào cổng tiêu chuẩn"}</p>
                      {isScheduled && effectiveSalesStart && (
                        <div className="ticket-scheduled-notice">
                          <CalendarClock size={13} />
                          <span>
                            <strong>Chờ đến khung giờ mở bán</strong>
                            <small>
                              Tự động mở bán {new Date(effectiveSalesStart).toLocaleString("vi-VN")}
                            </small>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Price & Limits */}
                    <div className="ticket-price">
                      <span>GIÁ VÉ</span>
                      <strong>{money.format(ticket.price)}</strong>
                      <small>Tối đa {ticket.maxPerOrder} vé/đơn</small>
                    </div>

                    {/* Stock Usage */}
                    <div className="ticket-stock">
                      <div>
                        <span>Tiến độ bán vé</span>
                        <strong>
                          {used} / {ticket.capacity} ({Math.round((used / ticket.capacity) * 100)}%)
                        </strong>
                      </div>
                      <div className="ticket-stock-track">
                        <i style={{ width: `${Math.min(100, (used / ticket.capacity) * 100)}%` }} />
                      </div>
                      <small>
                        {ticket.availableQuantity} left · {ticket.reservedQuantity} held ·{" "}
                        {ticket.soldQuantity} sold
                      </small>
                    </div>

                    {/* Action Controls */}
                    <div className="ticket-row-actions">
                      <button
                        onClick={() => openEdit(ticket)}
                        disabled={["completed", "cancelled"].includes(selected.status)}
                        title="Chỉnh sửa cấu hình hạng vé"
                      >
                        <Edit3 size={15} />
                      </button>

                      {["published", "ongoing"].includes(selected.status) && (
                        <button
                          className={ticket.isActive ? "pause" : "resume"}
                          onClick={() => void toggleSales(ticket)}
                          title={
                            ticket.isActive
                              ? isScheduled
                                ? "Tạm dừng lịch mở bán"
                                : "Tạm dừng bán vé"
                              : "Tiếp tục bán vé theo lịch"
                          }
                        >
                          {ticket.isActive ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
                        </button>
                      )}

                      <button
                        disabled={!mayDelete}
                        onClick={() => void remove(ticket)}
                        title={
                          mayDelete
                            ? "Xóa hạng vé chưa sử dụng"
                            : "Không thể xóa hạng vé đã có đơn hàng hoặc đang giữ chỗ"
                        }
                      >
                        <Trash2 size={15} />
                      </button>

                      <button
                        onClick={() => setDetailTicketId(ticket.id)}
                        title="Xem kiểm toán chi tiết tồn kho"
                      >
                        <Eye size={15} />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Modal Dialog */}
      {dialog && createPortal(
        <div className="ticket-dialog-backdrop ticket-tier-modal-backdrop" onMouseDown={() => setDialog(null)}>
          <div className="events-dialog ticket-tier-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-tier-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>CẤU HÌNH HẠNG VÉ / {selected.status.toUpperCase()}</span>
                <h3 id="ticket-tier-dialog-title">{dialog.mode === "create" ? "Thêm hạng vé mới" : "Chỉnh sửa hạng vé"}</h3>
              </div>
              <button onClick={() => setDialog(null)}>
                <X size={20} />
              </button>
            </header>

            {selected.status !== "draft" && (
              <div className={`ticket-maintenance-note ${priceLocked ? "locked" : "editable"}`}>
                <LockKeyhole size={15} className="flex-shrink-0" />
                <p>
                  {priceLocked
                    ? "Giá vé bị khóa vì hạng vé này đang bán hoặc đã có đơn hàng. Tạm dừng hạng vé chưa có đơn trước nếu muốn đổi giá."
                    : "Sức chứa có thể tăng thêm. Thời gian và mô tả vẫn có thể chỉnh sửa tự do."}
                </p>
              </div>
            )}

            {errors.length > 0 && (
              <div className="ticket-form-alert m-5 mb-0">
                <AlertTriangle size={16} className="flex-shrink-0 text-amber-400" />
                <div>
                  {errors.map((error) => (
                    <p key={error}>• {error}</p>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={save} noValidate className="p-6">
              {/* Quick Presets for New Tiers */}
              {dialog.mode === "create" && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">
                    Mẫu hạng vé nhanh
                  </label>
                  <div className="ticket-preset-buttons">
                    {PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        className="ticket-preset-btn"
                        onClick={() => applyPreset(p)}
                      >
                        <Sparkles size={11} className="inline mr-1 text-cyan-400" />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="ticket-form-grid">
                <label>
                  Tên hạng vé <span className="text-rose-400">*</span>
                  <input
                    required
                    placeholder="Ví dụ: Vé VIP Tiêu Chuẩn"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>

                <label>
                  Giá vé (VNĐ) <span className="text-rose-400">*</span>
                  <input
                    required
                    type="text"
                    disabled={priceLocked}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    placeholder="Ví dụ: 250000"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: digitsOnly(e.target.value, 10) })}
                  />
                </label>

                <label className="wide">
                  Mô tả quyền lợi
                  <textarea
                    rows={2}
                    placeholder="Mô tả quyền lợi vé, vật phẩm đi kèm, cổng soát vé riêng..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>

                <div className="wide">
                  <label>
                    Sức chứa (Tổng số vé phát hành) <span className="text-rose-400">*</span>
                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      placeholder="Ví dụ: 500"
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: digitsOnly(e.target.value, 10) })}
                    />
                    <small className="text-slate-400 text-[11px] mt-1 block">
                      Còn {remaining.toLocaleString("vi-VN")} chỗ trống địa điểm chưa phân bổ.
                    </small>
                  </label>

                  <details className="ticket-capacity-menu">
                    <summary className="ticket-capacity-btn">
                      Chọn nhanh theo sức chứa còn lại <ChevronDown size={14} />
                    </summary>
                    <div className="ticket-capacity-options" role="menu" aria-label="Chọn tỷ lệ sức chứa còn lại">
                      {[25, 50, 75, 100].map((percent) => (
                        <button
                          key={percent}
                          type="button"
                          role="menuitem"
                          onClick={(event) => {
                            applyCapacityPercent(percent);
                            event.currentTarget.closest("details")?.removeAttribute("open");
                          }}
                        >
                          {percent === 100 ? "Tối đa (100%)" : `${percent}% còn lại`}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>

                <label className="wide">
                  Số vé tối đa mỗi đơn hàng
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    value={form.maxPerOrder}
                    onChange={(e) => setForm({ ...form, maxPerOrder: digitsOnly(e.target.value, 3) })}
                  />
                </label>

                <label className="wide ticket-inherit-sales cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!form.customSales}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        customSales: !e.target.checked,
                        salesStart: "",
                        salesEnd: "",
                      })
                    }
                  />
                  <span>
                    <strong>Sử dụng lịch mở bán mặc định của sự kiện</strong>
                    <small>
                      {selected.salesStartAt
                        ? new Date(selected.salesStartAt).toLocaleString("en-GB")
                        : "Opens immediately"}{" "}
                      →{" "}
                      {selected.salesEndAt
                        ? new Date(selected.salesEndAt).toLocaleString("en-GB")
                        : "Until Event Ends"}
                    </small>
                  </span>
                </label>

                {form.customSales && (
                  <>
                    <label>
                      Thời gian mở bán riêng
                      <input
                        type="datetime-local"
                        value={form.salesStart}
                        onChange={(e) => setForm({ ...form, salesStart: e.target.value })}
                      />
                    </label>
                    <label>
                      Thời gian kết thúc bán riêng
                      <input
                        type="datetime-local"
                        value={form.salesEnd}
                        onChange={(e) => setForm({ ...form, salesEnd: e.target.value })}
                      />
                    </label>
                  </>
                )}
              </div>

              <footer className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setDialog(null)}>
                  Hủy bỏ
                </button>
                <button className="primary" type="submit">
                  {dialog.mode === "create" ? "Tạo hạng vé" : "Lưu thay đổi"}
                </button>
              </footer>
            </form>
          </div>
        </div>, document.body
      )}

      {/* Ticket Tier Detail Inspection Dialog */}
      {detailTicket && createPortal(
        <div
          className="ticket-dialog-backdrop"
          onMouseDown={() => setDetailTicketId(null)}
        >
          <div
            className="ticket-dialog ticket-detail-dialog"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>KIỂM TOÁN TỒN KHO HẠNG VÉ</span>
                <h3>{detailTicket.name}</h3>
              </div>
              <button onClick={() => setDetailTicketId(null)}>
                <X size={20} />
              </button>
            </header>
            <div className="ticket-detail-content">
              <div className="ticket-detail-status">
                <span className={detailTicket.isActive ? "active" : "paused"}>
                  {detailTicket.isActive ? "ĐANG BÁN" : "TẠM DỪNG"}
                </span>
                <strong>{money.format(detailTicket.price)}</strong>
              </div>
              <p>{detailTicket.description || "Hạng vé tiêu chuẩn."}</p>

              <div className="ticket-detail-grid">
                <article>
                  <span>Tổng sức chứa</span>
                  <strong>{detailTicket.capacity.toLocaleString("vi-VN")}</strong>
                </article>
                <article>
                  <span>Còn lại</span>
                  <strong>{detailTicket.availableQuantity.toLocaleString("vi-VN")}</strong>
                </article>
                <article>
                  <span>Đang giữ chỗ</span>
                  <strong>{detailTicket.reservedQuantity.toLocaleString("vi-VN")}</strong>
                </article>
                <article>
                  <span>Đã bán thành công</span>
                  <strong>{detailTicket.soldQuantity.toLocaleString("vi-VN")}</strong>
                </article>
              </div>

              <dl>
                <div>
                  <dt>Tối đa mỗi đơn</dt>
                  <dd>{detailTicket.maxPerOrder} vé</dd>
                </div>
                <div>
                  <dt>Bắt đầu mở bán</dt>
                  <dd>
                    {detailTicket.salesStartAt
                      ? new Date(detailTicket.salesStartAt).toLocaleString("en-GB")
                      : "Kế thừa từ sự kiện"}
                  </dd>
                </div>
                <div>
                  <dt>Kết thúc mở bán</dt>
                  <dd>
                    {detailTicket.salesEndAt
                      ? new Date(detailTicket.salesEndAt).toLocaleString("en-GB")
                      : "Kế thừa từ sự kiện"}
                  </dd>
                </div>
                <div>
                  <dt>Sự kiện áp dụng</dt>
                  <dd>{selected.name}</dd>
                </div>
                <div>
                  <dt>Tổng giá trị đã bán</dt>
                  <dd className="font-bold text-emerald-400">
                    {money.format(detailTicket.soldQuantity * detailTicket.price)}
                  </dd>
                </div>
              </dl>

              <div className="ticket-detail-note">
                <ShieldCheck size={18} className="flex-shrink-0" />
                <p>
                  Mọi giao dịch mua vé đều được đảm bảo bởi khóa giao dịch cơ sở dữ liệu tuân thủ ACID. Không thể bán vượt quá sức chứa được phân bổ.
                </p>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </section>
  );
}
