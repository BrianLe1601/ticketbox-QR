import { Save } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { EventCoverUploader } from "@/components/admin/EventCoverUploader";
import { Button, Checkbox, Field, Input, Notice, SegmentedControl, Select, SlideOver, Textarea } from "@/components/admin/ui";
import { formatNumber } from "@/lib/admin-format";
import {
  EMPTY_EVENT_FORM, SALES_END_PRESETS, SCHEDULE_FIELDS, applySuggestions, checkinStartMax, errorsByField, formFromEvent, salesEndFor,
  scheduleWarnings, toEventPayload, validateEventForm, type EventFormError, type EventFormValues, type PublishMode, type ScheduleField,
} from "@/lib/admin-event-form";
import type { AdminCategory } from "@/services/admin-categories.service";
import { createAdminEvent, updateAdminEvent, type AdminEvent } from "@/services/admin-events.service";
import type { PlatformSettings } from "@/services/admin-platform-settings.service";

export interface EventFormPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Event to edit, or null to create a Draft. Remount (key) to reset the form. */
  editing: AdminEvent | null;
  categories: AdminCategory[];
  platform: PlatformSettings | null;
  onSaved: (saved: AdminEvent, created: boolean) => void;
}

export function EventFormPanel({ open, onOpenChange, editing, categories, platform, onSaved }: EventFormPanelProps) {
  const selectable = categories.filter((item) => item.selectableForNewEvent);
  const [form, setForm] = useState<EventFormValues>(() => editing ? formFromEvent(editing) : { ...EMPTY_EVENT_FORM, category: selectable[0]?.slug ?? "" });
  const [errors, setErrors] = useState<EventFormError[]>([]);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  // Fields filled by the schedule suggestion and not edited since (creation only).
  const [suggested, setSuggested] = useState<ReadonlySet<ScheduleField>>(() => new Set());
  const [now] = useState(() => Date.now());
  const summaryRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => setForm((current) => ({ ...current, [key]: value }));
  const isScheduleField = (key: string): key is ScheduleField => (SCHEDULE_FIELDS as string[]).includes(key);

  /** Date change: a typed sales/check-in time stops being a suggestion; a new start/end refreshes the suggestions (new Events only). */
  function setDate(key: "startTime" | "endTime" | ScheduleField, value: string) {
    if (isScheduleField(key)) {
      set(key, value);
      if (suggested.has(key)) setSuggested((current) => { const next = new Set(current); next.delete(key); return next; });
      return;
    }
    const next = { ...form, [key]: value };
    if (editing) { setForm(next); return; }
    const applied = applySuggestions(next, suggested, now);
    setForm(applied.form);
    setSuggested(applied.suggested);
  }
  const warnings = scheduleWarnings(form);
  const fieldError = errorsByField(errors);

  // The venue is one fixed place: a new Event copies it, an existing Event shows its snapshot.
  const venue = editing
    ? { name: editing.venue, address: editing.address, city: editing.city, capacity: editing.venueCapacity }
    : platform?.venue ?? null;
  const venueDiffers = Boolean(editing && platform?.venue && (
    editing.venue !== platform.venue.name || editing.address !== platform.venue.address
    || editing.city !== platform.venue.city || editing.venueCapacity !== platform.venue.capacity));
  const hasSales = Boolean(editing && (editing.soldQuantity > 0 || editing.pendingOrderCount > 0 || editing.confirmedOrderCount > 0));
  const canSyncVenue = Boolean(editing && ["draft", "published"].includes(editing.status) && !hasSales);
  const venueMissing = !editing && !platform?.venue;
  const scheduleLocked = Boolean(editing && editing.status !== "draft" && editing.soldQuantity > 0);
  const cannotCreate = !editing && selectable.length === 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const next = validateEventForm(form, { editing, venueMissing });
    setErrors(next);
    setServerError("");
    if (next.length) { requestAnimationFrame(() => summaryRef.current?.focus()); return; }
    setSaving(true);
    try {
      const payload = toEventPayload(form);
      const saved = editing
        ? await updateAdminEvent(editing.id, form.syncVenue ? { ...payload, syncVenue: true, confirmPublicVenueChange: form.confirmPublicVenueChange } : payload)
        : await createAdminEvent(payload);
      onSaved(saved, !editing);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Không thể lưu sự kiện.");
      requestAnimationFrame(() => summaryRef.current?.focus());
    } finally {
      setSaving(false);
    }
  }

  const dateField = (key: "startTime" | "endTime" | ScheduleField, label: string, hint?: string, extra: { min?: string; max?: string; disabled?: boolean } = {}) => (
    <Field label={label} required hint={isScheduleField(key) && suggested.has(key) ? <><span className="ev-suggested">Gợi ý tự điền</span> {hint}</> : hint} error={fieldError[key]}>
      {({ id, describedBy, invalid }) => (
        <Input id={id} type="datetime-local" aria-describedby={describedBy} invalid={invalid} value={form[key]} onChange={(e) => setDate(key, e.target.value)} {...extra} />
      )}
    </Field>
  );

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      pending={saving}
      title={editing ? "Chỉnh sửa sự kiện" : "Tạo bản nháp sự kiện"}
      description={editing ? editing.name : "Bước 1/3: thông tin sự kiện → hạng vé → kiểm tra và công bố."}
      footer={<>
        <span className="ev-form-note">{editing ? "Máy chủ kiểm tra lại mọi thay đổi khi lưu." : "Bước tiếp theo: thêm ít nhất một hạng vé trước khi công bố."}</span>
        <Button disabled={saving} onClick={() => onOpenChange(false)}>Hủy</Button>
        <Button
          variant="primary" type="submit" form="ev-form" icon={Save} loading={saving}
          disabled={venueMissing || cannotCreate}
          disabledReason={venueMissing ? "Chưa cấu hình địa điểm tại Cài đặt" : cannotCreate ? "Chưa bật thể loại nhạc nào" : undefined}
        >
          {editing ? "Lưu thay đổi" : "Lưu bản nháp và thêm vé"}
        </Button>
      </>}
    >
      <form id="ev-form" className="ev-form" onSubmit={submit} noValidate>
        <div ref={summaryRef} tabIndex={-1} className="ev-form-summary">
          {serverError && <Notice tone="danger" title="Không thể lưu sự kiện">{serverError}</Notice>}
          {errors.length > 0 && (
            <Notice tone="danger" title={`Vui lòng kiểm tra lại ${errors.length} mục`}>
              <ul className="ev-missing">{errors.map((error) => <li key={`${error.field}-${error.message}`}>{error.message}</li>)}</ul>
            </Notice>
          )}
        </div>

        {editing && editing.status !== "draft" && (
          <Notice tone="info" title="Bảo vệ sau công bố">
            Chỉ sửa được thông tin hiển thị và khung giờ bán. Địa điểm chỉ đổi được khi chưa có đơn hoặc vé. Lịch sự kiện bị khóa sau khi có lượt bán.
          </Notice>
        )}

        <fieldset className="ev-fs">
          <legend>Thông tin sự kiện</legend>
          <div className="ev-grid">
            <Field label="Tên sự kiện" required error={fieldError.name} className="is-wide">
              {({ id, describedBy, invalid }) => <Input id={id} maxLength={200} aria-describedby={describedBy} invalid={invalid} value={form.name} onChange={(e) => set("name", e.target.value)} />}
            </Field>
            <Field
              label="Thể loại âm nhạc" required error={fieldError.category}
              hint={selectable.length === 0
                ? "Chưa bật thể loại nào; bật tại trang Thể loại nhạc."
                : "Thể loại chưa có trong danh sách hãy chọn “Thể loại nhạc khác”."}
            >
              {({ id, describedBy, invalid }) => (
                <Select id={id} aria-describedby={describedBy} invalid={invalid} value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {!form.category && <option value="" disabled>Chọn thể loại</option>}
                  {editing && !selectable.some((c) => c.slug === editing.category) && (
                    <option value={editing.category}>{categories.find((c) => c.slug === editing.category)?.name ?? editing.category} (giữ thể loại hiện tại)</option>
                  )}
                  {selectable.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
                </Select>
              )}
            </Field>
            <div className="ev-readonly">
              <span className="ev-readonly-label">Sức chứa địa điểm</span>
              <strong className="tb-num">{venue ? `${formatNumber(venue.capacity)} chỗ` : "—"}</strong>
              <span className="ev-readonly-hint">Cố định theo địa điểm; tổng vé các hạng không được vượt quá.</span>
            </div>
            <Field label="Mô tả" className="is-wide">
              {({ id }) => <Textarea id={id} rows={3} maxLength={5000} placeholder="Điểm nổi bật, nghệ sĩ, trải nghiệm người tham dự…" value={form.description} onChange={(e) => set("description", e.target.value)} />}
            </Field>
            <div className="is-wide">
              <EventCoverUploader eventName={form.name} value={{ url: form.coverImageUrl, publicId: form.coverImagePublicId, alt: form.coverImageAlt }}
                onChange={(image) => setForm((current) => ({ ...current, coverImageUrl: image.url, coverImagePublicId: image.publicId, coverImageAlt: image.alt }))} />
              {fieldError.coverImageUrl && <p className="adm-field-error" role="alert">{fieldError.coverImageUrl}</p>}
            </div>
          </div>
        </fieldset>

        <fieldset className="ev-fs">
          <legend>Địa điểm tổ chức</legend>
          {venue ? (
            <dl className="ev-dl">
              <div className="ev-dl-row"><dt>Địa điểm</dt><dd>{venue.name}</dd></div>
              <div className="ev-dl-row"><dt>Địa chỉ</dt><dd>{venue.address}, {venue.city}</dd></div>
            </dl>
          ) : (
            <Notice tone="danger" title="Chưa cấu hình địa điểm tổ chức"><Link to="/admin/settings">Mở Cài đặt để nhập địa điểm</Link>.</Notice>
          )}
          <p className="ev-fs-note">Chỉ có một địa điểm cố định cho mọi sự kiện, quản lý tại <Link to="/admin/settings">Cài đặt</Link>. Hai sự kiện không được trùng lịch từ lúc mở check-in đến khi kết thúc.</p>
          {editing && venueDiffers && (canSyncVenue ? (
            <div className="ev-sync">
              <label className="ev-check">
                <Checkbox checked={form.syncVenue} onChange={(e) => setForm((current) => ({ ...current, syncVenue: e.target.checked, confirmPublicVenueChange: false }))} />
                <span>Áp dụng địa điểm hiện tại: {platform?.venue?.name}, {platform?.venue?.city} (sức chứa {formatNumber(platform?.venue?.capacity)})</span>
              </label>
              {form.syncVenue && editing.status === "published" && (
                <label className="ev-check">
                  <Checkbox checked={form.confirmPublicVenueChange} aria-invalid={Boolean(fieldError.confirmPublicVenueChange) || undefined} onChange={(e) => set("confirmPublicVenueChange", e.target.checked)} />
                  <span>Tôi hiểu sự kiện đã công bố và địa điểm đang hiển thị công khai sẽ thay đổi.</span>
                </label>
              )}
            </div>
          ) : (
            <p className="ev-fs-note" role="status">Địa điểm của sự kiện này khác cấu hình hiện tại nhưng không đổi được: {editing.status === "draft" || editing.status === "published" ? "đã có đơn hoặc vé phát hành" : "sự kiện đang diễn ra hoặc đã đóng"}.</p>
          ))}
        </fieldset>

        <fieldset className="ev-fs">
          <legend>Lịch sự kiện</legend>
          <p className="ev-fs-note">Địa điểm bận từ <strong>giờ bắt đầu check-in</strong> đến <strong>giờ kết thúc sự kiện</strong>; chạm biên cũng tính là trùng. Máy chủ kiểm tra lại khi lưu.</p>
          {editing && editing.activeStaffCount > 0 && (
            <Notice tone="warning" title={`Đang có ${editing.activeStaffCount} nhân viên được phân công`}>
              Không đổi được giờ bắt đầu/kết thúc khi còn phân công. Thu hồi tại <Link to={`/admin/staff?eventId=${editing.id}`}>trang Nhân viên</Link> trước.
            </Notice>
          )}
          {fieldError.staff && <p className="adm-field-error" role="alert">{fieldError.staff}</p>}
          {scheduleLocked && <p className="ev-fs-note" role="status">Lịch bị khóa vì sự kiện đã có vé bán.</p>}
          <div className="ev-grid">
            {dateField("startTime", "Bắt đầu lúc", undefined, { disabled: scheduleLocked })}
            {dateField("endTime", "Kết thúc lúc", undefined, { disabled: scheduleLocked })}
          </div>
        </fieldset>

        <fieldset className="ev-fs">
          <legend>Khung giờ bán vé mặc định</legend>
          <p className="ev-fs-note">Từng hạng vé có thể dùng khung bán ngắn hơn.{!editing && " Nhập giờ bắt đầu và kết thúc, các ô còn trống sẽ được gợi ý sẵn."}</p>
          <div className="ev-grid">
            {dateField("salesStartAt", "Bắt đầu bán vé", "Phải trước khi sự kiện bắt đầu.")}
            {dateField("salesEndAt", "Kết thúc bán vé", "Khuyến nghị: đến giờ mở màn. Muộn nhất: lúc đóng check-in.")}
          </div>
          <div className="ev-presets" role="group" aria-label="Chọn nhanh giờ kết thúc bán vé">
            <span className="ev-presets-label">Kết thúc bán vé:</span>
            {SALES_END_PRESETS.map((preset) => {
              const value = salesEndFor(preset.key, form);
              return (
                <Button key={preset.key} size="sm" variant={value && form.salesEndAt === value ? "primary" : "secondary"} aria-pressed={Boolean(value) && form.salesEndAt === value}
                  disabled={!value} disabledReason={!form.startTime || !form.endTime ? "Nhập giờ bắt đầu và kết thúc trước" : preset.key === "checkinEnd" && !form.checkinEndAt ? "Nhập giờ kết thúc check-in trước" : "Phải sau giờ bắt đầu bán và không sau giờ đóng check-in"}
                  title={preset.hint} onClick={() => setDate("salesEndAt", value)}>{preset.label}</Button>
              );
            })}
          </div>
          {warnings.filter((w) => w.severity === "error").map((warning) => (
            <Notice key={warning.message} tone="danger" title="Khung giờ bán không hợp lệ">{warning.message}</Notice>
          ))}
          {warnings.some((w) => w.severity === "warning") && (
            <Notice tone="warning" title="Lưu ý về khung giờ bán">
              <ul className="ev-missing">{warnings.filter((w) => w.severity === "warning").map((warning) => <li key={warning.message}>{warning.message}</li>)}</ul>
              <span>Vẫn lưu được; đây chỉ là nhắc nhở.</span>
            </Notice>
          )}
        </fieldset>

        <fieldset className="ev-fs">
          <legend>Khung giờ check-in</legend>
          <p className="ev-fs-note">Nhân viên chỉ quét vé trong khung giờ này.</p>
          <div className="ev-grid">
            {dateField("checkinStartAt", "Bắt đầu check-in", "Cùng ngày bắt đầu sự kiện và sớm ít nhất 2 giờ.", {
              min: form.startTime ? `${form.startTime.slice(0, 10)}T00:00` : undefined,
              max: form.startTime ? checkinStartMax(form.startTime) : form.endTime || undefined,
            })}
            {dateField("checkinEndAt", "Kết thúc check-in", "Không được sau khi sự kiện kết thúc; bán vé phải đóng trước hoặc đúng lúc này.", { min: form.checkinStartAt || undefined, max: form.endTime || undefined })}
          </div>
        </fieldset>

        {(!editing || editing.status === "draft") && (
          <fieldset className="ev-fs">
            <legend>Công bố</legend>
            <SegmentedControl<PublishMode>
              ariaLabel="Cách công bố"
              value={form.publishMode}
              onChange={(mode) => setForm((current) => ({ ...current, publishMode: mode, scheduledPublishAt: mode === "manual" ? "" : current.scheduledPublishAt }))}
              options={[{ value: "manual", label: "Công bố thủ công" }, { value: "scheduled", label: "Lên lịch tự động" }]}
            />
            {form.publishMode === "scheduled" && (
              <div className="ev-grid">
                <Field label="Tự động công bố lúc" required error={fieldError.scheduledPublishAt} hint="Phải trước khi sự kiện bắt đầu.">
                  {({ id, describedBy, invalid }) => <Input id={id} type="datetime-local" aria-describedby={describedBy} invalid={invalid} value={form.scheduledPublishAt} onChange={(e) => set("scheduledPublishAt", e.target.value)} />}
                </Field>
              </div>
            )}
            <p className="ev-fs-note">Tác vụ nền chỉ công bố khi dữ liệu bắt buộc và ít nhất một hạng vé đang hoạt động đều hợp lệ.</p>
          </fieldset>
        )}
      </form>
    </SlideOver>
  );
}
