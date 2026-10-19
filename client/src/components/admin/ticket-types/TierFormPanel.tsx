import { Save, Sparkles } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button, Checkbox, Field, Input, Notice, SlideOver, Switch, Textarea } from "@/components/admin/ui";
import { formatDateTime, formatNumber } from "@/lib/admin-format";
import {
  EMPTY_TIER_FORM, capacityPreset, capacityRoom, priceLock, tierFormFrom, tierPayload, validateTierForm,
  type TierFormError, type TierFormField, type TierFormValues,
} from "@/lib/admin-ticket-types";
import { digitsOnly } from "@/lib/utils";
import type { AdminEvent } from "@/services/admin-events.service";
import { createAdminTicketType, updateAdminTicketType, type AdminTicketType } from "@/services/admin-ticket-types.service";

const PRESETS = [
  { name: "Vé phổ thông", price: "200000", desc: "Vào cổng và khu vực khán giả chung của concert." },
  { name: "Vé VIP", price: "500000", desc: "Làn check-in ưu tiên và khu vực gần sân khấu." },
  { name: "Vé mua sớm", price: "150000", desc: "Giá ưu đãi cho người mua sớm, số lượng có hạn." },
  { name: "Vé miễn phí (đăng ký)", price: "0", desc: "Miễn phí, cần đăng ký để theo dõi sức chứa." },
];

