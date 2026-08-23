import { CalendarClock, CalendarDays, Edit3, MapPin, Plus, Search, ShieldAlert, Ticket, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createAdminEvent, deleteAdminEvent, listAdminEvents, publishAdminEvent, updateAdminEvent, type AdminEvent as ManagedEvent, type EventStatus as Status } from "@/services/admin-events.service";

type PublishMode = "manual" | "scheduled";

const emptyForm = {
  name: "", description: "", category: "music", venue: "", address: "", city: "", venueCapacity: "", coverImageUrl: "",
  startTime: "", endTime: "", salesStartAt: "", salesEndAt: "",
  publishMode: "manual" as PublishMode, scheduledPublishAt: "",
};

export function AdminEventsPage() {
  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listAdminEvents().then(({ data }) => setEvents(data)).catch((error: Error) => setErrors([error.message])).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => events.filter((event) =>
    (status === "all" || event.status === status) &&
    `${event.name} ${event.venue} ${event.city}`.toLowerCase().includes(query.toLowerCase()),
  ), [events, query, status]);

  const counts = useMemo(() => ({
    total: events.length,
    draft: events.filter((event) => event.status === "draft").length,
    live: events.filter((event) => ["published", "ongoing"].includes(event.status)).length,
    scheduled: events.filter((event) => event.status === "draft" && event.scheduledPublishAt).length,
  }), [events]);

  function openCreate() {
    setEditingId(null); setForm(emptyForm); setErrors([]); setDialogOpen(true);
  }

  function openEdit(event: ManagedEvent) {
    setEditingId(event.id);
    const local = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";
    setForm({ name:event.name, description:event.description??"", category:event.category, venue:event.venue, address:event.address, city:event.city,
      venueCapacity:event.venueCapacity?.toString()??"", coverImageUrl:event.coverImageUrl??"", startTime:local(event.startTime), endTime:local(event.endTime),
      salesStartAt:local(event.salesStartAt), salesEndAt:local(event.salesEndAt), publishMode:event.scheduledPublishAt?"scheduled":"manual", scheduledPublishAt:local(event.scheduledPublishAt) });
    setErrors([]); setDialogOpen(true);
  }

  function validate() {
    const next: string[] = [];
    if (!form.name.trim() || !form.venue.trim() || !form.address.trim() || !form.city.trim()) next.push("Name and complete location are required.");
    if (!form.startTime || !form.endTime) next.push("Start and end times are required.");
    if (form.startTime && form.endTime && new Date(form.endTime) <= new Date(form.startTime)) next.push("End time must be after start time.");
    if (form.salesStartAt && form.salesEndAt && new Date(form.salesEndAt) <= new Date(form.salesStartAt)) next.push("Ticket sales end must be after ticket sales start.");
    if (form.salesEndAt && form.startTime && new Date(form.salesEndAt) > new Date(form.startTime)) next.push("Ticket sales cannot end after the event starts.");
    if (form.publishMode === "scheduled" && !form.scheduledPublishAt) next.push("Choose a scheduled publish time.");
    if (form.scheduledPublishAt && form.startTime && new Date(form.scheduledPublishAt) >= new Date(form.startTime)) next.push("Scheduled publishing must occur before the event starts.");
    return next;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validate();
    if (nextErrors.length) { setErrors(nextErrors); return; }
    const iso = (value: string) => value ? new Date(value).toISOString() : null;
    const payload = { name:form.name.trim(), description:form.description.trim()||null, category:form.category as "music"|"conference"|"food"|"sports"|"art", venue:form.venue.trim(), address:form.address.trim(), city:form.city.trim(), venueCapacity:form.venueCapacity?Number(form.venueCapacity):null, coverImageUrl:form.coverImageUrl.trim()||null, startTime:iso(form.startTime)!, endTime:iso(form.endTime)!, salesStartAt:iso(form.salesStartAt), salesEndAt:iso(form.salesEndAt), checkinStartAt:null, checkinEndAt:null, scheduledPublishAt:form.publishMode==="scheduled"?iso(form.scheduledPublishAt):null };
    try {
      const saved = editingId ? await updateAdminEvent(editingId, payload) : await createAdminEvent(payload);
      setEvents((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setDialogOpen(false);
    } catch (error) { setErrors([error instanceof Error ? error.message : "Unable to save event."]); }
  }

  async function removeEvent(event: ManagedEvent) {
    if (event.status !== "draft" || event.soldQuantity > 0) return;
    if (window.confirm(`Permanently delete draft “${event.name}”?`)) {
      try { await deleteAdminEvent(event.id); setEvents((current) => current.filter((item) => item.id !== event.id)); }
      catch (error) { setErrors([error instanceof Error ? error.message : "Unable to delete event."]); }
    }
  }

  async function publish(event: ManagedEvent) {
    try { const saved=await publishAdminEvent(event.id);setEvents((current)=>current.map((item)=>item.id===saved.id?saved:item)); }
    catch(error){setErrors([error instanceof Error?error.message:"Event is not ready to publish."]);}
  }

  return (
    <section className="events-admin-page">
      <header className="events-page-header">
        <div><div className="admin-live-label"><CalendarDays size={13} /> EVENT LIFECYCLE</div><h2>Event Management</h2><p>Create, schedule, publish, and safely close every event.</p></div>
        <button className="events-primary-button" onClick={openCreate}><Plus size={17} /> Create Event</button>
      </header>

      <div className="events-rule-banner"><ShieldAlert size={20} /><div><strong>Lifecycle protection is active</strong><p>Published events require a valid ticket type. Events with sold tickets can only be cancelled—never permanently deleted.</p></div></div>

      <div className="events-metric-grid">
        {[['Total Events', counts.total], ['Drafts', counts.draft], ['Published / Ongoing', counts.live], ['Scheduled', counts.scheduled]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </div>

      <div className="events-toolbar">
        <label><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, venues, or cities" /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">All statuses</option>{["draft", "published", "ongoing", "completed", "cancelled"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
      </div>

      <div className="events-list-panel">
        {loading ? <div className="events-empty"><p>Loading events...</p></div> : filtered.length === 0 ? <div className="events-empty"><CalendarClock size={38} /><h3>No events found</h3><p>Create your first draft to begin configuring ticket types and publishing rules.</p><button onClick={openCreate}><Plus size={16} /> Create draft</button></div> : filtered.map((event) => (
          <article className="events-row" key={event.id}>
            <div className="events-date"><CalendarDays size={18} /><strong>{new Date(event.startTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</strong></div>
            <div className="events-main"><div><span className={`event-status ${event.status}`}>{event.status}</span>{event.scheduledPublishAt && <span className="event-scheduled">AUTO · {new Date(event.scheduledPublishAt).toLocaleString("en-GB")}</span>}</div><h3>{event.name}</h3><p><MapPin size={13} /> {event.venue}, {event.city}</p></div>
            <div className="events-ticket-health" title={event.readiness.missing.join(", ")}><Ticket size={16} /><strong>{event.validTicketTypeCount}/{event.ticketTypeCount}</strong><span>{event.readiness.ready ? "ready to publish" : "requirements missing"}</span></div>
            <div className="events-actions">{event.status === "draft" && <button disabled={!event.readiness.ready} onClick={() => void publish(event)} title={event.readiness.missing.join(", ")}>Publish</button>}<button disabled={event.status !== "draft"} onClick={() => openEdit(event)} aria-label="Edit event"><Edit3 size={16} /></button><button disabled={event.status !== "draft" || event.soldQuantity > 0} onClick={() => void removeEvent(event)} aria-label="Delete draft"><Trash2 size={16} /></button></div>
          </article>
        ))}
      </div>

      {dialogOpen && <div className="events-dialog-backdrop" role="presentation"><div className="events-dialog" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title">
        <header><div><span>ADMIN / EVENTS</span><h3 id="event-dialog-title">{editingId ? "Edit Event" : "Create Event Draft"}</h3></div><button onClick={() => setDialogOpen(false)} aria-label="Close"><X size={20} /></button></header>
        <form onSubmit={submit}>
          {errors.length > 0 && <div className="events-form-errors">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
          <div className="events-form-grid">
            <label className="wide">Event name<input value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} /></label>
            <label className="wide">Description<textarea value={form.description} onChange={(e) => setForm({...form, description:e.target.value})} /></label>
            <label>Category<select value={form.category} onChange={(e) => setForm({...form, category:e.target.value})}>{["music", "conference", "food", "sports", "art"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>City<input value={form.city} onChange={(e) => setForm({...form, city:e.target.value})} /></label>
            <label>Venue<input value={form.venue} onChange={(e) => setForm({...form, venue:e.target.value})} /></label>
            <label>Address<input value={form.address} onChange={(e) => setForm({...form, address:e.target.value})} /></label>
            <label>Venue capacity<input type="number" min="1" value={form.venueCapacity} onChange={(e) => setForm({...form, venueCapacity:e.target.value})} /></label>
            <label>Cover image URL<input type="url" value={form.coverImageUrl} onChange={(e) => setForm({...form, coverImageUrl:e.target.value})} /></label>
            <label>Starts at<input type="datetime-local" value={form.startTime} onChange={(e) => setForm({...form, startTime:e.target.value})} /></label>
            <label>Ends at<input type="datetime-local" value={form.endTime} onChange={(e) => setForm({...form, endTime:e.target.value})} /></label>
            <label>Ticket sales start<input type="datetime-local" value={form.salesStartAt} onChange={(e) => setForm({...form, salesStartAt:e.target.value})} /></label>
            <label>Ticket sales end<input type="datetime-local" value={form.salesEndAt} onChange={(e) => setForm({...form, salesEndAt:e.target.value})} /></label>
          </div>
          <fieldset className="events-publish-box"><legend>Publishing</legend><label><input type="radio" checked={form.publishMode === "manual"} onChange={() => setForm({...form, publishMode:"manual", scheduledPublishAt:""})} /> Publish manually after adding a valid ticket type</label><label><input type="radio" checked={form.publishMode === "scheduled"} onChange={() => setForm({...form, publishMode:"scheduled"})} /> Schedule automatic publishing</label>{form.publishMode === "scheduled" && <input type="datetime-local" value={form.scheduledPublishAt} onChange={(e) => setForm({...form, scheduledPublishAt:e.target.value})} />}<small>The backend job will publish only if all required data and at least one active ticket type are valid.</small></fieldset>
          <footer><button type="button" onClick={() => setDialogOpen(false)}>Cancel</button><button className="primary" type="submit">{editingId ? "Save Changes" : "Create Draft"}</button></footer>
        </form>
      </div></div>}
    </section>
  );
}
