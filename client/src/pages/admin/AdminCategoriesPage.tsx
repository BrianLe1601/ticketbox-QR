import {
  AlertTriangle,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Edit3,
  FolderTree,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ApiRequestError } from "@/services/api";
import {
  createAdminCategory,
  deleteAdminCategory,
  listAdminCategories,
  updateAdminCategory,
  type AdminCategory,
} from "@/services/admin-categories.service";
import "@/styles/admin-categories.css";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  sortOrder: "0",
  isActive: true,
};

type StatusFilter = "all" | "active" | "inactive";
type SortOption = "order" | "name" | "events";

export function AdminCategoriesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingItem, setEditingItem] = useState<AdminCategory | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("order");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminCategories(true);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách danh mục.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void listAdminCategories(true)
      .then((data) => {
        if (active) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (active) {
          setError(e.message || "Không thể tải danh sách danh mục.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Keyboard accessibility and body scroll lock for modals
  useEffect(() => {
    if (!open && !deleteTarget) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deleteTarget) setDeleteTarget(null);
        else if (open) setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, deleteTarget]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = items.length;
    const active = items.filter((c) => c.isActive).length;
    const inactive = total - active;
    const totalEvents = items.reduce((acc, c) => acc + (c.eventCount || 0), 0);
    return { total, active, inactive, totalEvents };
  }, [items]);

  // Filtered and Sorted list
  const displayItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (statusFilter === "active" && !item.isActive) return false;
      if (statusFilter === "inactive" && item.isActive) return false;
      if (!query) return true;
      const matchName = item.name.toLowerCase().includes(query);
      const matchSlug = item.slug.toLowerCase().includes(query);
      const matchDesc = (item.description ?? "").toLowerCase().includes(query);
      return matchName || matchSlug || matchDesc;
    });

    return filtered.sort((a, b) => {
      if (sortOption === "name") {
        return a.name.localeCompare(b.name, "vi", { sensitivity: "base" });
      }
      if (sortOption === "events") {
        return (b.eventCount || 0) - (a.eventCount || 0);
      }
      return a.sortOrder - b.sortOrder;
    });
  }, [items, searchQuery, statusFilter, sortOption]);

  function handleOpenCreate() {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError("");
    setOpen(true);
  }

  function handleOpenEdit(item: AdminCategory) {
    setEditingItem(item);
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description ?? "",
      icon: item.icon ?? "",
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    });
    setFormError("");
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    const isSlugLocked = Boolean(editingItem && editingItem.eventCount > 0);

    const payload = {
      name: form.name.trim(),
      slug: isSlugLocked && editingItem ? editingItem.slug : form.slug.trim().toLowerCase(),
      description: form.description.trim() || null,
      icon: form.icon.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    try {
      if (editingItem) {
        await updateAdminCategory(editingItem.id, payload);
      } else {
        await createAdminCategory(payload);
      }
      setOpen(false);
      await loadData();
    } catch (e) {
      setFormError(e instanceof ApiRequestError ? e.message : "Không thể lưu danh mục.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    try {
      await deleteAdminCategory(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xóa danh mục.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(item: AdminCategory) {
    setTogglingId(item.id);
    setError("");
    try {
      await updateAdminCategory(item.id, { isActive: !item.isActive });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật trạng thái danh mục.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <section className="categories-page">
      {/* 1. Header Hero */}
      <header className="categories-header">
        <div>
          <span className="events-eyebrow">
            <FolderTree size={14} /> PHÂN LOẠI SỰ KIỆN
          </span>
          <h2>Quản lý danh mục</h2>
          <p>
            Cấu hình các nhóm sự kiện dùng chung toàn hệ thống, kiểm soát việc mở bán và hiển thị công khai.
          </p>
        </div>
        <button className="events-primary-button" onClick={handleOpenCreate} type="button">
          <Plus size={17} /> Tạo danh mục
        </button>
      </header>

      {/* Error alert banner */}
      {error && (
        <div className="categories-error" role="alert">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => void loadData()}>
            Thử lại
          </button>
        </div>
      )}

      {/* 2. Overview Metrics Cards (Quick Filters) */}
      <section className="categories-metrics-grid" aria-label="Thống kê và bộ lọc nhanh danh mục">
        <button
          type="button"
          className={`cat-metric-card admin-cat-metric-btn ${statusFilter === "all" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("all");
            setSearchQuery("");
          }}
          aria-pressed={statusFilter === "all"}
          aria-label="Xem tất cả danh mục"
        >
          <div className="cat-metric-top">
            <span className="cat-metric-label">Tổng danh mục</span>
            <div className="cat-metric-icon">
              <FolderTree size={16} />
            </div>
          </div>
          <strong className="cat-metric-val">{loading ? "—" : metrics.total}</strong>
          <small className="cat-metric-sub">Bấm để xem toàn bộ ({metrics.total})</small>
        </button>

        <button
          type="button"
          className={`cat-metric-card admin-cat-metric-btn ${statusFilter === "active" ? "active" : ""}`}
          onClick={() => setStatusFilter("active")}
          aria-pressed={statusFilter === "active"}
          aria-label="Lọc danh mục đang hoạt động"
        >
          <div className="cat-metric-top">
            <span className="cat-metric-label">Đang hoạt động</span>
            <div className="cat-metric-icon active">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <strong className="cat-metric-val">{loading ? "—" : metrics.active}</strong>
          <small className="cat-metric-sub">Sẵn sàng cho sự kiện mới</small>
        </button>

        <button
          type="button"
          className={`cat-metric-card admin-cat-metric-btn ${statusFilter === "inactive" ? "active" : ""}`}
          onClick={() => setStatusFilter("inactive")}
          aria-pressed={statusFilter === "inactive"}
          aria-label="Lọc danh mục đã vô hiệu hóa"
        >
          <div className="cat-metric-top">
            <span className="cat-metric-label">Đã vô hiệu hóa</span>
            <div className="cat-metric-icon inactive">
              <XCircle size={16} />
            </div>
          </div>
          <strong className="cat-metric-val">{loading ? "—" : metrics.inactive}</strong>
          <small className="cat-metric-sub">Tạm ngưng nhận sự kiện</small>
        </button>

        <article className="cat-metric-card static-info" aria-label="Tổng số sự kiện đang gắn thẻ">
          <div className="cat-metric-top">
            <span className="cat-metric-label">Sự kiện liên kết</span>
            <div className="cat-metric-icon events">
              <CalendarDays size={16} />
            </div>
          </div>
          <strong className="cat-metric-val">{loading ? "—" : metrics.totalEvents}</strong>
          <small className="cat-metric-sub">Tổng số sự kiện đang gắn thẻ</small>
        </article>
      </section>

      {/* 3. Search and Filter Toolbar */}
      <section className="categories-toolbar">
        <div className="cat-search-box">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Tìm theo tên, slug, mô tả..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{ background: "transparent", border: 0, color: "#64748b", cursor: "pointer" }}
              aria-label="Xóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="cat-toolbar-controls">
          {/* Status Tabs */}
          <div className="cat-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "all"}
              className={`cat-tab-btn ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              Tất cả ({metrics.total})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "active"}
              className={`cat-tab-btn ${statusFilter === "active" ? "active" : ""}`}
              onClick={() => setStatusFilter("active")}
            >
              Hoạt động ({metrics.active})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "inactive"}
              className={`cat-tab-btn ${statusFilter === "inactive" ? "active" : ""}`}
              onClick={() => setStatusFilter("inactive")}
            >
              Vô hiệu ({metrics.inactive})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="cat-sort-select">
            <ArrowUpDown size={14} color="#64748b" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              aria-label="Sắp xếp danh mục"
            >
              <option value="order">Thứ tự hiển thị</option>
              <option value="name">Tên danh mục (A-Z)</option>
              <option value="events">Nhiều sự kiện nhất</option>
            </select>
          </div>
        </div>
      </section>

      {/* 4. Categories Grid */}
      {loading ? (
        <div className="categories-grid" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="cat-skeleton-card" />
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="categories-empty">
          <FolderTree size={40} color="#475569" />
          <h4>Không tìm thấy danh mục phù hợp</h4>
          <h4>
            {searchQuery
              ? "Không tìm thấy danh mục phù hợp"
              : statusFilter === "inactive"
                ? "Không có danh mục đã vô hiệu hóa"
                : statusFilter === "active"
                  ? "Không có danh mục đang hoạt động"
                  : "Chưa có danh mục nào"}
          </h4>
          <p>
            {searchQuery || statusFilter !== "all"
              ? "Hãy thử điều chỉnh lại từ khóa tìm kiếm hoặc bộ lọc trạng thái."
              : "Hệ thống chưa có danh mục nào. Hãy bấm 'Tạo danh mục' để bắt đầu."}
            {searchQuery
              ? `Không tìm thấy danh mục phù hợp với từ khóa "${searchQuery}"${statusFilter !== "all" ? ` trong nhóm ${statusFilter === "active" ? "đang hoạt động" : "đã vô hiệu hóa"}` : ""}.`
              : statusFilter === "inactive"
                ? "Tất cả các danh mục trong hệ thống hiện đều đang hoạt động bình thường."
                : statusFilter === "active"
                  ? "Hiện tại tất cả danh mục đã bị vô hiệu hóa hoặc chưa được tạo."
                  : "Hệ thống chưa có danh mục nào. Hãy bấm 'Tạo danh mục' để bắt đầu."}
          </p>
          {(searchQuery || statusFilter !== "all") && (
            <button
              type="button"
              className="events-secondary-button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="categories-grid">
          {displayItems.map((item) => {
            const isSlugInUse = item.eventCount > 0;
            const isToggling = togglingId === item.id;

            return (
              <article
                className={`category-admin-card ${item.isActive ? "" : "is-inactive"}`}
                key={item.id}
              >
                <div>
                  <div className="cat-card-header">
                    <div className="cat-card-title-group">
                      <span className={`cat-badge ${item.isActive ? "active" : "inactive"}`}>
                        <span className={`cat-dot ${item.isActive ? "active" : "inactive"}`} />
                        {item.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                      </span>
                      <br />
                      <span className="cat-slug" title={`Đường dẫn slug: /${item.slug}`}>
                        /{item.slug}
                      </span>
                    </div>
                  </div>

                  <h3>{item.name}</h3>
                  <p className="cat-desc">{item.description || "Chưa có mô tả bổ sung cho danh mục này."}</p>

                  <div className="cat-meta-grid">
                    <div className="cat-meta-item">
                      <span className="cat-meta-label">Sự kiện liên kết</span>
                      <strong className="cat-meta-val">{item.eventCount} sự kiện</strong>
                    </div>
                    <div className="cat-meta-item">
                      <span className="cat-meta-label">Thứ tự hiển thị</span>
                      <strong className="cat-meta-val">#{item.sortOrder}</strong>
                    </div>
                  </div>
                </div>

                <footer>
                  {item.eventCount > 0 && (
                    <button
                      type="button"
                      className="cat-event-btn"
                      onClick={() => navigate(`/admin/events?category=${item.slug}`)}
                      title={`Xem ${item.eventCount} sự kiện thuộc danh mục này`}
                    >
                      <CalendarDays size={14} /> Sự kiện ({item.eventCount})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    title="Chỉnh sửa thông tin danh mục"
                  >
                    <Edit3 size={14} /> Sửa
                  </button>

                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => void handleToggleActive(item)}
                    title={item.isActive ? "Vô hiệu hóa danh mục này" : "Kích hoạt lại danh mục này"}
                  >
                    {isToggling ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Power size={14} />
                    )}
                    {item.isActive ? "Vô hiệu" : "Kích hoạt"}
                  </button>

                  <button
                    type="button"
                    className="danger"
                    disabled={isSlugInUse}
                    onClick={() => setDeleteTarget(item)}
                    title={
                      isSlugInUse
                        ? `Không thể xóa vì danh mục đang có ${item.eventCount} sự kiện liên kết`
                        : "Xóa vĩnh viễn danh mục"
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {/* 5. Create / Edit Dialog */}
      {open &&
        createPortal(
          <div className="events-dialog-backdrop">
            <div
              className="categories-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="category-dialog-title"
            >
              <header>
                <div>
                  <small>QUẢN LÝ DANH MỤC</small>
                  <h3 id="category-dialog-title">
                    {editingItem ? `Chỉnh sửa: ${editingItem.name}` : "Tạo danh mục mới"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Đóng cửa sổ"
                >
                  <X size={18} />
                </button>
              </header>

              <form onSubmit={handleSubmit}>
                <label>
                  Tên danh mục *
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="VD: Hội thảo Công nghệ"
                  />
                </label>

                <label>
                  Đường dẫn (slug) *
                  <input
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    value={form.slug}
                    disabled={Boolean(editingItem && editingItem.eventCount > 0)}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="VD: hoi-thao-cong-nghe"
                  />
                </label>

                {editingItem && editingItem.eventCount > 0 && (
                  <div className="cat-slug-warning wide">
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span>
                      Đường dẫn (slug) đã bị khóa vì có <strong>{editingItem.eventCount}</strong> sự kiện đang liên kết.
                      Không thể thay đổi slug để bảo đảm tính toàn vẹn của liên kết công khai.
                    </span>
                  </div>
                )}

                <label className="wide">
                  Mô tả
                  <textarea
                    maxLength={500}
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Tóm tắt ngắn gọn về thể loại sự kiện này..."
                  />
                </label>

                <label>
                  Mã biểu tượng (Lucide icon)
                  <input
                    maxLength={50}
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="music, monitor, utensils, ..."
                  />
                </label>

                <label>
                  Thứ tự hiển thị
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  />
                </label>

                <label className="category-active wide">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <span>Cho phép chọn danh mục này khi tạo sự kiện mới</span>
                </label>

                {formError && (
                  <p className="categories-error wide" role="alert">
                    {formError}
                  </p>
                )}

                <footer className="wide">
                  <button type="button" onClick={() => setOpen(false)} disabled={busy}>
                    Hủy bỏ
                  </button>
                  <button className="primary" type="submit" disabled={busy}>
                    {busy ? "Đang lưu..." : editingItem ? "Cập nhật danh mục" : "Tạo danh mục"}
                  </button>
                </footer>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* 6. Delete Confirmation Modal (Staff-confirm design) */}
      {deleteTarget &&
        createPortal(
          <div
            className="staff-confirm-backdrop"
            role="presentation"
            onMouseDown={() => setDeleteTarget(null)}
          >
            <div
              className="staff-confirm-dialog"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <header className="staff-confirm-header">
                <div>
                  <span>XÓA DANH MỤC HỆ THỐNG</span>
                  <h3>Xác nhận xóa danh mục</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="staff-confirm-body">
                <p>
                  Bạn có chắc chắn muốn xóa vĩnh viễn danh mục{" "}
                  <strong>"{deleteTarget.name}"</strong> (<code>/{deleteTarget.slug}</code>)?
                </p>
                <div className="staff-confirm-warning danger">
                  <strong>Hành động không thể hoàn tác:</strong>
                  <ul>
                    <li>Danh mục chưa có sự kiện nào liên kết mới có thể xóa an toàn.</li>
                    <li>Sau khi xóa, tên đường dẫn này có thể được dùng lại cho danh mục mới.</li>
                  </ul>
                </div>
              </div>

              <footer className="staff-confirm-footer">
                <button
                  type="button"
                  className="staff-dialog-btn secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={busy}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="staff-dialog-btn danger"
                  disabled={busy}
                  onClick={() => void handleConfirmDelete()}
                >
                  {busy ? "Đang xóa..." : "Xác nhận xóa"}
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
