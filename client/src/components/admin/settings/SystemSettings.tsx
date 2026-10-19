import { CheckCircle2, ListTree, Music2, RotateCcw, Save } from "lucide-react";
import { useState, type FormEvent } from "react";

import { BentoCard, Button, ButtonLink, ConfirmDialog, Field, Input, Notice, SegmentedControl } from "@/components/admin/ui";
import { formatNumber } from "@/lib/admin-format";
import {
  SCOPE_OPTIONS, scopeCounts, validateVenue, venueDirty, venueFormOf, venueImpact, venuePayload, type VenueField, type VenueForm,
} from "@/lib/admin-settings";
import { digitsOnly } from "@/lib/utils";
import type { AdminCategory } from "@/services/admin-categories.service";
import { listAdminCategories } from "@/services/admin-categories.service";
import { saveCategoryScope, saveVenueSettings, type CategoryScope, type PlatformSettings } from "@/services/admin-platform-settings.service";

const message = (cause: unknown) => (cause instanceof Error && cause.message ? cause.message : "Không thể kết nối máy chủ.");

/**
 * The single concert venue and the Category scope for new Events. Both are platform-wide and
 * re-validated by the server; the form state lives in the page so switching tabs keeps edits.
 */
export function SystemSettings({ settings, categories, form, onForm, onSettings, onCategories }: {
  settings: PlatformSettings; categories: AdminCategory[]; form: VenueForm;
  onForm: (next: VenueForm) => void; onSettings: (next: PlatformSettings) => void; onCategories: (next: AdminCategory[]) => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<VenueField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [venueError, setVenueError] = useState("");
  const [venueNotice, setVenueNotice] = useState("");
  const [scopeAsk, setScopeAsk] = useState(false);
  const [scopeSaving, setScopeSaving] = useState(false);
  const [scopeError, setScopeError] = useState("");
  const [scopeNotice, setScopeNotice] = useState("");

  const dirty = venueDirty(settings.venue, form);
  const counts = scopeCounts(categories);
  const scope = settings.categoryScope;
  const set = (field: VenueField, value: string) => { onForm({ ...form, [field]: value }); setVenueNotice(""); if (errors[field]) setErrors({ ...errors, [field]: undefined }); };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const next = validateVenue(form);
    setErrors(next); setVenueError(""); setVenueNotice("");
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const saved = await saveVenueSettings(venuePayload(form));
      onSettings(saved); onForm(venueFormOf(saved.venue));
      setVenueNotice(saved.outOfSyncEventCount > 0
        ? `Đã lưu. ${saved.outOfSyncEventCount} sự kiện nháp/đã công bố vẫn dùng địa điểm cũ; mở từng sự kiện để áp dụng địa điểm mới (chỉ khi chưa có đơn hoặc vé).`
        : "Đã lưu địa điểm tổ chức.");
    } catch (cause) { setVenueError(message(cause)); } finally { setSaving(false); }
  }

  async function applyScope(next: CategoryScope) {
    if (scopeSaving || next === scope) return;
    setScopeSaving(true); setScopeError(""); setScopeNotice("");
    try {
      onSettings(await saveCategoryScope(next));
      onCategories(await listAdminCategories(true));
      setScopeAsk(false);
      setScopeNotice(next === "music_only" ? "Sự kiện mới chỉ chọn được thể loại âm nhạc." : "Sự kiện mới chọn được mọi danh mục đang hoạt động.");
    } catch (cause) { setScopeError(message(cause)); } finally { setScopeSaving(false); }
  }

  const field = (key: VenueField, label: string, props: { maxLength: number; hint?: string; numeric?: boolean; wide?: boolean }) => (
    <Field label={label} required error={errors[key]} hint={props.hint} className={props.wide ? "is-wide" : undefined}>
      {({ id, describedBy, invalid }) => (
        <Input id={id} aria-describedby={describedBy} invalid={invalid} maxLength={props.maxLength} autoComplete="off" value={form[key]}
          {...(props.numeric ? { inputMode: "numeric" as const, pattern: "[0-9]*" } : {})}
          onChange={(event) => set(key, props.numeric ? digitsOnly(event.target.value, 7) : event.target.value)} />
      )}
    </Field>
  );

  return (
    <>
      <BentoCard span={7} title="Địa điểm tổ chức" subtitle="TicketBox chỉ có một địa điểm; mọi sự kiện mới tự lấy thông tin này"
        actions={settings.venue ? <span className="st-pill is-ok"><CheckCircle2 size={14} aria-hidden="true" /> Đã cấu hình</span> : <span className="st-pill is-missing">Chưa cấu hình</span>}>
        <form className="st-form" onSubmit={submit} noValidate aria-label="Địa điểm tổ chức">
          {!settings.venue && <Notice tone="warning" title="Chưa thể tạo sự kiện mới">Nhập và lưu địa điểm bên dưới trước khi tạo sự kiện.</Notice>}
          <fieldset className="st-grid" disabled={saving}>
            {field("name", "Tên địa điểm", { maxLength: 150 })}
            {field("city", "Thành phố", { maxLength: 100 })}
            {field("address", "Địa chỉ", { maxLength: 255, wide: true })}
            {field("capacity", "Sức chứa tối đa", { maxLength: 7, numeric: true, hint: "Tổng vé các hạng của một sự kiện không được vượt quá số này." })}
            {settings.venue && <div className="st-current"><span>Đang lưu</span><strong className="tb-num">{formatNumber(settings.venue.capacity)} chỗ</strong></div>}
          </fieldset>
          {venueError && <Notice tone="danger" title="Chưa lưu được địa điểm">{venueError}</Notice>}
          {venueNotice && <Notice tone="success">{venueNotice}</Notice>}
          {settings.outOfSyncEventCount > 0 && !venueNotice && (
            <Notice tone="info" title={`${formatNumber(settings.outOfSyncEventCount)} sự kiện đang dùng địa điểm khác cấu hình này`}
              action={<ButtonLink to="/admin/events" size="sm">Mở Sự kiện</ButtonLink>}>
              Sự kiện nháp hoặc đã công bố chưa có đơn/vé có thể chọn “Áp dụng địa điểm hiện tại” khi sửa.
            </Notice>
          )}
          <div className="st-actions">
            <p className="st-note">{dirty ? venueImpact(settings, form) : "Không có thay đổi chưa lưu."}</p>
            {settings.venue && dirty && <Button icon={RotateCcw} disabled={saving} onClick={() => { onForm(venueFormOf(settings.venue)); setErrors({}); setVenueError(""); }}>Hoàn tác</Button>}
            <Button type="submit" variant="primary" icon={Save} loading={saving} disabled={!dirty} disabledReason="Chưa có thay đổi">Lưu địa điểm</Button>
          </div>
        </form>
      </BentoCard>

      <BentoCard span={5} title="Phạm vi danh mục" subtitle="Những danh mục được chọn khi tạo sự kiện mới; máy chủ kiểm tra lại khi lưu"
        actions={<ButtonLink to="/admin/categories" size="sm" icon={ListTree}>Danh mục</ButtonLink>}>
        <SegmentedControl<CategoryScope> ariaLabel="Phạm vi danh mục cho sự kiện mới" value={scope} options={SCOPE_OPTIONS}
          onChange={(next) => { if (next === "all") { setScopeError(""); setScopeAsk(true); } else void applyScope(next); }} />
        <dl className="st-stats">
          <div><dt><Music2 size={14} aria-hidden="true" /> Thể loại âm nhạc đang hoạt động</dt><dd className="tb-num">{formatNumber(counts.music)}</dd></div>
          <div><dt>Danh mục khác đang hoạt động</dt><dd className="tb-num">{formatNumber(counts.otherActive)}</dd></div>
          <div><dt>Chọn được cho sự kiện mới</dt><dd className="tb-num"><strong>{formatNumber(scope === "all" ? counts.music + counts.otherActive : counts.music)}</strong></dd></div>
        </dl>
        {scope === "all" && <Notice tone="warning" title="Đang mở rộng ngoài phạm vi concert">Chỉ dùng khi thật sự cần, rồi chuyển lại “Chỉ thể loại âm nhạc”.</Notice>}
        {scopeError && <Notice tone="danger" title="Chưa đổi được phạm vi">{scopeError}</Notice>}
        {scopeNotice && <Notice tone="success">{scopeNotice}</Notice>}
        <p className="st-note">
          Danh mục cũ không bị xóa hay tự đổi loại; sự kiện đã có giữ danh mục của mình. Đặt loại “Âm nhạc” hoặc “Khác” tại trang Danh mục.
        </p>
      </BentoCard>

      <ConfirmDialog
        open={scopeAsk} onOpenChange={(open) => { if (!open && !scopeSaving) setScopeAsk(false); }}
        tone="primary" title="Mở rộng cho mọi danh mục?"
        consequences={[
          `Sự kiện mới chọn được cả ${formatNumber(counts.otherActive)} danh mục không phải thể loại âm nhạc.`,
          "Sự kiện đã có không thay đổi.",
          "Nằm ngoài phạm vi concert của đồ án; nên chuyển lại sau khi dùng xong.",
        ]}
        confirmLabel="Mở rộng" pending={scopeSaving} error={scopeError || undefined}
        onConfirm={() => applyScope("all")}
      />
    </>
  );
}
