import {
  AlertTriangle,
  CalendarClock,
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
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";

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
  const filtered = events.filter((event) =>
    `${event.name} ${event.venue} ${event.city}`.toLowerCase().includes(query.toLowerCase()),
  );

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
          title: "Draft Configuration Mode",
          text: "Full flexibility: configure prices, quantities, and schedules freely before launching.",
        }
      : ["published", "ongoing"].includes(selected.status)
      ? {
          tone: "guarded",
          title: "Live Consumer Protection Active",
          text: "Quantities promised to buyers are secured. Capacity may increase. Price adjustments require pausing an unsold tier.",
        }
      : {
          tone: "locked",
          title: "Archived / Read-Only Record",
          text: "This event is concluded or cancelled. Ticket data is preserved as an immutable operational log.",
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

    if (!form.name.trim()) next.push("Ticket Type name is required.");
    if (!Number.isFinite(price) || price < 0) next.push("Price cannot be negative.");
    if (!Number.isInteger(capacity) || capacity < 1)
      next.push("Capacity must be a positive integer.");
    if (!Number.isInteger(max) || max < 1) next.push("Maximum per order must be at least 1.");
    if (
      form.customSales &&
      (!form.salesStart || !form.salesEnd)
    ) {
      next.push("Both custom sales opening and closing times are required.");
    }
    if (
      form.customSales &&
      form.salesStart &&
      form.salesEnd &&
      new Date(form.salesEnd) <= new Date(form.salesStart)
    ) {
      next.push("Sales end time must be after sales start time.");
    }
    if (form.customSales && form.salesEnd && new Date(form.salesEnd) > new Date(selectedEvent.endTime)) {
      next.push("Custom sales cannot end after the Event ends.");
    }
    if (editing && selectedEvent.status !== "draft" && capacity < editing.capacity) {
      next.push("Capacity cannot be decreased after publishing.");
    }
    if (capacity - (editing?.capacity ?? 0) > remaining) {
      next.push(
        `This event only has ${remaining.toLocaleString()} unallocated places left. Expand venue capacity or reduce other types first.`,
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
      <header className="ticket-types-header">
        <div>
          <div className="admin-live-label">
            <Ticket size={13} /> INVENTORY COMMAND & REVENUE
          </div>
          <h2>Ticket Tier Management</h2>
          <p>
            Configure capacity tiers, pricing structure, and sales schedules with real-time
            inventory metrics.
          </p>
        </div>
        <button className="events-primary-button" disabled={!canCreate} onClick={openCreate}>
          <Plus size={17} /> Add Ticket Tier
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
            <strong>Step 2 of 2 · Configure Tickets for {selected.name}</strong>
            <p>
              Add at least one active Ticket Tier (e.g., General Admission). It will
              automatically inherit the event dates.
            </p>
          </div>
        </div>
      )}

      {params.get("setup") === "1" && ticketTypes.length > 0 && (
        <div className="ticket-setup-guide complete">
          <ShieldCheck size={22} className="flex-shrink-0 text-emerald-400" />
          <div>
            <strong>Ticket Setup Complete</strong>
            <p>
              {selected.name} has {ticketTypes.length} configured tier
              {ticketTypes.length > 1 ? "s" : ""}. Head back to Events to review and publish!
            </p>
          </div>
          <button onClick={() => navigate("/admin/events")}>
            Review & Publish <ChevronRight size={15} />
          </button>
        </div>
      )}

      {selected.venueCapacity !== null && remaining === 0 && (
        <div className="ticket-capacity-warning">
          <AlertTriangle size={18} className="flex-shrink-0 text-amber-400" />
          <div>
            <strong>All {selected.venueCapacity.toLocaleString()} venue places are allocated.</strong>
            <p>
              {selected.status === "draft"
                ? "To add another tier, reduce the capacity of an existing draft tier or increase venue capacity."
                : "Expand venue capacity in Event details before adding new tiers."}
            </p>
          </div>
          <button onClick={() => navigate("/admin/events")}>Edit Venue Capacity</button>
        </div>
      )}

      {/* Workspace Master-Detail */}
      <div className="ticket-types-workspace">
        {/* Left Event Browser Sidebar */}
        <aside className="ticket-event-browser">
          <div className="ticket-event-search">
            <Search size={15} className="text-cyan-400/70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Events..."
            />
          </div>
          <div className="ticket-event-list">
            {filtered.map((event) => (
              <button
                key={event.id}
                className={event.id === selectedId ? "selected" : ""}
                onClick={() => {
                  setSelectedId(event.id);
                }}
              >
                <div>
                  <span className={`event-status ${event.status}`}>{event.status}</span>
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
              <span>SELECTED EVENT TARGET</span>
              <h3>{selected.name}</h3>
              <p>
                <CalendarClock size={13} />
                {new Date(selected.startTime).toLocaleString("en-GB", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <i />
                <MapPin size={13} />
                {selected.venue}, {selected.city}
              </p>
            </div>
            <span className={`event-status ${selected.status}`}>{selected.status}</span>
          </div>

          {/* Multi-Segment Inventory Meter */}
          <div className="ticket-inventory-bar-wrap">
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                <Users size={14} /> CAPACITY ALLOCATION METER
              </span>
              <span>
                <b>{allocated.toLocaleString()}</b> / {venueCap.toLocaleString()} Total Venue Capacity (
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
                    title={`Sold: ${sold.toLocaleString()}`}
                  />
                  <div
                    className="ticket-segment-reserved"
                    style={{ width: `${(reserved / venueCap) * 100}%` }}
                    title={`Reserved: ${reserved.toLocaleString()}`}
                  />
                  <div
                    className="ticket-segment-available"
                    style={{ width: `${(available / venueCap) * 100}%` }}
                    title={`Available: ${available.toLocaleString()}`}
                  />
                  <div
                    className="ticket-segment-unallocated"
                    style={{ width: `${(Math.max(0, remaining) / venueCap) * 100}%` }}
                    title={`Unallocated: ${remaining.toLocaleString()}`}
                  />
                </>
              )}
            </div>

            {/* Segment Legend */}
            <div className="ticket-inventory-legend">
              <div className="ticket-legend-item">
                <span className="ticket-legend-dot bg-emerald-400" />
                <span>
                  Sold: <b>{sold.toLocaleString()}</b>
                </span>
              </div>
              <div className="ticket-legend-item">
                <span className="ticket-legend-dot bg-amber-400" />
                <span>
                  Reserved: <b>{reserved.toLocaleString()}</b>
                </span>
              </div>
              <div className="ticket-legend-item">
                <span className="ticket-legend-dot bg-cyan-400" />
                <span>
                  Available: <b>{available.toLocaleString()}</b>
                </span>
              </div>
              <div className="ticket-legend-item">
                <span className="ticket-legend-dot bg-slate-500" />
                <span>
                  Unallocated: <b>{remaining.toLocaleString()}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Revenue KPI Summary Cards */}
          <div className="ticket-revenue-cards">
            <div className="ticket-revenue-card">
              <span>Gross Sold Value</span>
              <strong className="text-emerald-300">{money.format(realizedRevenue)}</strong>
            </div>
            <div className="ticket-revenue-card">
              <span>Projected Max Revenue</span>
              <strong className="text-cyan-300">{money.format(potentialRevenue)}</strong>
            </div>
            <div className="ticket-revenue-card">
              <span>Configured Tiers</span>
              <strong>{ticketTypes.length} Tiers</strong>
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

          {/* Ticket Types Table / Cards */}
          <div className="ticket-type-table">
            <div className="ticket-table-heading">
              <div>
                <span>{ticketTypes.length} TIERS CONFIGURED</span>
                <h3>Ticket Inventory List</h3>
              </div>
              {canCreate && (
                <button onClick={openCreate} className="events-primary-button !py-1.5 !px-3 !text-xs">
                  <Plus size={14} /> Add Tier
                </button>
              )}
            </div>

            {loading ? (
              <div className="ticket-empty">
                <p>Loading tier inventories...</p>
              </div>
            ) : ticketTypes.length === 0 ? (
              <div className="ticket-empty">
                <Ticket size={36} className="text-cyan-400/70" />
                <h4>No Ticket Tiers Configured</h4>
                <p>Create at least one active ticket tier before this event can go live.</p>
                {canCreate && (
                  <button onClick={openCreate}>
                    <Plus size={15} /> Create First Tier
                  </button>
                )}
              </div>
            ) : (
              ticketTypes.map((ticket) => {
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
                        {!ticket.isActive ? "PAUSED" : isScheduled ? "SCHEDULED" : "ON SALE"}
                      </span>
                      <h4>{ticket.name}</h4>
                      <p>{ticket.description || "General admission ticket"}</p>
                      {isScheduled && effectiveSalesStart && (
                        <div className="ticket-scheduled-notice">
                          <CalendarClock size={13} />
                          <span>
                            <strong>Waiting for sales window</strong>
                            <small>
                              Automatically opens {new Date(effectiveSalesStart).toLocaleString("en-GB")}
                            </small>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Price & Limits */}
                    <div className="ticket-price">
                      <span>PRICE</span>
                      <strong>{money.format(ticket.price)}</strong>
                      <small>Max {ticket.maxPerOrder} / order</small>
                    </div>

                    {/* Stock Usage */}
                    <div className="ticket-stock">
                      <div>
                        <span>Sales Progress</span>
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
                        title="Edit tier settings"
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
                                ? "Pause the scheduled sale"
                                : "Pause sales"
                              : "Resume sales according to its schedule"
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
                            ? "Delete unused tier"
                            : "Cannot delete tier with sold/held orders"
                        }
                      >
                        <Trash2 size={15} />
                      </button>

                      <button
                        onClick={() => setDetailTicketId(ticket.id)}
                        title="View detailed inventory audit"
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
                <span>TIER CONFIGURATION / {selected.status.toUpperCase()}</span>
                <h3 id="ticket-tier-dialog-title">{dialog.mode === "create" ? "Add Ticket Tier" : "Edit Ticket Tier"}</h3>
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
                    ? "Price is locked because this tier is live or has committed orders. Pause an unsold tier first to adjust pricing."
                    : "Capacity may increase. Dates and descriptions remain fully editable."}
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
                    Quick Tier Templates
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
                  Tier Name <span className="text-rose-400">*</span>
                  <input
                    required
                    placeholder="e.g. VIP Early Access"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>

                <label>
                  Price (VND) <span className="text-rose-400">*</span>
                  <input
                    required
                    disabled={priceLocked}
                    inputMode="numeric"
                    placeholder="e.g. 250000"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </label>

                <label className="wide">
                  Description
                  <textarea
                    rows={2}
                    placeholder="Specify perks, inclusions, and gate entry instructions..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>

                <div className="wide">
                  <label>
                    Capacity (Available Tickets) <span className="text-rose-400">*</span>
                    <input
                      required
                      inputMode="numeric"
                      placeholder="e.g. 500"
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    />
                    <small className="text-slate-400 text-[11px] mt-1 block">
                      {remaining} unallocated venue places remain.
                    </small>
                  </label>

                  {/* Percentage shortcuts */}
                  <div className="ticket-capacity-shortcuts">
                    <button
                      type="button"
                      className="ticket-capacity-btn"
                      onClick={() => applyCapacityPercent(25)}
                    >
                      25% Remaining
                    </button>
                    <button
                      type="button"
                      className="ticket-capacity-btn"
                      onClick={() => applyCapacityPercent(50)}
                    >
                      50% Remaining
                    </button>
                    <button
                      type="button"
                      className="ticket-capacity-btn"
                      onClick={() => applyCapacityPercent(100)}
                    >
                      Max (100%)
                    </button>
                  </div>
                </div>

                <label className="wide">
                  Max Tickets Per Order
                  <input
                    inputMode="numeric"
                    value={form.maxPerOrder}
                    onChange={(e) => setForm({ ...form, maxPerOrder: e.target.value })}
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
                    <strong>Use Default Event Sales Schedule</strong>
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
                      Custom Sales Open
                      <input
                        type="datetime-local"
                        value={form.salesStart}
                        onChange={(e) => setForm({ ...form, salesStart: e.target.value })}
                      />
                    </label>
                    <label>
                      Custom Sales Close
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
                  Cancel
                </button>
                <button className="primary" type="submit">
                  {dialog.mode === "create" ? "Create Tier" : "Save Changes"}
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
                <span>TIER INVENTORY AUDIT</span>
                <h3>{detailTicket.name}</h3>
              </div>
              <button onClick={() => setDetailTicketId(null)}>
                <X size={20} />
              </button>
            </header>
            <div className="ticket-detail-content">
              <div className="ticket-detail-status">
                <span className={detailTicket.isActive ? "active" : "paused"}>
                  {detailTicket.isActive ? "ON SALE" : "PAUSED"}
                </span>
                <strong>{money.format(detailTicket.price)}</strong>
              </div>
              <p>{detailTicket.description || "Standard admission tier."}</p>

              <div className="ticket-detail-grid">
                <article>
                  <span>Total Capacity</span>
                  <strong>{detailTicket.capacity.toLocaleString()}</strong>
                </article>
                <article>
                  <span>Available</span>
                  <strong>{detailTicket.availableQuantity.toLocaleString()}</strong>
                </article>
                <article>
                  <span>Reserved</span>
                  <strong>{detailTicket.reservedQuantity.toLocaleString()}</strong>
                </article>
                <article>
                  <span>Confirmed Sold</span>
                  <strong>{detailTicket.soldQuantity.toLocaleString()}</strong>
                </article>
              </div>

              <dl>
                <div>
                  <dt>Max Per Order</dt>
                  <dd>{detailTicket.maxPerOrder}</dd>
                </div>
                <div>
                  <dt>Sales Start</dt>
                  <dd>
                    {detailTicket.salesStartAt
                      ? new Date(detailTicket.salesStartAt).toLocaleString("en-GB")
                      : "Inherited from Event"}
                  </dd>
                </div>
                <div>
                  <dt>Sales End</dt>
                  <dd>
                    {detailTicket.salesEndAt
                      ? new Date(detailTicket.salesEndAt).toLocaleString("en-GB")
                      : "Inherited from Event"}
                  </dd>
                </div>
                <div>
                  <dt>Target Event</dt>
                  <dd>{selected.name}</dd>
                </div>
                <div>
                  <dt>Gross Sold Value</dt>
                  <dd className="font-bold text-emerald-400">
                    {money.format(detailTicket.soldQuantity * detailTicket.price)}
                  </dd>
                </div>
              </dl>

              <div className="ticket-detail-note">
                <ShieldCheck size={18} className="flex-shrink-0" />
                <p>
                  All purchases are guaranteed by ACID transactional database locks. Sold
                  tickets cannot be over-allocated.
                </p>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </section>
  );
}
