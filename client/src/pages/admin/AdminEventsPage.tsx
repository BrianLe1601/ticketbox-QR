import {
  AlertCircle,
  Ban,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Grid,
  Info,
  LayoutList,
  ListFilter,
  MapPin,
  Music,
  Plus,
  Rocket,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  Users,
  Utensils,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { EventCoverUploader } from "@/components/admin/EventCoverUploader";
import { ApiRequestError } from "@/services/api";
import {
  createAdminEvent,
  cancelAdminEvent,
  deleteAdminEvent,
  listAdminEvents,
  publishAdminEvent,
  setAdminEventVisibility,
  updateAdminEvent,
  type AdminEvent as ManagedEvent,
  type EventStatus as Status,
} from "@/services/admin-events.service";

type PublishMode = "manual" | "scheduled";
type ViewMode = "grid" | "list";
type CategoryFilter = "all" | "music" | "conference" | "food" | "sports" | "art";

const emptyForm = {
  name: "",
  description: "",
  category: "music" as "music" | "conference" | "food" | "sports" | "art",
  venue: "",
  address: "",
  city: "",
  venueCapacity: "",
  coverImageUrl: "",
  coverImagePublicId: "",
  coverImageAlt: "",
  startTime: "",
  endTime: "",
  salesStartAt: "",
  salesEndAt: "",
  checkinStartAt: "",
  checkinEndAt: "",
  publishMode: "manual" as PublishMode,
  scheduledPublishAt: "",
};

const CATEGORIES: { id: CategoryFilter; label: string; icon: typeof Music }[] = [
  { id: "all", label: "All Categories", icon: Globe },
  { id: "music", label: "Music & Concerts", icon: Music },
  { id: "conference", label: "Conferences", icon: Video },
  { id: "food", label: "Food & Drinks", icon: Utensils },
  { id: "sports", label: "Sports & Fitness", icon: Zap },
  { id: "art", label: "Art & Culture", icon: Sparkles },
];

export function AdminEventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Status | "hidden" | "live">("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [hideTarget, setHideTarget] = useState<ManagedEvent | null>(null);
  const [hideReason, setHideReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState<ManagedEvent | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<{code:string;message:string;hint:string}|null>(null);

  useEffect(() => {
    void listAdminEvents()
      .then(({ data }) => setEvents(data))
      .catch((error: Error) => setErrors([error.message]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [dialogOpen]);

  const counts = useMemo(
    () => ({
      total: events.length,
      draft: events.filter((event) => event.status === "draft").length,
      live: events.filter((event) => ["published", "ongoing"].includes(event.status)).length,
      scheduled: events.filter(
        (event) => event.status === "draft" && Boolean(event.scheduledPublishAt),
      ).length,
      hidden: events.filter((event) => event.visibility === "hidden").length,
    }),
    [events],
  );

  const filtered = useMemo(() => {
    return events.filter((event) => {
      const matchQuery = `${event.name} ${event.venue} ${event.city}`
        .toLowerCase()
        .includes(query.toLowerCase());

      let matchStatus = true;
      if (status === "hidden") {
        matchStatus = event.visibility === "hidden";
      } else if (status === "live") {
        matchStatus = ["published", "ongoing"].includes(event.status);
      } else if (status !== "all") {
        matchStatus = event.status === status;
      }

      const matchCategory = category === "all" || event.category === category;

      return matchQuery && matchStatus && matchCategory;
    });
  }, [events, query, status, category]);

  const editingEvent = events.find((event) => event.id === editingId) ?? null;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setActiveStep(1);
    setReviewConfirmed(false);
    setErrors([]);
    setDialogOpen(true);
  }

  function openEdit(event: ManagedEvent) {
    setEditingId(event.id);
    const local = (value: string | null) => {
      if (!value) return "";
      const date = new Date(value);
      const pad = (part: number) => String(part).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
      )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    setForm({
      name: event.name,
      description: event.description ?? "",
      category: event.category as "music" | "conference" | "food" | "sports" | "art",
      venue: event.venue,
      address: event.address,
      city: event.city,
      venueCapacity: event.venueCapacity?.toString() ?? "",
      coverImageUrl: event.coverImageUrl ?? "",
      coverImagePublicId: event.coverImagePublicId ?? "",
      coverImageAlt: event.coverImageAlt ?? "",
      startTime: local(event.startTime),
      endTime: local(event.endTime),
      salesStartAt: local(event.salesStartAt),
      salesEndAt: local(event.salesEndAt),
      checkinStartAt: local(event.checkinStartAt),
      checkinEndAt: local(event.checkinEndAt),
      publishMode: event.scheduledPublishAt ? "scheduled" : "manual",
      scheduledPublishAt: local(event.scheduledPublishAt),
    });
    setActiveStep(1);
    setReviewConfirmed(false);
    setErrors([]);
    setDialogOpen(true);
  }

  function validate() {
    const next: string[] = [];
    if (!form.name.trim()) next.push("Event title is required.");
    if (!form.venue.trim() || !form.address.trim() || !form.city.trim()) {
      next.push("Venue name, address, and city are required.");
    }
    if (
      !form.venueCapacity ||
      !Number.isInteger(Number(form.venueCapacity)) ||
      Number(form.venueCapacity) < 1
    ) {
      next.push("Venue capacity must be a positive whole number (at least 1).");
    }
    if (form.coverImageUrl.trim()) {
      try {
        const url = new URL(form.coverImageUrl.trim());
        if (!["http:", "https:"].includes(url.protocol)) {
          next.push("Cover image URL must start with http:// or https://.");
        }
      } catch {
        next.push("Cover image URL is invalid.");
      }
    }
    if (!form.startTime || !form.endTime) {
      next.push("Event start time and end time are required.");
    }
    if (!form.salesStartAt || !form.salesEndAt) {
      next.push("Ticket sales start and end times are required.");
    }
    if (!form.checkinStartAt || !form.checkinEndAt) {
      next.push("Check-in start and end times are required.");
    }
    if (form.startTime && form.endTime && new Date(form.endTime) <= new Date(form.startTime)) {
      next.push("Event end time must be strictly after the start time.");
    }
    if (
      form.salesStartAt &&
      form.salesEndAt &&
      new Date(form.salesEndAt) <= new Date(form.salesStartAt)
    ) {
      next.push("Ticket sales end must be after ticket sales start.");
    }
    if (
      form.salesStartAt &&
      form.startTime &&
      new Date(form.salesStartAt) >= new Date(form.startTime)
    ) {
      next.push("Ticket sales must start before the Event commences.");
    }
    if (
      form.salesEndAt &&
      form.endTime &&
      new Date(form.salesEndAt) > new Date(form.endTime)
    ) {
      next.push("Ticket sales cannot end after the Event concludes.");
    }
    if (
      form.checkinStartAt &&
      form.checkinEndAt &&
      new Date(form.checkinEndAt) <= new Date(form.checkinStartAt)
    ) {
      next.push("Check-in window end must be after check-in start.");
    }
    if (
      form.checkinEndAt &&
      form.endTime &&
      new Date(form.checkinEndAt) > new Date(form.endTime)
    ) {
      next.push("Check-in window cannot end after the event ends.");
    }
    if (
      form.checkinStartAt &&
      form.startTime &&
      new Date(form.checkinStartAt).getTime() > new Date(form.startTime).getTime() - 30 * 60_000
    ) {
      next.push("Check-in must open at least 30 minutes before the Event starts.");
    }
    if (form.publishMode === "scheduled" && !form.scheduledPublishAt) {
      next.push("Please select an automatic scheduled publishing time.");
    }
    if (
      form.scheduledPublishAt &&
      form.startTime &&
      new Date(form.scheduledPublishAt) >= new Date(form.startTime)
    ) {
      next.push("Scheduled publishing must occur before the event begins.");
    }
    return next;
  }

  function validateStep(step: 1 | 2 | 3 | 4) {
    const all = validate();
    if (step === 1) return all.filter((message) => message.includes("title") || message.includes("Cover"));
    if (step === 2) return all.filter((message) => message.includes("Venue") || message.includes("capacity"));
    if (step === 3) return all.filter((message) => /time|sales|check-in|Event end|Event starts|Event concludes/i.test(message));
    return all.filter((message) => /publishing/i.test(message));
  }

  function goToStep(target: 1 | 2 | 3 | 4) {
    if (target <= activeStep) { setErrors([]); setActiveStep(target); return; }
    const pending: string[] = [];
    for (let step = 1; step < target; step += 1) pending.push(...validateStep(step as 1 | 2 | 3 | 4));
    if (pending.length) { setErrors([...new Set(pending)]); return; }
    setErrors([]); setActiveStep(target);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reviewConfirmed) { setActiveStep(4); setErrors(["Confirm the final Event review before saving."]); return; }
    const nextErrors = validate();
    if (nextErrors.length) {
      setErrors(nextErrors);
      const firstInvalid = ([1, 2, 3, 4] as const).find((step) => validateStep(step).length > 0);
      if (firstInvalid) setActiveStep(firstInvalid);
      return;
    }
    const iso = (value: string) => (value ? new Date(value).toISOString() : null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      venue: form.venue.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      venueCapacity: Number(form.venueCapacity),
      coverImageUrl: form.coverImageUrl.trim() || null,
      coverImagePublicId: form.coverImagePublicId.trim() || null,
      coverImageAlt: form.coverImageAlt.trim() || null,
      startTime: iso(form.startTime)!,
      endTime: iso(form.endTime)!,
      salesStartAt: iso(form.salesStartAt)!,
      salesEndAt: iso(form.salesEndAt)!,
      checkinStartAt: iso(form.checkinStartAt)!,
      checkinEndAt: iso(form.checkinEndAt)!,
      scheduledPublishAt: form.publishMode === "scheduled" ? iso(form.scheduledPublishAt) : null,
    };
    try {
      const wasEditing = editingId !== null;
      const saved = wasEditing
        ? await updateAdminEvent(editingId, payload)
        : await createAdminEvent(payload);
      setEvents((current) =>
        editingId
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      setDialogOpen(false);
      if (!wasEditing) navigate(`/admin/ticket-types?eventId=${saved.id}&setup=1`);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save event."]);
    }
  }

  async function removeEvent(event: ManagedEvent) {
    if (event.status !== "draft" || event.soldQuantity > 0) return;
    if (window.confirm(`Permanently delete draft event “${event.name}”?`)) {
      try {
        await deleteAdminEvent(event.id);
        setEvents((current) => current.filter((item) => item.id !== event.id));
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Unable to delete event."]);
      }
    }
  }

  async function publish(event: ManagedEvent) {
    try {
      const saved = await publishAdminEvent(event.id);
      setEvents((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Event is not ready to publish."]);
    }
  }

  async function toggleVisibility(event: ManagedEvent) {
    if (["completed", "cancelled"].includes(event.status)) return;
    const isHidden = event.visibility === "hidden";
    if (!isHidden) {
      setHideTarget(event);
      setHideReason("");
      return;
    }
    try {
      const saved = await setAdminEventVisibility(event.id, true);
      setEvents((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setActionError(null);
    } catch (error) {
      const apiError=error instanceof ApiRequestError?error:null;
      setActionError({
        code:apiError?.code??"EVENT_VISIBILITY_FAILED",
        message:error instanceof Error?error.message:"Unable to make Event visible.",
        hint:apiError?.code==="EVENT_NOT_READY_TO_SHOW"
          ?"All Ticket Types are paused or invalid. Open Ticket Types, activate at least one valid tier, then try Show again."
          :"Review the Event and Ticket Type configuration before trying again.",
      });
    }
  }

  async function confirmHide() {
    if (!hideTarget || hideReason.trim().length < 5) return;
    try {
      const saved = await setAdminEventVisibility(hideTarget.id, false, hideReason.trim());
      setEvents((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setHideTarget(null);
      setHideReason("");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to hide Event."]);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget || cancelReason.trim().length < 10) return;
    setCancelling(true);
    try {
      const saved = await cancelAdminEvent(cancelTarget.id, cancelReason.trim());
      setEvents((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setCancelTarget(null);
      setCancelReason("");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to cancel Event."]);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="events-admin-page">
      {/* Top Header */}
      <header className="events-page-header">
        <div>
          <div className="admin-live-label">
            <CalendarDays size={13} /> EVENT COMMAND CENTER
          </div>
          <h2>Event Management</h2>
          <p>
            Create, schedule, publish, and manage all events with full lifecycle safety.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="events-view-switcher" title="Toggle Grid / List View">
            <button
              type="button"
              className={`events-view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              aria-label="Grid View"
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              className={`events-view-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              aria-label="List View"
            >
              <LayoutList size={16} />
            </button>
          </div>
          <button className="events-primary-button" onClick={openCreate}>
            <Plus size={17} /> Create Event
          </button>
        </div>
      </header>

      {actionError && (
        <div className="events-action-alert" role="alert" aria-live="assertive">
          <AlertCircle size={21}/>
          <div><strong>{actionError.code}</strong><p>{actionError.message}</p><small>{actionError.hint}</small></div>
          <button type="button" onClick={()=>setActionError(null)} aria-label="Dismiss notification"><X size={17}/></button>
        </div>
      )}

      {/* Safety Policy Rule Banner */}
      <div className="events-rule-banner">
        <ShieldAlert size={20} className="flex-shrink-0" />
        <div>
          <strong>Lifecycle Protection Active</strong>
          <p>
            Published events require at least 1 valid ticket type. Events with sold tickets
            cannot be deleted to preserve attendee purchase records.
          </p>
        </div>
      </div>

      {/* Interactive Metric Cards (Clickable filters) */}
      <div className="events-metric-grid">
        <article
          className={`events-metric-card ${status === "all" ? "active-filter" : ""}`}
          onClick={() => setStatus("all")}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setStatus("all"); }}
          role="button"
          tabIndex={0}
          title="Filter all events"
        >
          <header>
            <span>Total Events</span>
            <Globe size={14} className="text-cyan-400" />
          </header>
          <strong>{counts.total}</strong>
        </article>

        <article
          className={`events-metric-card ${status === "draft" ? "active-filter" : ""}`}
          onClick={() => setStatus("draft")}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setStatus("draft"); }}
          role="button"
          tabIndex={0}
          title="Filter draft events"
        >
          <header>
            <span>Drafts</span>
            <Edit3 size={14} className="text-amber-400" />
          </header>
          <strong>{counts.draft}</strong>
        </article>

        <article
          className={`events-metric-card ${
            status === "live" ? "active-filter" : ""
          }`}
          onClick={() => setStatus("live")}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setStatus("live"); }}
          role="button"
          tabIndex={0}
          title="Filter live events"
        >
          <header>
            <span>Live / Ongoing</span>
            <Flame size={14} className="text-emerald-400" />
          </header>
          <strong>{counts.live}</strong>
        </article>

        <article
          className={`events-metric-card ${status === "hidden" ? "active-filter" : ""}`}
          onClick={() => setStatus("hidden")}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setStatus("hidden"); }}
          role="button"
          tabIndex={0}
          title="Filter hidden events"
        >
          <header>
            <span>Hidden</span>
            <EyeOff size={14} className="text-rose-400" />
          </header>
          <strong>{counts.hidden}</strong>
        </article>
      </div>

      {/* Search & Category Chips Filter Bar */}
      <div className="flex flex-col gap-3">
        <div className="events-toolbar flex-wrap">
          <label className="flex-1 min-w-[280px]">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by event title, venue, or city..."
            />
          </label>
          <div className="flex items-center gap-2">
            <ListFilter size={15} className="text-cyan-400/80" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="min-w-[150px]"
            >
              <option value="all">All Statuses</option>
              <option value="live">Live / Ongoing</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="hidden">Hidden from Public</option>
            </select>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="events-category-bar">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`events-cat-chip ${isSelected ? "active" : ""}`}
                onClick={() => setCategory(cat.id)}
              >
                <Icon size={13} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Events Presentation (Grid Cards or Table List) */}
      {loading ? (
        <div className="events-empty">
          <p>Loading command operations...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="events-empty">
          <CalendarClock size={40} className="text-cyan-400/70" />
          <h3>No events match your criteria</h3>
          <p>Try adjusting your search query, status, or category filter.</p>
          <button onClick={openCreate}>
            <Plus size={16} /> Create Draft Event
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="events-cards-grid">
          {filtered.map((event) => {
            const isReady = event.readiness.ready;
            const startDate = new Date(event.startTime);
            return (
              <article
                key={event.id}
                className={`event-card-item ${event.status === "draft" ? "is-draft" : ""} ${event.visibility === "hidden" ? "is-hidden" : ""}`}
              >
                {/* Cover Image Header */}
                <div className="event-card-cover-wrap">
                  {event.coverImageUrl ? (
                    <img
                      src={event.coverImageUrl}
                      alt={event.coverImageAlt || event.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="event-card-cover-fallback">
                      <Ticket size={36} className="opacity-80" />
                      <span className="text-[11px] font-mono tracking-wider">
                        {event.category.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="event-card-cover-overlay" />

                  {/* Status Badges */}
                  <span className={`event-card-status-badge event-status ${event.status}`}>
                    {event.status}
                  </span>

                  <span className="event-card-category-tag">{event.category}</span>
                </div>

                {/* Body Details */}
                <div className="event-card-body">
                  <h3 className="event-card-title" title={event.name}>
                    {event.name}
                  </h3>

                  <div className="event-card-meta">
                    <div className="event-card-meta-item text-cyan-300/90 font-medium">
                      <Clock size={13} className="flex-shrink-0" />
                      <span>
                        {startDate.toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · {startDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="event-card-meta-item">
                      <MapPin size={13} className="flex-shrink-0 text-slate-400" />
                      <span>
                        {event.venue}, {event.city}
                      </span>
                    </div>
                    <div className="event-card-meta-item text-slate-400">
                      <Users size={13} className="flex-shrink-0" />
                      <span>
                        Capacity: <b>{event.venueCapacity?.toLocaleString() ?? "N/A"}</b>
                      </span>
                    </div>
                  </div>

                  {/* Ticket Readiness Tag */}
                  <div
                    className={`event-card-readiness ${isReady ? "ready" : "missing"}`}
                    title={event.readiness.missing.join("\n")}
                  >
                    <div className="flex items-center gap-2">
                      <Ticket size={14} className={isReady ? "text-emerald-400" : "text-amber-400"} />
                      <span className="text-[11px] font-semibold text-slate-200">
                        {event.validTicketTypeCount}/{event.ticketTypeCount} Types
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        isReady ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {isReady ? "✓ Ready" : "! Setup Req"}
                    </span>
                  </div>
                  {event.status === "draft" && !isReady && (
                    <button className="event-card-draft-warning" onClick={() => navigate(`/admin/ticket-types?eventId=${event.id}&setup=1`)}>
                      <AlertCircle size={15}/><span><strong>Draft needs ticket setup</strong><small>Add at least one valid Ticket Type before publishing.</small></span><ChevronRight size={15}/>
                    </button>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="event-card-footer">
                  <button
                    className="events-ticket-button text-xs py-1.5 px-3"
                    onClick={() => navigate(`/admin/ticket-types?eventId=${event.id}`)}
                  >
                    <Ticket size={13} />
                    <span>Tickets</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {event.status === "draft" && (
                      <button
                        className="events-publish-button !h-8 !px-3 text-xs"
                        disabled={!isReady}
                        onClick={() => void publish(event)}
                        title={event.readiness.missing.join(", ")}
                      >
                        <Rocket size={12} className="mr-1" />
                        Publish
                      </button>
                    )}

                    {["published", "ongoing"].includes(event.status) && (
                      <button className="events-icon-button danger !w-8 !h-8" onClick={() => {setCancelTarget(event);setCancelReason("");}} title="Cancel event and protect affected orders"><Ban size={14}/></button>
                    )}

                    <button
                      className={`events-visibility-button !h-8 !px-2.5 ${
                        event.visibility === "hidden" ? "show" : "hide"
                      }`}
                      disabled={["completed", "cancelled"].includes(event.status)}
                      onClick={() => void toggleVisibility(event)}
                      title={
                        event.visibility === "hidden"
                          ? "Show on public site"
                          : "Hide from public site"
                      }
                    >
                      {event.visibility === "hidden" ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>

                    <button
                      className="events-icon-button !w-8 !h-8"
                      disabled={["completed", "cancelled"].includes(event.status)}
                      onClick={() => openEdit(event)}
                      title="Edit event"
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      className="events-icon-button danger !w-8 !h-8"
                      disabled={event.status !== "draft" || event.soldQuantity > 0}
                      onClick={() => void removeEvent(event)}
                      title="Delete draft event"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* TABLE / LIST VIEW */
        <div className="events-list-panel">
          {filtered.map((event) => (
            <article
              className={`events-row ${
                event.status === "draft" ? "event-row-draft" : ""
              } ${event.visibility === "hidden" ? "event-row-hidden" : ""}`}
              key={event.id}
            >
              <div className="events-date">
                <CalendarDays size={18} />
                <strong>
                  {new Date(event.startTime).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  })}
                </strong>
              </div>
              <div className="events-main">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`event-status ${event.status}`}>{event.status}</span>
                  {event.visibility === "hidden" && (
                    <span className="event-visibility-hidden">
                      <EyeOff size={10} /> HIDDEN
                    </span>
                  )}
                  {event.scheduledPublishAt && (
                    <span className="event-scheduled">
                      AUTO · {new Date(event.scheduledPublishAt).toLocaleString("en-GB")}
                    </span>
                  )}
                </div>
                <h3>{event.name}</h3>
                <p>
                  <MapPin size={13} /> {event.venue}, {event.city} · Cap:{" "}
                  {event.venueCapacity?.toLocaleString() ?? "N/A"}
                </p>
              </div>
              <div
                className={`events-ticket-health ${
                  event.readiness.ready ? "ready" : "missing"
                }`}
                title={event.readiness.missing.join(", ")}
              >
                <span className="events-ticket-icon">
                  <Ticket size={16} />
                </span>
                <div>
                  <strong>
                    {event.validTicketTypeCount}/{event.ticketTypeCount}
                  </strong>
                  <span>
                    {event.readiness.ready ? "Ready to publish" : "Requirements missing"}
                  </span>
                </div>
              </div>
              <div className="events-actions">
                <button
                  className="events-ticket-button"
                  onClick={() => navigate(`/admin/ticket-types?eventId=${event.id}`)}
                >
                  <Ticket size={15} /> Ticket Types
                </button>
                {event.status === "draft" && (
                  <button
                    className="events-publish-button"
                    disabled={!event.readiness.ready}
                    onClick={() => void publish(event)}
                    title={event.readiness.missing.join(", ")}
                  >
                    Publish
                  </button>
                )}
                {["published", "ongoing"].includes(event.status) && (
                  <button className="events-cancel-button" onClick={() => {setCancelTarget(event);setCancelReason("");}} title="Cancel event"><Ban size={15}/> Cancel</button>
                )}
                <button
                  className={`events-visibility-button ${
                    event.visibility === "hidden" ? "show" : "hide"
                  }`}
                  disabled={["completed", "cancelled"].includes(event.status)}
                  onClick={() => void toggleVisibility(event)}
                >
                  {event.visibility === "hidden" ? (
                    <>
                      <Eye size={15} /> Show
                    </>
                  ) : (
                    <>
                      <EyeOff size={15} /> Hide
                    </>
                  )}
                </button>
                <button
                  className="events-icon-button"
                  disabled={["completed", "cancelled"].includes(event.status)}
                  onClick={() => openEdit(event)}
                  title="Edit event"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  className="events-icon-button danger"
                  disabled={event.status !== "draft" || event.soldQuantity > 0}
                  onClick={() => void removeEvent(event)}
                  title="Delete draft"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Hide Event Confirmation Modal */}
      {cancelTarget && createPortal(
        <div className="events-dialog-backdrop" role="presentation" onMouseDown={() => setCancelTarget(null)}>
          <div className="events-dialog events-cancel-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span>IRREVERSIBLE LIFECYCLE ACTION</span><h3>Cancel Event</h3></div><button onClick={() => setCancelTarget(null)} aria-label="Close"><X size={20}/></button></header>
            <div className="events-hide-content">
              <div className="events-cancel-impact"><ShieldAlert size={20}/><div><strong>{cancelTarget.name}</strong>
                {cancelTarget.confirmedOrderCount>0?<p>{cancelTarget.confirmedOrderCount} confirmed order(s): QR tickets will be invalidated, refund records created, and cancellation email queued.</p>:cancelTarget.pendingOrderCount>0?<p>{cancelTarget.pendingOrderCount} pending order(s): holds will be released and cancellation email queued.</p>:<p>No customer orders exist. The Event and its Ticket Types will be closed immediately.</p>}
              </div></div>
              <label>Cancellation reason <span className="text-rose-400">*</span><textarea autoFocus rows={4} maxLength={500} value={cancelReason} onChange={(event)=>setCancelReason(event.target.value)} placeholder="Explain the unavoidable reason and attendee support instructions..."/><small>Minimum 10 characters. This reason is stored and sent to affected customers.</small></label>
              <footer><button type="button" onClick={()=>setCancelTarget(null)}>Keep Event</button><button className="events-cancel-confirm" disabled={cancelling||cancelReason.trim().length<10} onClick={()=>void confirmCancel()}><Ban size={15}/>{cancelling?"Cancelling...":"Confirm cancellation"}</button></footer>
            </div>
          </div>
        </div>,document.body)}

      {hideTarget &&
        createPortal(
          <div
            className="events-dialog-backdrop"
            role="presentation"
            onMouseDown={() => setHideTarget(null)}
          >
            <div
              className="events-dialog events-hide-dialog"
              role="dialog"
              aria-modal="true"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <span>SECURITY & COMPLIANCE</span>
                  <h3>Temporarily Hide Event</h3>
                </div>
                <button onClick={() => setHideTarget(null)}>
                  <X size={20} />
                </button>
              </header>
              <div className="events-hide-content">
                <div className="events-rule-banner">
                  <EyeOff size={19} />
                  <div>
                    <strong>{hideTarget.name}</strong>
                    <p>
                      The event will be hidden from public discovery and checkout. Ticket Tier
                      settings are preserved so an administrator can prepare them before showing
                      the event again. Existing orders remain unaffected.
                    </p>
                  </div>
                </div>
                <label>
                  Reason for hiding <span className="text-rose-400">*</span>
                  <textarea
                    autoFocus
                    rows={4}
                    maxLength={500}
                    value={hideReason}
                    onChange={(event) => setHideReason(event.target.value)}
                    placeholder="Provide a clear operational reason for the audit trail (e.g., Venue schedule adjustment, artist update)..."
                  />
                  <small>
                    Minimum 5 characters required for administrative traceability.
                  </small>
                </label>
                <footer>
                  <button type="button" onClick={() => setHideTarget(null)}>
                    Cancel
                  </button>
                  <button
                    className="primary"
                    disabled={hideReason.trim().length < 5}
                    onClick={() => void confirmHide()}
                  >
                    <EyeOff size={15} /> Hide Event
                  </button>
                </footer>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Tabbed Wizard Modal for Creating/Editing Event */}
      {dialogOpen &&
        createPortal(
          <div
            className="events-dialog-backdrop"
            role="presentation"
            onMouseDown={() => setDialogOpen(false)}
          >
            <div
              className="events-dialog !max-w-[760px]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="event-dialog-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <span>ADMIN / EVENT BUILDER</span>
                  <h3 id="event-dialog-title">
                    {editingId ? `Edit Event: ${form.name || "Draft"}` : "Create New Event Draft"}
                  </h3>
                </div>
                <button onClick={() => setDialogOpen(false)} aria-label="Close">
                  <X size={20} />
                </button>
              </header>

              {/* Wizard Step Navigation Tabs */}
              <div className="wizard-tab-nav">
                <button
                  type="button"
                  className={`wizard-tab-item ${activeStep === 1 ? "active" : ""}`}
                  onClick={() => goToStep(1)}
                >
                  <b>1</b>
                  <span>Info & Cover</span>
                </button>
                <button
                  type="button"
                  className={`wizard-tab-item ${activeStep === 2 ? "active" : ""}`}
                  onClick={() => goToStep(2)}
                >
                  <b>2</b>
                  <span>Location</span>
                </button>
                <button
                  type="button"
                  className={`wizard-tab-item ${activeStep === 3 ? "active" : ""}`}
                  onClick={() => goToStep(3)}
                >
                  <b>3</b>
                  <span>Schedules</span>
                </button>
                <button
                  type="button"
                  className={`wizard-tab-item ${activeStep === 4 ? "active" : ""}`}
                  onClick={() => goToStep(4)}
                >
                  <b>4</b>
                  <span>Publishing</span>
                </button>
              </div>

              {editingEvent && editingEvent.status !== "draft" && (
                <div className="events-dialog-guidance">
                  <ShieldAlert size={17} className="flex-shrink-0" />
                  <p>
                    <b>Published Protection Active:</b> Display info and sales windows can be
                    fine-tuned; capacity may only increase.
                  </p>
                </div>
              )}

              {errors.length > 0 && (
                <div className="events-dialog-alert mx-6 mt-4" role="alert">
                  <AlertCircle size={18} className="flex-shrink-0 text-rose-400" />
                  <div>
                    <strong>Please resolve the following:</strong>
                    {errors.map((error) => (
                      <p key={error}>• {error}</p>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={submit} noValidate>
                {/* STEP 1: Basic Information & Cover */}
                {activeStep === 1 && (
                  <div className="wizard-content-step">
                    <div className="wizard-tip-box">
                      <Info size={16} className="flex-shrink-0 text-cyan-400" />
                      <span>
                        Enter the core event details and upload a high-resolution 16:9 cover
                        banner to captivate attendees on public listings.
                      </span>
                    </div>

                    <div className="events-form-grid">
                      <label className="wide">
                        Event Title <span className="text-rose-400">*</span>
                        <input
                          required
                          maxLength={200}
                          placeholder="e.g. Cyberpunk Music Festival 2026"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                      </label>

                      <label>
                        Category <span className="text-rose-400">*</span>
                        <select
                          value={form.category}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              category: e.target.value as typeof form.category,
                            })
                          }
                        >
                          {CATEGORIES.filter((c) => c.id !== "all").map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="wide">
                        Description
                        <textarea
                          rows={3}
                          maxLength={5000}
                          placeholder="Describe the event, artist lineup, VIP perks, and attendee experience..."
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                      </label>

                      <div className="wide">
                        <EventCoverUploader
                          eventName={form.name}
                          value={{
                            url: form.coverImageUrl,
                            publicId: form.coverImagePublicId,
                            alt: form.coverImageAlt,
                          }}
                          onChange={(image) =>
                            setForm({
                              ...form,
                              coverImageUrl: image.url,
                              coverImagePublicId: image.publicId,
                              coverImageAlt: image.alt,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Location & Physical Capacity */}
                {activeStep === 2 && (
                  <div className="wizard-content-step">
                    <div className="wizard-tip-box">
                      <MapPin size={16} className="flex-shrink-0 text-cyan-400" />
                      <span>
                        Specify the physical event venue, city, address, and maximum legal capacity.
                        Ticket quantities across all tiers cannot exceed this capacity.
                      </span>
                    </div>

                    <div className="events-form-grid">
                      <label>
                        Venue Name <span className="text-rose-400">*</span>
                        <input
                          required
                          maxLength={150}
                          placeholder="e.g. National Convention Arena"
                          value={form.venue}
                          onChange={(e) => setForm({ ...form, venue: e.target.value })}
                        />
                      </label>

                      <label>
                        City <span className="text-rose-400">*</span>
                        <input
                          required
                          maxLength={100}
                          placeholder="e.g. Ho Chi Minh City"
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                        />
                      </label>

                      <label className="wide">
                        Street Address <span className="text-rose-400">*</span>
                        <input
                          required
                          maxLength={255}
                          placeholder="e.g. 799 Nguyen Van Linh, District 7"
                          value={form.address}
                          onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                      </label>

                      <label className="wide">
                        Total Venue Capacity (Attendees) <span className="text-rose-400">*</span>
                        <input
                          required
                          type="number"
                          min={
                            editingEvent?.status !== "draft"
                              ? editingEvent?.venueCapacity ?? 1
                              : 1
                          }
                          step="1"
                          placeholder="e.g. 2500"
                          value={form.venueCapacity}
                          onChange={(e) => setForm({ ...form, venueCapacity: e.target.value })}
                        />
                        <small className="text-slate-400 text-[11px] mt-1 block">
                          {editingEvent?.status !== "draft"
                            ? "Published events may only expand capacity to protect sold tickets."
                            : "Total physical head-count permitted in the venue."}
                        </small>
                      </label>
                    </div>
                  </div>
                )}

                {/* STEP 3: Operational Schedules */}
                {activeStep === 3 && (
                  <div className="wizard-content-step">
                    <div className="wizard-tip-box">
                      <Clock size={16} className="flex-shrink-0 text-cyan-400" />
                      <span>
                        Configure the event run-time, the default ticket sales window, and the
                        check-in gate opening period.
                      </span>
                    </div>

                    <div className="flex flex-col gap-5">
                      <fieldset className="events-form-section">
                        <legend className="text-cyan-300 flex items-center gap-1.5">
                          <CalendarDays size={14} /> Event Schedule
                        </legend>
                        <div className="events-form-grid">
                          <label>
                            Event Starts At <span className="text-rose-400">*</span>
                            <input
                              required
                              type="datetime-local"
                              value={form.startTime}
                              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                            />
                          </label>
                          <label>
                            Event Ends At <span className="text-rose-400">*</span>
                            <input
                              required
                              type="datetime-local"
                              value={form.endTime}
                              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                            />
                          </label>
                        </div>
                      </fieldset>

                      <fieldset className="events-form-section">
                        <legend className="text-cyan-300 flex items-center gap-1.5">
                          <Ticket size={14} /> Ticket Sales Window
                        </legend>
                        <div className="events-form-grid">
                          <label>
                            Ticket Sales Open <span className="text-rose-400">*</span>
                            <input
                              required
                              type="datetime-local"
                              value={form.salesStartAt}
                              onChange={(e) => setForm({ ...form, salesStartAt: e.target.value })}
                            />
                            <small>Must be before event starts.</small>
                          </label>
                          <label>
                            Ticket Sales Close <span className="text-rose-400">*</span>
                            <input
                              required
                              type="datetime-local"
                              value={form.salesEndAt}
                              onChange={(e) => setForm({ ...form, salesEndAt: e.target.value })}
                            />
                            <small>May run until event conclusion.</small>
                          </label>
                        </div>
                      </fieldset>

                      <fieldset className="events-form-section">
                        <legend className="text-cyan-300 flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Staff QR Check-in Window
                        </legend>
                        <div className="events-form-grid">
                          <label>
                            Check-in Opens <span className="text-rose-400">*</span>
                            <input
                              required
                              type="datetime-local"
                              value={form.checkinStartAt}
                              onChange={(e) =>
                                setForm({ ...form, checkinStartAt: e.target.value })
                              }
                            />
                            <small>At least 30 minutes before event start.</small>
                          </label>
                          <label>
                            Check-in Closes <span className="text-rose-400">*</span>
                            <input
                              required
                              type="datetime-local"
                              value={form.checkinEndAt}
                              onChange={(e) =>
                                setForm({ ...form, checkinEndAt: e.target.value })
                              }
                            />
                            <small>Cannot exceed event end time.</small>
                          </label>
                        </div>
                      </fieldset>
                    </div>
                  </div>
                )}

                {/* STEP 4: Publishing Strategy */}
                {activeStep === 4 && (
                  <div className="wizard-content-step">
                    <div className="wizard-tip-box">
                      <Rocket size={16} className="flex-shrink-0 text-cyan-400" />
                      <span>
                        Choose whether to publish manually once ticket types are added, or set
                        an automated background schedule.
                      </span>
                    </div>

                    <div className="events-publish-box !m-0">
                      <legend>Publishing Mode</legend>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="publishMode"
                          checked={form.publishMode === "manual"}
                          onChange={() =>
                            setForm({
                              ...form,
                              publishMode: "manual",
                              scheduledPublishAt: "",
                            })
                          }
                        />
                        <span>
                          <strong>Manual Publication</strong> — Add ticket types and publish when ready.
                        </span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="publishMode"
                          checked={form.publishMode === "scheduled"}
                          onChange={() =>
                            setForm({ ...form, publishMode: "scheduled" })
                          }
                        />
                        <span>
                          <strong>Automated Schedule</strong> — Automatically go live at a specified time.
                        </span>
                      </label>

                      {form.publishMode === "scheduled" && (
                        <div className="mt-3 pl-7">
                          <label className="block text-xs font-semibold text-cyan-300 mb-1.5">
                            Scheduled Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={form.scheduledPublishAt}
                            onChange={(e) =>
                              setForm({ ...form, scheduledPublishAt: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 text-xs text-slate-300 leading-relaxed">
                      <h4 className="font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                        <ShieldCheck size={15} /> Publishing Readiness Check
                      </h4>
                      <p>
                        After saving this draft, you will be guided to add at least 1 active
                        Ticket Type (e.g. VIP, Standard). Once configured, your event can be
                        published immediately to attendees!
                      </p>
                    </div>

                    <div className="event-review-summary">
                      <h4><CheckCircle2 size={15}/> Final review</h4>
                      <dl><div><dt>Event</dt><dd>{form.name || "Untitled Event"}</dd></div><div><dt>Venue</dt><dd>{form.venue}, {form.city}</dd></div><div><dt>Capacity</dt><dd>{Number(form.venueCapacity || 0).toLocaleString()} attendees</dd></div><div><dt>Publishing</dt><dd>{form.publishMode === "manual" ? "Manual after Ticket Types are ready" : `Scheduled for ${form.scheduledPublishAt || "not selected"}`}</dd></div></dl>
                      <label><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)}/><span><strong>I reviewed this Event draft.</strong><small>{editingId ? "Save the validated changes." : "After saving, continue to Ticket Types to finish setup. The Event will not be published yet."}</small></span></label>
                    </div>
                  </div>
                )}

                {/* Footer with Step Controls */}
                <footer>
                  <div className="event-next-step-note">
                    Step {activeStep} of 4:{" "}
                    {activeStep === 1
                      ? "Basic Info"
                      : activeStep === 2
                      ? "Venue & Capacity"
                      : activeStep === 3
                      ? "Schedules"
                      : "Publishing Strategy"}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeStep > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveStep((s) => (Math.max(1, s - 1) as typeof activeStep))
                        }
                      >
                        Previous
                      </button>
                    )}

                    {activeStep < 4 ? (
                      <button
                        type="button"
                        className="primary"
                        onClick={() =>
                          goToStep(Math.min(4, activeStep + 1) as 1 | 2 | 3 | 4)
                        }
                      >
                        Next Step <ChevronRight size={15} className="ml-1" />
                      </button>
                    ) : (
                      <button className="primary" type="submit" disabled={!reviewConfirmed} title={!reviewConfirmed ? "Confirm the final review before continuing" : undefined}>
                        {editingId ? "Confirm & Save Changes" : "Confirm Draft & Continue to Tickets"}
                      </button>
                    )}
                  </div>
                </footer>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