export function TierFormPanel({ open, onOpenChange, event, editing, unallocated, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; event: AdminEvent; editing: AdminTicketType | null;
  unallocated: number; onSaved: (saved: AdminTicketType, created: boolean) => void;
}) {
  const [form, setForm] = useState<TierFormValues>(() => (editing ? tierFormFrom(editing) : EMPTY_TIER_FORM));
  const [errors, setErrors] = useState<TierFormError[]>([]);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof TierFormValues>(key: K, value: TierFormValues[K]) => setForm((current) => ({ ...current, [key]: value }));
  const fieldError: Partial<Record<TierFormField, string>> = {};
  for (const error of errors) fieldError[error.field] ??= error.message;
  const lock = priceLock(editing, event);
  const room = capacityRoom(unallocated, editing);
  const draft = event.status === "draft";

  async function submit(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    if (saving) return;
    const next = validateTierForm(form, { event, editing, unallocated });
    setErrors(next);
    setServerError("");
    if (next.length) { requestAnimationFrame(() => summaryRef.current?.focus()); return; }
    setSaving(true);
    try {
      const payload = tierPayload(form, event, editing);
      // A locked price is never sent, so an unchanged field cannot trip the server's price rule.
      const saved = editing
        ? await updateAdminTicketType(editing.id, lock.allowed ? payload : { ...payload, price: undefined })
        : await createAdminTicketType({ eventId: event.id, ...payload });
      onSaved(saved, !editing);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Không thể lưu hạng vé.");
      requestAnimationFrame(() => summaryRef.current?.focus());
    } finally {
      setSaving(false);
    }
  }

  const numberField = (key: "price" | "capacity" | "maxPerOrder", label: string, max: number, extra: { hint?: string; disabled?: boolean; placeholder?: string } = {}) => (
    <Field label={label} required hint={extra.hint} error={fieldError[key]}>
      {({ id, describedBy, invalid }) => (
        <Input id={id} inputMode="numeric" aria-describedby={describedBy} invalid={invalid} disabled={extra.disabled} placeholder={extra.placeholder}
          value={form[key]} onChange={(e) => set(key, digitsOnly(e.target.value, max))} />
      )}
    </Field>
  );

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      pending={saving}
      title={editing ? "Chỉnh sửa hạng vé" : "Thêm hạng vé"}
      description={event.name}
      footer={<>
        <span className="tt-form-note">Máy chủ kiểm tra lại sức chứa và giá khi lưu.</span>
        <Button disabled={saving} onClick={() => onOpenChange(false)}>Hủy</Button>
        <Button variant="primary" type="submit" form="tt-form" icon={Save} loading={saving}>{editing ? "Lưu thay đổi" : "Tạo hạng vé"}</Button>
      </>}
    >
      <form id="tt-form" className="tt-form" onSubmit={submit} noValidate>
        <div ref={summaryRef} tabIndex={-1} className="tt-form-summary">
          {serverError && <Notice tone="danger" title="Không thể lưu hạng vé">{serverError}</Notice>}
          {errors.length > 0 && (
            <Notice tone="danger" title={`Vui lòng kiểm tra lại ${errors.length} mục`}>
              <ul className="tt-list">{errors.map((error) => <li key={`${error.field}-${error.message}`}>{error.message}</li>)}</ul>
            </Notice>
          )}
        </div>

        {!draft && !editing && <Notice tone="info" title="Hạng vé mới sẽ ở trạng thái Tạm dừng">Sự kiện đã công bố: kiểm tra lại rồi bấm Mở bán trên thẻ hạng vé.</Notice>}
        {!draft && editing && !lock.allowed && <Notice tone="warning" title="Giá đang bị khóa">{lock.reason}</Notice>}

        {!editing && (
          <fieldset className="tt-fs">
            <legend>Mẫu nhanh</legend>
            <div className="tt-presets">
              {PRESETS.map((preset) => (
                <Button key={preset.name} size="sm" variant="ghost" icon={Sparkles}
                  onClick={() => setForm((current) => ({ ...current, name: preset.name, price: preset.price, description: preset.desc }))}>
                  {preset.name}
                </Button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="tt-fs">
          <legend>Thông tin</legend>
          <div className="tt-grid">
            <Field label="Tên hạng vé" required error={fieldError.name} className="is-wide">
              {({ id, describedBy, invalid }) => <Input id={id} maxLength={100} aria-describedby={describedBy} invalid={invalid} placeholder="Ví dụ: Vé VIP" value={form.name} onChange={(e) => set("name", e.target.value)} />}
            </Field>
            {numberField("price", "Giá vé (VNĐ)", 10, { disabled: !lock.allowed, placeholder: "Ví dụ: 250000", hint: !lock.allowed ? "Đang khóa: xem thông báo phía trên." : form.price !== "" && !fieldError.price ? `${Number(form.price) === 0 ? "Miễn phí" : `${formatNumber(Number(form.price))} ₫`} · thanh toán là mô phỏng` : "Nhập 0 cho vé miễn phí." })}
            {numberField("maxPerOrder", "Tối đa mỗi đơn", 3, { hint: "Từ 1 đến 100 vé." })}
            <Field label="Mô tả quyền lợi" className="is-wide">
              {({ id }) => <Textarea id={id} rows={2} maxLength={500} placeholder="Quyền lợi, khu vực, cổng soát vé riêng…" value={form.description} onChange={(e) => set("description", e.target.value)} />}
            </Field>
          </div>
        </fieldset>

        <fieldset className="tt-fs">
          <legend>Sức chứa</legend>
          <div className="tt-grid">
            {numberField("capacity", "Số vé phát hành", 10, { hint: `Có thể dùng tối đa ${formatNumber(room)} chỗ${editing && !draft ? `; không giảm dưới ${formatNumber(editing.capacity)} sau khi công bố` : ""}.` })}
            <div className="tt-presets tt-presets--cap" role="group" aria-label="Chọn nhanh theo chỗ còn trống">
              {[25, 50, 75, 100].map((percent) => (
                <Button key={percent} size="sm" disabled={room < 1} onClick={() => set("capacity", String(capacityPreset(room, percent)))}>
                  {percent === 100 ? `Tối đa (${formatNumber(room)})` : `${percent}%`}
                </Button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="tt-fs">
          <legend>Khung giờ bán</legend>
          <label className="tt-check">
            <Checkbox checked={!form.customSales} onChange={(e) => setForm((current) => ({ ...current, customSales: !e.target.checked, salesStart: "", salesEnd: "" }))} />
            <span>
              <strong>Dùng lịch bán mặc định của sự kiện</strong>
              <small className="tb-num">{event.salesStartAt ? formatDateTime(event.salesStartAt) : "Ngay khi công bố"} → {event.salesEndAt ? formatDateTime(event.salesEndAt) : "khi sự kiện kết thúc"}</small>
            </span>
          </label>
          {form.customSales && (
            <div className="tt-grid">
              <Field label="Mở bán riêng" required error={fieldError.salesStart}>
                {({ id, describedBy, invalid }) => <Input id={id} type="datetime-local" aria-describedby={describedBy} invalid={invalid} value={form.salesStart} onChange={(e) => set("salesStart", e.target.value)} />}
              </Field>
              <Field label="Kết thúc bán riêng" required error={fieldError.salesEnd} hint="Không sau giờ kết thúc sự kiện.">
                {({ id, describedBy, invalid }) => <Input id={id} type="datetime-local" aria-describedby={describedBy} invalid={invalid} value={form.salesEnd} onChange={(e) => set("salesEnd", e.target.value)} />}
              </Field>
            </div>
          )}
        </fieldset>

        {draft && (
          <fieldset className="tt-fs">
            <legend>Trạng thái</legend>
            <Switch checked={form.active} onCheckedChange={(checked) => set("active", checked)} label="Hạng vé hoạt động" description="Sự kiện chỉ công bố được khi có ít nhất một hạng vé hoạt động hợp lệ." />
          </fieldset>
        )}
      </form>
    </SlideOver>
  );
}
