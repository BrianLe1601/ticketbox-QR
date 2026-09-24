import { Ban, CalendarClock, CalendarDays, Edit3, Eye, EyeOff, MapPin, Plus, Search, ShieldAlert, Ticket, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cancelAdminEvent, createAdminEvent, deleteAdminEvent, listAdminEvents, publishAdminEvent, setAdminEventVisibility, updateAdminEvent, type AdminEvent as ManagedEvent, type EventStatus as Status } from "@/services/admin-events.service";
import { listAdminCategories, type AdminCategory } from "@/services/admin-categories.service";
import { EventCoverUploader } from "@/components/admin/EventCoverUploader";
import { EVENT_LIFECYCLE_FALLBACK_REFRESH_MS } from "@/constants/eventconstants";
import { subscribeToEventLifecycleUpdates } from "@/services/event-realtime.service";

type PublishMode = "manual" | "scheduled";

const statusLabels: Record<Status, string> = {
  draft: "Bản nháp",
  published: "Đã công bố",
  ongoing: "Đang diễn ra",
  completed: "Đã kết thúc",
  cancelled: "Đã hủy",
};

function toDateTimeLocal(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

const emptyForm = {
  name: "", description: "", category: "music", venue: "", address: "", city: "", venueCapacity: "", coverImageUrl: "", coverImagePublicId: "", coverImageAlt: "",
  startTime: "", endTime: "", salesStartAt: "", salesEndAt: "",
  checkinStartAt: "", checkinEndAt: "",
  publishMode: "manual" as PublishMode, scheduledPublishAt: "",
};

export function AdminEventsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category") || "all";
  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideTarget,setHideTarget]=useState<ManagedEvent|null>(null);
  const [hideReason,setHideReason]=useState("");
  const [cancelTarget,setCancelTarget]=useState<ManagedEvent|null>(null);
  const [cancelReason,setCancelReason]=useState("");
  const [cancelError,setCancelError]=useState("");
  const [cancelling,setCancelling]=useState(false);

  useEffect(() => {
    let active = true;
    const refreshEvents = async (initial: boolean) => {
      try {
        const { data } = await listAdminEvents();
        if (active) setEvents(data);
      } catch (error) {
        if (active && initial) setErrors([error instanceof Error ? error.message : "Không thể tải sự kiện."]);
      } finally {
        if (active && initial) setLoading(false);
      }
    };
    void refreshEvents(true);
    const unsubscribeRealtime = subscribeToEventLifecycleUpdates(() => void refreshEvents(false));
    const refreshTimer = window.setInterval(
      () => void refreshEvents(false),
      EVENT_LIFECYCLE_FALLBACK_REFRESH_MS,
    );
    void listAdminCategories(false).then((data) => setCategories(data)).catch(() => {});
    return () => {
      active = false;
      unsubscribeRealtime();
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    if (!dialogOpen && !hideTarget && !cancelTarget) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || cancelling) return;
      if (cancelTarget) setCancelTarget(null);
      else if (hideTarget) setHideTarget(null);
      else setDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [dialogOpen, hideTarget, cancelTarget, cancelling]);

  const filtered = useMemo(() => events.filter((event) =>
    (status === "all" || event.status === status) &&
    (categoryFilter === "all" || event.category === categoryFilter) &&
    `${event.name} ${event.venue} ${event.city} ${event.category}`.toLowerCase().includes(query.toLowerCase()),
  ), [events, query, status, categoryFilter]);

  const counts = useMemo(() => ({
    all: events.length,
    draft: events.filter((event) => event.status === "draft").length,
    published: events.filter((event) => event.status === "published").length,
    ongoing: events.filter((event) => event.status === "ongoing").length,
    completed: events.filter((event) => event.status === "completed").length,
    cancelled: events.filter((event) => event.status === "cancelled").length,
  }), [events]);
  const editingEvent=events.find((event)=>event.id===editingId)??null;

  function openCreate() {
    setEditingId(null); setForm(emptyForm); setErrors([]); setDialogOpen(true);
  }

  function openEdit(event: ManagedEvent) {
    setEditingId(event.id);
    const local = (value: string | null) => {
      if (!value) return "";
      const date = new Date(value);
      const pad = (part: number) => String(part).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    setForm({ name:event.name, description:event.description??"", category:event.category, venue:event.venue, address:event.address, city:event.city,
      venueCapacity:event.venueCapacity?.toString()??"", coverImageUrl:event.coverImageUrl??"", coverImagePublicId:event.coverImagePublicId??"", coverImageAlt:event.coverImageAlt??"", startTime:local(event.startTime), endTime:local(event.endTime),
      salesStartAt:local(event.salesStartAt), salesEndAt:local(event.salesEndAt), checkinStartAt:local(event.checkinStartAt), checkinEndAt:local(event.checkinEndAt),
      publishMode:event.scheduledPublishAt?"scheduled":"manual", scheduledPublishAt:local(event.scheduledPublishAt) });
    setErrors([]); setDialogOpen(true);
  }

  function validate() {
    const next: string[] = [];
    if (!form.name.trim() || !form.venue.trim() || !form.address.trim() || !form.city.trim()) next.push("Tên và đầy đủ thông tin địa điểm là bắt buộc.");
    if (!form.venueCapacity || !Number.isInteger(Number(form.venueCapacity)) || Number(form.venueCapacity) < 1) next.push("Sức chứa phải là số nguyên lớn hơn hoặc bằng 1.");
    if (form.coverImageUrl.trim()) {
      try {
        const url = new URL(form.coverImageUrl.trim());
        if (!["http:", "https:"].includes(url.protocol)) next.push("URL ảnh bìa phải bắt đầu bằng http:// hoặc https://.");
      } catch { next.push("URL ảnh bìa không hợp lệ, ví dụ https://example.com/event.jpg."); }
    }
    if (!form.startTime || !form.endTime) next.push("Thời gian bắt đầu và kết thúc sự kiện là bắt buộc.");
    if (!form.salesStartAt || !form.salesEndAt) next.push("Thời gian bắt đầu và kết thúc bán vé là bắt buộc.");
    if (!form.checkinStartAt || !form.checkinEndAt) next.push("Thời gian bắt đầu và kết thúc check-in là bắt buộc.");
    if (form.startTime && form.endTime && new Date(form.endTime) <= new Date(form.startTime)) next.push("Thời gian kết thúc sự kiện phải sau thời gian bắt đầu.");
    if (form.salesStartAt && form.salesEndAt && new Date(form.salesEndAt) <= new Date(form.salesStartAt)) next.push("Thời gian kết thúc bán vé phải sau thời gian bắt đầu bán.");
    if (form.salesStartAt && form.startTime && new Date(form.salesStartAt) >= new Date(form.startTime)) next.push("Phải mở bán vé trước khi sự kiện bắt đầu.");
    if (form.salesEndAt && form.endTime && new Date(form.salesEndAt) > new Date(form.endTime)) next.push("Không được kết thúc bán vé sau khi sự kiện kết thúc.");
    if (form.checkinStartAt && form.checkinEndAt && new Date(form.checkinEndAt) <= new Date(form.checkinStartAt)) next.push("Thời gian kết thúc check-in phải sau thời gian bắt đầu check-in.");
    if (form.checkinStartAt && form.endTime && new Date(form.checkinStartAt) > new Date(form.endTime)) next.push("Thời gian bắt đầu check-in không được sau khi sự kiện kết thúc.");
    if (form.checkinEndAt && form.endTime && new Date(form.checkinEndAt) > new Date(form.endTime)) next.push("Không được kết thúc check-in sau khi sự kiện kết thúc.");
    if (form.checkinStartAt && form.startTime && form.checkinStartAt.slice(0, 10) !== form.startTime.slice(0, 10)) next.push("Thời gian bắt đầu check-in phải cùng ngày bắt đầu sự kiện.");
    if (form.checkinStartAt && form.startTime && new Date(form.checkinStartAt).getTime() > new Date(form.startTime).getTime() - 30 * 60_000) next.push("Phải mở check-in sớm ít nhất 30 phút trước khi sự kiện bắt đầu.");
    if (form.publishMode === "scheduled" && !form.scheduledPublishAt) next.push("Vui lòng chọn thời gian tự động công bố.");
    if (form.scheduledPublishAt && form.startTime && new Date(form.scheduledPublishAt) >= new Date(form.startTime)) next.push("Thời gian tự động công bố phải trước khi sự kiện bắt đầu.");
    if (editingEvent && editingEvent.activeStaffCount > 0) {
      const startChanged = form.startTime && new Date(form.startTime).getTime() !== new Date(editingEvent.startTime).getTime();
      const endChanged = form.endTime && new Date(form.endTime).getTime() !== new Date(editingEvent.endTime).getTime();
      if (startChanged || endChanged) {
        next.push(`Sự kiện đang có ${editingEvent.activeStaffCount} nhân viên được phân công. Vui lòng thu hồi phân công tại trang Nhân viên trước khi thay đổi lịch.`);
      }
    }
    return next;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validate();
    if (nextErrors.length) { setErrors(nextErrors); return; }
    const iso = (value: string) => value ? new Date(value).toISOString() : null;
    const payload = { name:form.name.trim(), description:form.description.trim()||null, category:form.category.trim(), venue:form.venue.trim(), address:form.address.trim(), city:form.city.trim(), venueCapacity:Number(form.venueCapacity), coverImageUrl:form.coverImageUrl.trim()||null, coverImagePublicId:form.coverImagePublicId.trim()||null, coverImageAlt:form.coverImageAlt.trim()||null, startTime:iso(form.startTime)!, endTime:iso(form.endTime)!, salesStartAt:iso(form.salesStartAt)!, salesEndAt:iso(form.salesEndAt)!, checkinStartAt:iso(form.checkinStartAt)!, checkinEndAt:iso(form.checkinEndAt)!, scheduledPublishAt:form.publishMode==="scheduled"?iso(form.scheduledPublishAt):null };
    try {
      const wasEditing=editingId!==null;
      const saved = wasEditing ? await updateAdminEvent(editingId, payload) : await createAdminEvent(payload);
      setEvents((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setDialogOpen(false);
      if(!wasEditing)navigate(`/admin/ticket-types?eventId=${saved.id}&setup=1`);
    } catch (error) { setErrors([error instanceof Error ? error.message : "Không thể lưu sự kiện."]); }
  }

  async function removeEvent(event: ManagedEvent) {
    if (event.status !== "draft" || event.soldQuantity > 0) return;
    if (window.confirm(`Xóa vĩnh viễn bản nháp “${event.name}”?`)) {
      try { await deleteAdminEvent(event.id); setEvents((current) => current.filter((item) => item.id !== event.id)); }
      catch (error) { setErrors([error instanceof Error ? error.message : "Không thể xóa sự kiện."]); }
    }
  }

  async function publish(event: ManagedEvent) {
    try { const saved=await publishAdminEvent(event.id);setEvents((current)=>current.map((item)=>item.id===saved.id?saved:item)); }
    catch(error){setErrors([error instanceof Error?error.message:"Sự kiện chưa đủ điều kiện để công bố."]);}
  }

  async function toggleVisibility(event: ManagedEvent) {
    if (["completed", "cancelled"].includes(event.status)) return;
    const isHidden = event.visibility === "hidden";
    if (!isHidden) {
      setHideTarget(event);setHideReason("");return;
    }
    try{const saved=await setAdminEventVisibility(event.id,true);setEvents((current)=>current.map((item)=>item.id===saved.id?saved:item));}catch(error){setErrors([error instanceof Error?error.message:"Không thể hiển thị sự kiện."]);}
  }

  async function confirmHide(){if(!hideTarget||hideReason.trim().length<5)return;try{const saved=await setAdminEventVisibility(hideTarget.id,false,hideReason.trim());setEvents((current)=>current.map((item)=>item.id===saved.id?saved:item));setHideTarget(null);setHideReason("");}catch(error){setErrors([error instanceof Error?error.message:"Không thể ẩn sự kiện."]);}}

  function openCancel(event: ManagedEvent) {
    setCancelTarget(event);
    setCancelReason("");
    setCancelError("");
  }

  async function confirmCancel() {
    if (!cancelTarget || cancelReason.trim().length < 10 || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      const saved = await cancelAdminEvent(cancelTarget.id, cancelReason.trim());
      setEvents((current) => current.map((item) => item.id === saved.id ? saved : item));
      setCancelTarget(null);
      setCancelReason("");
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "Không thể hủy sự kiện.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="events-admin-page">
      <header className="events-page-header">
        <div><div className="admin-live-label"><CalendarDays size={13} /> VÒNG ĐỜI SỰ KIỆN</div><h2>Quản lý sự kiện</h2><p>Tạo, lên lịch, công bố và kết thúc sự kiện theo quy trình an toàn.</p></div>
        <button className="events-primary-button" onClick={openCreate}><Plus size={17} /> Tạo sự kiện</button>
      </header>

      <div className="events-rule-banner"><ShieldAlert size={20} /><div><strong>Đang áp dụng quy tắc bảo vệ vòng đời</strong><p>Sự kiện chỉ được công bố khi có hạng vé hợp lệ. Sự kiện đã bán vé chỉ có thể hủy, không được xóa vĩnh viễn.</p></div></div>

      <div className="events-metric-grid">
        <button
          type="button"
          className={`events-metric-card ${status === "all" ? "active" : ""}`}
          onClick={() => {
            setStatus("all");
            setQuery("");
          }}
          aria-pressed={status === "all"}
          aria-label="Xem tất cả sự kiện"
        >
          <span>Tổng sự kiện</span>
          <strong>{loading ? "—" : counts.all}</strong>
          <small>Bấm để xem tất cả</small>
        </button>
        <button
          type="button"
          className={`events-metric-card ${status === "draft" ? "active" : ""}`}
          onClick={() => setStatus("draft")}
          aria-pressed={status === "draft"}
          aria-label="Lọc sự kiện bản nháp"
        >
          <span>Bản nháp</span>
          <strong>{loading ? "—" : counts.draft}</strong>
          <small>Chưa công bố</small>
        </button>
        <button
          type="button"
          className={`events-metric-card ${status === "published" ? "active" : ""}`}
          onClick={() => setStatus("published")}
          aria-pressed={status === "published"}
          aria-label="Lọc sự kiện đã công bố"
        >
          <span>Đã công bố</span>
          <strong>{loading ? "—" : counts.published}</strong>
          <small>Sẵn sàng đón khách</small>
        </button>
        <button
          type="button"
          className={`events-metric-card ${status === "ongoing" ? "active" : ""}`}
          onClick={() => setStatus("ongoing")}
          aria-pressed={status === "ongoing"}
          aria-label="Lọc sự kiện đang diễn ra"
        >
          <span>Đang diễn ra</span>
          <strong>{loading ? "—" : counts.ongoing}</strong>
          <small>Đang mở cửa / check-in</small>
        </button>
        <button
          type="button"
          className={`events-metric-card ${status === "completed" ? "active" : ""}`}
          onClick={() => setStatus("completed")}
          aria-pressed={status === "completed"}
          aria-label="Lọc sự kiện đã kết thúc"
        >
          <span>Đã kết thúc</span>
          <strong>{loading ? "—" : counts.completed}</strong>
          <small>Đã đóng cổng</small>
        </button>
        <button
          type="button"
          className={`events-metric-card ${status === "cancelled" ? "active" : ""}`}
          onClick={() => setStatus("cancelled")}
          aria-pressed={status === "cancelled"}
          aria-label="Lọc sự kiện đã hủy"
        >
          <span>Đã hủy</span>
          <strong>{loading ? "—" : counts.cancelled}</strong>
          <small>Đã dừng & hoàn tiền</small>
        </button>
      </div>

      <div className="events-toolbar">
        <label><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo sự kiện, địa điểm hoặc thành phố" /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">Tất cả trạng thái</option>{(["draft", "published", "ongoing", "completed", "cancelled"] as Status[]).map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select>
        <select value={categoryFilter} onChange={(e) => {
          const next = new URLSearchParams(searchParams);
          if (e.target.value === "all") next.delete("category");
          else next.set("category", e.target.value);
          setSearchParams(next);
        }}>
          <option value="all">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      <div className="events-list-panel">
        {loading ? (
          <div className="events-empty"><p>Đang tải sự kiện...</p></div>
        ) : filtered.length === 0 ? (
          <div className="events-empty">
            <CalendarClock size={38} />
            <h3>
              {query
                ? "Không tìm thấy sự kiện phù hợp"
                : status === "draft"
                  ? "Không có sự kiện bản nháp"
                  : status === "published"
                    ? "Không có sự kiện đã công bố"
                    : status === "ongoing"
                      ? "Không có sự kiện đang diễn ra"
                      : status === "completed"
                        ? "Không có sự kiện đã kết thúc"
                        : status === "cancelled"
                          ? "Không có sự kiện đã hủy"
                          : categoryFilter !== "all"
                            ? "Không có sự kiện thuộc danh mục này"
                            : "Chưa có sự kiện nào"}
            </h3>
            <p>
              {query
                ? `Không có sự kiện nào khớp với từ khóa "${query}"${status !== "all" ? ` trong nhóm ${statusLabels[status]}` : ""}.`
                : status === "cancelled"
                  ? "Hệ thống hiện không có sự kiện nào bị hủy bỏ."
                  : status === "draft"
                    ? "Tất cả sự kiện hiện đã được công bố hoặc chưa có bản nháp mới."
                    : status === "published"
                      ? "Hiện tại không có sự kiện nào ở trạng thái đã công bố."
                      : status === "ongoing"
                        ? "Hiện tại không có sự kiện nào đang diễn ra."
                        : status === "completed"
                          ? "Chưa có sự kiện nào kết thúc."
                          : "Tạo bản nháp đầu tiên để cấu hình hạng vé và điều kiện công bố."}
            </p>
            {query || status !== "all" || categoryFilter !== "all" ? (
              <button
                type="button"
                className="events-secondary-button"
                style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  const next = new URLSearchParams(searchParams);
                  next.delete("category");
                  setSearchParams(next);
                }}
              >
                Đặt lại bộ lọc
              </button>
            ) : (
              <button onClick={openCreate} type="button">
                <Plus size={16} /> Tạo bản nháp
              </button>
            )}
          </div>
        ) : filtered.map((event) => (
          <article className={`events-row ${event.visibility==="hidden"?"event-row-hidden":""}`} key={event.id}>
            <div className="events-date"><CalendarDays size={18} /><strong>{new Date(event.startTime).toLocaleDateString("vi-VN", { day: "2-digit", month: "short" })}</strong></div>
            <div className="events-main"><div><span className={`event-status ${event.status}`}>{statusLabels[event.status]}</span>{event.visibility==="hidden" && <span className="event-visibility-hidden"><EyeOff size={10}/> ĐANG ẨN</span>}{event.scheduledPublishAt && <span className="event-scheduled">TỰ ĐỘNG · {new Date(event.scheduledPublishAt).toLocaleString("vi-VN")}</span>}</div><h3>{event.name}</h3><p><MapPin size={13} /> {event.venue}, {event.city}</p></div>
            <div className={`events-ticket-health ${event.readiness.ready ? "ready" : "missing"}`} title={event.readiness.missing.join(", ")}><span className="events-ticket-icon"><Ticket size={16} /></span><div><strong>{event.validTicketTypeCount}/{event.ticketTypeCount}</strong><span>{event.readiness.ready ? "Sẵn sàng công bố" : "Chưa đủ điều kiện công bố"}</span></div></div>
            <div className="events-actions">
              <button className="events-ticket-button" onClick={() => navigate(`/admin/ticket-types?eventId=${event.id}`)}><Ticket size={15} /> Hạng vé</button>
              <button className="events-ticket-button" onClick={() => navigate(`/admin/staff?eventId=${event.id}`)} title="Xem nhân viên được phân công cho sự kiện"><Users size={15} /> Nhân viên</button>
              {event.status === "draft" && <button className="events-publish-button" disabled={!event.readiness.ready} onClick={() => void publish(event)} title={event.readiness.missing.join(", ")}>Công bố</button>}
              <button className={`events-visibility-button ${event.visibility==="hidden" ? "show" : "hide"}`} disabled={["completed", "cancelled"].includes(event.status)} onClick={() => void toggleVisibility(event)} title={event.visibility==="hidden" ? "Hiển thị trên trang khách" : "Tạm ẩn khỏi trang khách"}>{event.visibility==="hidden" ? <><Eye size={15}/> Hiện</> : <><EyeOff size={15}/> Ẩn</>}</button>
              {["published", "ongoing"].includes(event.status) && <button className="events-cancel-button" onClick={() => openCancel(event)} title="Hủy sự kiện và xử lý các đơn/vé liên quan"><Ban size={15}/> Hủy sự kiện</button>}
              <button className="events-icon-button" disabled={["completed","cancelled"].includes(event.status)} onClick={() => openEdit(event)} aria-label="Sửa sự kiện" title={event.status==="draft"?"Sửa bản nháp":"Sửa thông tin sự kiện được phép"}><Edit3 size={16} /></button>
              <button className="events-icon-button danger" disabled={event.status !== "draft" || event.soldQuantity > 0} onClick={() => void removeEvent(event)} aria-label="Xóa bản nháp" title="Xóa bản nháp"><Trash2 size={16} /></button>
            </div>
          </article>
        ))}
      </div>

      {hideTarget&&createPortal(<div className="events-dialog-backdrop" role="presentation" onMouseDown={()=>setHideTarget(null)}><div className="events-dialog events-hide-dialog" role="dialog" aria-modal="true" onMouseDown={(event)=>event.stopPropagation()}><header><div><span>HIỂN THỊ CÔNG KHAI</span><h3>Tạm ẩn sự kiện</h3></div><button onClick={()=>setHideTarget(null)} aria-label="Đóng"><X size={20}/></button></header><div className="events-hide-content"><div className="events-rule-banner"><EyeOff size={19}/><div><strong>{hideTarget.name}</strong><p>Sự kiện sẽ biến mất khỏi trang khách và mọi hạng vé sẽ tạm dừng bán. Đơn hàng và vé đã phát hành không thay đổi.</p></div></div><label>Lý do ẩn <span>*</span><textarea autoFocus rows={4} maxLength={500} value={hideReason} onChange={(event)=>setHideReason(event.target.value)} placeholder="Mô tả sự cố hoặc nội dung đang bảo trì..."/><small>Tối thiểu 5 ký tự. Lý do được lưu để truy vết quản trị.</small></label><footer><button type="button" onClick={()=>setHideTarget(null)}>Hủy</button><button className="primary" disabled={hideReason.trim().length<5} onClick={()=>void confirmHide()}><EyeOff size={15}/> Ẩn sự kiện</button></footer></div></div></div>,document.body)}

      {cancelTarget && createPortal(
        <div className="events-dialog-backdrop" role="presentation" onMouseDown={() => { if (!cancelling) setCancelTarget(null); }}>
          <div className="events-dialog events-hide-dialog events-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-event-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span>VÒNG ĐỜI SỰ KIỆN</span><h3 id="cancel-event-title">Xác nhận hủy sự kiện</h3></div>
              <button disabled={cancelling} onClick={() => setCancelTarget(null)} aria-label="Đóng"><X size={20}/></button>
            </header>
            <div className="events-hide-content">
              <div className="events-cancel-warning">
                <Ban size={20}/>
                <div>
                  <strong>{cancelTarget.name}</strong>
                  <p>Đây là trạng thái kết thúc không thể mở lại. Hệ thống sẽ ẩn sự kiện, dừng bán vé và thu hồi mọi phân công check-in đang hoạt động.</p>
                  <ul>
                    <li>Đơn đang chờ thanh toán được hủy và lượng vé giữ chỗ được trả lại.</li>
                    <li>Vé đã phát hành bị vô hiệu; đơn đã xác nhận được tạo bản ghi hoàn tiền.</li>
                    <li>Email thông báo hủy được đưa vào hàng đợi; lịch sử nghiệp vụ vẫn được giữ lại.</li>
                  </ul>
                </div>
              </div>
              {cancelError && <div className="events-dialog-alert" role="alert"><ShieldAlert size={17}/><div><strong>Không thể hủy sự kiện</strong><p>{cancelError}</p></div></div>}
              <label>
                Lý do hủy <span>*</span>
                <textarea autoFocus rows={4} maxLength={500} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Nhập lý do cụ thể để lưu vào lịch sử và thông báo người mua..."/>
                <small>Tối thiểu 10 ký tự · {cancelReason.trim().length}/500.</small>
              </label>
              <footer>
                <button type="button" disabled={cancelling} onClick={() => setCancelTarget(null)}>Quay lại</button>
                <button className="danger" disabled={cancelReason.trim().length < 10 || cancelling} onClick={() => void confirmCancel()}><Ban size={15}/> {cancelling ? "Đang hủy..." : "Hủy sự kiện"}</button>
              </footer>
            </div>
          </div>
        </div>, document.body,
      )}

      {dialogOpen && createPortal(<div className="events-dialog-backdrop" role="presentation" onMouseDown={() => setDialogOpen(false)}><div className="events-dialog" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>QUẢN TRỊ / SỰ KIỆN</span><h3 id="event-dialog-title">{editingId ? "Chỉnh sửa sự kiện" : "Tạo bản nháp sự kiện"}</h3></div><button onClick={() => setDialogOpen(false)} aria-label="Đóng"><X size={20} /></button></header>
        {!editingId && <div className="event-setup-path"><div className="active"><b>1</b><span>Thông tin sự kiện</span></div><i/><div><b>2</b><span>Hạng vé</span></div><i/><div><b>3</b><span>Kiểm tra và công bố</span></div></div>}
        {editingEvent&&editingEvent.status!=="draft"&&<div className="events-dialog-guidance"><ShieldAlert size={17}/><p>Bảo vệ sau công bố: chỉ được sửa thông tin hiển thị và khung giờ bán; sức chứa chỉ được tăng. Lịch sự kiện bị khóa sau khi có lượt bán cho đến khi có luồng thông báo người mua.</p></div>}
        {errors.length > 0 && <div className="events-dialog-alert" role="alert"><ShieldAlert size={17} /><div><strong>Vui lòng kiểm tra lại sự kiện</strong>{errors.map((error) => <p key={error}>{error}</p>)}</div></div>}
        <form onSubmit={submit} noValidate>
          <div className="events-form-sections">
            <fieldset className="events-form-section"><legend>Thông tin sự kiện</legend><div className="events-form-grid">
              <label className="wide">Tên sự kiện <span>*</span><input required maxLength={200} value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} /></label>
              <label>Danh mục <span>*</span><select value={form.category} onChange={(e) => setForm({...form, category:e.target.value})}>{categories.length > 0 ? (<>{!categories.some((c) => c.slug === form.category) && form.category && (<option value={form.category}>{form.category}</option>)}{categories.map((item) => (<option key={item.id} value={item.slug}>{item.name}</option>))}</>) : ([{value:"music",label:"Âm nhạc"},{value:"conference",label:"Hội nghị"},{value:"food",label:"Ẩm thực"},{value:"sports",label:"Thể thao"},{value:"art",label:"Nghệ thuật"}].map((item) => <option key={item.value} value={item.value}>{item.label}</option>))}</select></label>
              <label>Sức chứa địa điểm <span>*</span><input required type="number" min={editingEvent?.status!=="draft"?(editingEvent?.venueCapacity??1):1} step="1" placeholder="Ví dụ: 1000" value={form.venueCapacity} onChange={(e) => setForm({...form, venueCapacity:e.target.value})} /><small>{editingEvent?.status!=="draft"?"Chỉ được tăng sau khi công bố.":"Số người tối đa tại địa điểm."}</small></label>
              <label className="wide">Mô tả<textarea rows={3} maxLength={5000} placeholder="Mô tả sự kiện, điểm nổi bật và trải nghiệm người tham dự..." value={form.description} onChange={(e) => setForm({...form, description:e.target.value})} /></label>
              <div className="wide"><EventCoverUploader eventName={form.name} value={{url:form.coverImageUrl,publicId:form.coverImagePublicId,alt:form.coverImageAlt}} onChange={(image)=>setForm({...form,coverImageUrl:image.url,coverImagePublicId:image.publicId,coverImageAlt:image.alt})}/></div>
            </div></fieldset>

            <fieldset className="events-form-section"><legend>Địa điểm</legend><div className="events-form-grid">
              <label>Tên địa điểm <span>*</span><input required maxLength={150} value={form.venue} onChange={(e) => setForm({...form, venue:e.target.value})} /></label>
              <label>Thành phố <span>*</span><input required maxLength={100} value={form.city} onChange={(e) => setForm({...form, city:e.target.value})} /></label>
              <label className="wide">Địa chỉ <span>*</span><input required maxLength={255} value={form.address} onChange={(e) => setForm({...form, address:e.target.value})} /></label>
            </div></fieldset>

            <fieldset className="events-form-section"><legend>Lịch sự kiện</legend>
              {Boolean(editingEvent && editingEvent.activeStaffCount > 0) && (
                <div className="staff-confirm-warning danger" style={{ margin: "0 0 14px", border: "1px solid rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.1)", color: "#fef3c7" }}>
                  <strong style={{ color: "#fbbf24" }}>Cảnh báo bất biến lịch trình:</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
                    <li>Sự kiện đang có <strong>{editingEvent?.activeStaffCount} nhân viên</strong> đang hoạt động.</li>
                    <li>Hệ thống chống xung đột lịch check-in sẽ ngăn chặn đổi ngày giờ khi đang có nhân viên.</li>
                    <li>Vui lòng thu hồi phân công tại trang <a href={`/admin/staff?eventId=${editingEvent?.id}`} target="_blank" rel="noreferrer" style={{ color: "#67e8f9", textDecoration: "underline" }}>Nhân viên</a> trước khi cập nhật thời gian.</li>
                  </ul>
                </div>
              )}
              <div className="events-form-grid">
                <label>Bắt đầu lúc <span>*</span><input required disabled={Boolean(editingEvent&&editingEvent.status!=="draft"&&editingEvent.soldQuantity>0)} type="datetime-local" value={form.startTime} onChange={(e) => setForm({...form, startTime:e.target.value})} /></label>
                <label>Kết thúc lúc <span>*</span><input required disabled={Boolean(editingEvent&&editingEvent.status!=="draft"&&editingEvent.soldQuantity>0)} type="datetime-local" value={form.endTime} onChange={(e) => setForm({...form, endTime:e.target.value})} /></label>
              </div></fieldset>

            <fieldset className="events-form-section"><legend>Khung giờ bán vé mặc định</legend><p>Từng hạng vé có thể dùng khung bán ngắn hơn.</p><div className="events-form-grid">
              <label>Bắt đầu bán vé <span>*</span><input required type="datetime-local" value={form.salesStartAt} onChange={(e) => setForm({...form, salesStartAt:e.target.value})} /><small>Phải trước khi sự kiện bắt đầu.</small></label>
              <label>Kết thúc bán vé <span>*</span><input required type="datetime-local" value={form.salesEndAt} onChange={(e) => setForm({...form, salesEndAt:e.target.value})} /><small>Có thể bán đến khi sự kiện kết thúc.</small></label>
            </div></fieldset>

            <fieldset className="events-form-section"><legend>Khung giờ check-in</legend><p>Nhân viên chỉ được quét vé trong khung giờ vận hành này.</p><div className="events-form-grid">
              <label>Bắt đầu check-in <span>*</span><input required type="datetime-local" min={form.startTime ? `${form.startTime.slice(0, 10)}T00:00` : undefined} max={form.startTime ? toDateTimeLocal(new Date(new Date(form.startTime).getTime() - 30 * 60_000)) : form.endTime || undefined} value={form.checkinStartAt} onChange={(e) => setForm({...form, checkinStartAt:e.target.value})} /><small>Phải cùng ngày bắt đầu sự kiện và sớm ít nhất 30 phút.</small></label>
              <label>Kết thúc check-in <span>*</span><input required type="datetime-local" min={form.checkinStartAt || undefined} max={form.endTime || undefined} value={form.checkinEndAt} onChange={(e) => setForm({...form, checkinEndAt:e.target.value})} /><small>Không được sau khi sự kiện kết thúc.</small></label>
            </div></fieldset>
          </div>
          {(!editingEvent||editingEvent.status==="draft")&&<fieldset className="events-publish-box"><legend>Công bố</legend><label><input type="radio" checked={form.publishMode === "manual"} onChange={() => setForm({...form, publishMode:"manual", scheduledPublishAt:""})} /> Công bố thủ công sau khi thêm hạng vé hợp lệ</label><label><input type="radio" checked={form.publishMode === "scheduled"} onChange={() => setForm({...form, publishMode:"scheduled"})} /> Lên lịch tự động công bố</label>{form.publishMode === "scheduled" && <input type="datetime-local" value={form.scheduledPublishAt} onChange={(e) => setForm({...form, scheduledPublishAt:e.target.value})} />}<small>Tác vụ nền chỉ công bố khi dữ liệu bắt buộc và ít nhất một hạng vé đang hoạt động đều hợp lệ.</small></fieldset>}
          <footer><div className="event-next-step-note">{editingId ? "Thay đổi sẽ được kiểm tra trước khi lưu." : "Bước tiếp theo: cấu hình ít nhất một hạng vé trước khi công bố."}</div><button type="button" onClick={() => setDialogOpen(false)}>Hủy</button><button className="primary" type="submit">{editingId ? "Lưu thay đổi" : "Lưu bản nháp và thêm vé"}</button></footer>
        </form>
      </div></div>, document.body)}
    </section>
  );
}
