import { Lock, Save } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button, Field, Input, Notice, SegmentedControl, SlideOver, Switch, Textarea } from "@/components/admin/ui";
import { categoryErrorText, nextSortOrder, slugify, validateCategoryForm, type CategoryFormValues } from "@/lib/admin-category-view";
import { createAdminCategory, updateAdminCategory, type AdminCategory, type CategoryKind } from "@/services/admin-categories.service";

const EMPTY: CategoryFormValues = { name: "", slug: "", description: "", icon: "", kind: "music", isActive: true };

/** Create/edit a Category. The order is set by dragging in the list, not typed here. */
export function CategoryFormPanel({ open, onOpenChange, editing, items, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; editing: AdminCategory | null; items: AdminCategory[]; onSaved: (saved: AdminCategory, created: boolean) => void;
}) {
  const [form, setForm] = useState<CategoryFormValues>(() => editing
    ? { name: editing.name, slug: editing.slug, description: editing.description ?? "", icon: editing.icon ?? "", kind: editing.kind, isActive: editing.isActive }
    : EMPTY);
  // A new Category follows its name until the Admin types a slug of their own.
  const [slugTouched, setSlugTouched] = useState(Boolean(editing));
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const firstError = useRef<HTMLDivElement>(null);
  const slugLocked = Boolean(editing && editing.eventCount > 0);
  const others = items.filter((item) => item.id !== editing?.id);
  const errors = validateCategoryForm(form, others);
  const shown = submitted ? errors : {};

  const set = <K extends keyof CategoryFormValues>(key: K, value: CategoryFormValues[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true); setServerError("");
    if (Object.keys(errors).length) { requestAnimationFrame(() => firstError.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus()); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(), slug: slugLocked && editing ? editing.slug : form.slug.trim(), description: form.description.trim() || null,
        icon: form.icon.trim() || null, kind: form.kind, isActive: form.isActive,
      };
      const saved = editing ? await updateAdminCategory(editing.id, body) : await createAdminCategory({ ...body, sortOrder: nextSortOrder(items) });
      onSaved(saved, !editing);
    } catch (error) {
      setServerError(categoryErrorText(error, "Không lưu được danh mục."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      pending={saving}
      title={editing ? "Sửa danh mục" : "Thêm danh mục"}
      description={editing ? editing.name : "Danh mục mới được thêm vào cuối danh sách; kéo để đổi vị trí."}
      footer={<>
        <Button disabled={saving} onClick={() => onOpenChange(false)}>Hủy</Button>
        <Button variant="primary" type="submit" form="cat-form" icon={Save} loading={saving}>{editing ? "Lưu thay đổi" : "Tạo danh mục"}</Button>
      </>}
    >
      <form id="cat-form" className="cat-form" onSubmit={submit} noValidate>
        <div ref={firstError} className="cat-form-fields">
          {serverError && <Notice tone="danger" title="Không lưu được danh mục">{serverError}</Notice>}
          <Field label="Tên danh mục" required error={shown.name}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} maxLength={100} aria-describedby={describedBy} invalid={invalid} placeholder="Ví dụ: Acoustic" value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value, slug: slugTouched ? current.slug : slugify(e.target.value) }))} />
            )}
          </Field>
          <Field label="Đường dẫn (slug)" required error={shown.slug}
            hint={slugLocked ? `Đã khóa: ${editing?.eventCount} sự kiện đang dùng, trang khách lọc theo đường dẫn này.` : `Trang khách lọc theo /${form.slug || "duong-dan"}. ${editing ? "" : "Tự tạo từ tên; sửa nếu muốn."}`}>
            {({ id, describedBy, invalid }) => (
              <span className="cat-slug-input">
                <Input id={id} maxLength={100} aria-describedby={describedBy} invalid={invalid} disabled={slugLocked} value={form.slug}
                  onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} />
                {slugLocked && <Lock size={15} aria-hidden="true" />}
              </span>
            )}
          </Field>
          <div className="adm-field">
            <span className="adm-field-label" id="cat-kind-label">Loại</span>
            <SegmentedControl<CategoryKind> ariaLabel="Loại danh mục" value={form.kind} onChange={(kind) => set("kind", kind)}
              options={[{ value: "music", label: "Thể loại âm nhạc" }, { value: "other", label: "Khác" }]} />
            <p className="adm-field-hint">Sự kiện mới chỉ chọn được thể loại âm nhạc, trừ khi Cài đặt mở rộng phạm vi. Sự kiện cũ giữ nguyên danh mục.</p>
          </div>
          <Field label="Mô tả" error={shown.description}>
            {({ id, describedBy, invalid }) => <Textarea id={id} rows={3} maxLength={500} aria-describedby={describedBy} invalid={invalid} placeholder="Kiểu concert phù hợp với thể loại này…" value={form.description} onChange={(e) => set("description", e.target.value)} />}
          </Field>
          <Field label="Mã biểu tượng" hint="Tên biểu tượng Lucide, ví dụ music, guitar, headphones. Không bắt buộc." error={shown.icon}>
            {({ id, describedBy, invalid }) => <Input id={id} maxLength={50} aria-describedby={describedBy} invalid={invalid} value={form.icon} onChange={(e) => set("icon", e.target.value)} />}
          </Field>
          <Switch checked={form.isActive} onCheckedChange={(checked) => set("isActive", checked)} label="Đang hoạt động"
            description="Tắt thì không chọn được cho sự kiện mới; sự kiện đã có vẫn giữ danh mục này." />
        </div>
      </form>
    </SlideOver>
  );
}
