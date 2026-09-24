import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit2,
  Eye,
  Filter,
  History,
  Info,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { AdminEvent } from "@/services/admin-events.service";
import {
  assignAdminStaff,
  editAdminStaff,
  formatStaffErrorMessage,
  listAdminStaff,
  listStaffAssignableEvents,
  revokeAdminStaffAssignment,
  setAdminStaffStatus,
  type AdminStaff,
} from "@/services/admin-staff.service";

type TabType = "all" | "pending" | "active" | "disabled";
type DisabledSubFilter = "all" | "inactive" | "rejected";

interface ConfirmModalData {
  type: "approve" | "reject" | "deactivate" | "reactivate" | "revokeAssignment";
  staff: AdminStaff;
  assignmentId?: number;
  assignmentEventName?: string;
}

function eventStatusLabel(status: string) {
  switch (status) {
    case "draft": return "Bản nháp";
    case "published": return "Đã công bố";
    case "ongoing": return "Đang diễn ra";
    case "completed": return "Đã kết thúc";
    case "cancelled": return "Đã hủy";
    default: return status;
  }
}

export function AdminStaffPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [assignmentReferenceTime, setAssignmentReferenceTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab === "all" || urlTab === "pending" || urlTab === "active" || urlTab === "disabled") {
      return urlTab;
    }
    return "all";
  });
  const [disabledSubFilter, setDisabledSubFilter] = useState<DisabledSubFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventFilter, setSelectedEventFilter] = useState(
    () => searchParams.get("eventId") || "",
  );

  // Selected Staff for Side Drawer
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [selectedEventToAssign, setSelectedEventToAssign] = useState("");
  const [assignErrorMsg, setAssignErrorMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<ConfirmModalData | null>(null);

  // Granular Action State
  const [busyAction, setBusyAction] = useState<{ staffId: number; action: string } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerToast(message: string, type: "success" | "error" = "success") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }

  async function loadData(showLoadingIndicator = true) {
    if (showLoadingIndicator) setLoading(true);
    setPageError("");
    try {
      const [people, availableEvents] = await Promise.all([
        listAdminStaff(),
        listStaffAssignableEvents(),
      ]);
      setStaff(people);
      setEvents(availableEvents);
      setAssignmentReferenceTime(Date.now());
    } catch (cause) {
      setPageError(
        cause instanceof Error ? cause.message : "Không thể tải dữ liệu nhân viên từ hệ thống.",
      );
    } finally {
      if (showLoadingIndicator) setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    let active = true;
    Promise.all([listAdminStaff(), listStaffAssignableEvents()])
      .then(([people, availableEvents]) => {
        if (!active) return;
        setStaff(people);
        setEvents(availableEvents);
        setAssignmentReferenceTime(Date.now());
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setPageError(
          cause instanceof Error ? cause.message : "Không thể tải dữ liệu nhân viên từ hệ thống.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Keyboard Escape listener for Drawer and Modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (confirmModal) {
          setConfirmModal(null);
        } else if (selectedStaffId !== null) {
          setSelectedStaffId(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModal, selectedStaffId]);

  function openStaffDetails(person: AdminStaff) {
    setSelectedStaffId(person.id);
    setEditedName(person.fullName);
    setIsEditingName(false);
    setSelectedEventToAssign("");
    setAssignErrorMsg(null);
  }

  // Derived metrics
  const pendingCount = useMemo(
    () => staff.filter((s) => s.approvalStatus === "pending").length,
    [staff],
  );
  const activeCount = useMemo(
    () => staff.filter((s) => s.approvalStatus === "approved" && s.isActive).length,
    [staff],
  );
  const inactiveCount = useMemo(
    () => staff.filter((s) => s.approvalStatus === "approved" && !s.isActive).length,
    [staff],
  );
  const rejectedCount = useMemo(
    () => staff.filter((s) => s.approvalStatus === "rejected").length,
    [staff],
  );
  const disabledTotal = inactiveCount + rejectedCount;

  // Selected Staff object
  const selectedStaff = useMemo(
    () => staff.find((s) => s.id === selectedStaffId) ?? null,
    [staff, selectedStaffId],
  );

  // Filtered staff list based on active tab and filters
  const filteredStaff = useMemo(() => {
    return staff.filter((person) => {
      // 1. Tab condition
      if (activeTab === "all") {
        // Show all accounts
      } else if (activeTab === "pending") {
        if (person.approvalStatus !== "pending") return false;
      } else if (activeTab === "active") {
        if (!(person.approvalStatus === "approved" && person.isActive)) return false;
      } else if (activeTab === "disabled") {
        const isInactiveApproved = person.approvalStatus === "approved" && !person.isActive;
        const isRejected = person.approvalStatus === "rejected";
        if (!isInactiveApproved && !isRejected) return false;

        if (disabledSubFilter === "inactive" && !isInactiveApproved) return false;
        if (disabledSubFilter === "rejected" && !isRejected) return false;
      }

      // 2. Search query (name or email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = person.fullName.toLowerCase().includes(q);
        const matchesEmail = person.email.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }

      // 3. Event assignment filter
      if (selectedEventFilter) {
        const eventIdNum = Number(selectedEventFilter);
        const hasActiveEvent = person.assignments.some(
          (a) => a.isActive && a.eventId === eventIdNum,
        );
        if (!hasActiveEvent) return false;
      }

      return true;
    });
  }, [staff, activeTab, disabledSubFilter, searchQuery, selectedEventFilter]);

  const selectedFilterEvent = useMemo(
    () => events.find((event) => event.id === Number(selectedEventFilter)) ?? null,
    [events, selectedEventFilter],
  );
  const selectedEventAssignmentCount = useMemo(() => {
    if (!selectedEventFilter) return 0;
    const eventId = Number(selectedEventFilter);
    return staff.filter((person) => person.assignments.some(
      (assignment) => assignment.isActive && assignment.eventId === eventId,
    )).length;
  }, [staff, selectedEventFilter]);

  function clearAllFilters() {
    setSearchQuery("");
    setSelectedEventFilter("");
  }

  // The backend applies the same rule inside the assignment transaction. Keeping
  // it here removes misleading terminal/past Events from the assignment control.
  const assignableEventsForStaff = useMemo(() => {
    if (!selectedStaff) return [];
    const activeAssignedIds = new Set(
      selectedStaff.assignments.filter((a) => a.isActive).map((a) => a.eventId),
    );
    return events.filter(
      (e) =>
        ["draft", "published", "ongoing"].includes(e.status) &&
        new Date(e.endTime).getTime() > assignmentReferenceTime &&
        !activeAssignedIds.has(e.id),
    );
  }, [selectedStaff, events, assignmentReferenceTime]);

  function isActionBusy(staffId: number, actionName?: string) {
    if (!busyAction) return false;
    if (busyAction.staffId !== staffId) return false;
    return actionName ? busyAction.action === actionName : true;
  }

  // Execute an action safely with granular busy state
  async function executeAction(
    staffId: number,
    actionName: string,
    actionFn: () => Promise<void>,
    successMessage: string,
  ) {
    setBusyAction({ staffId, action: actionName });
    try {
      await actionFn();
      await loadData(false);
      triggerToast(successMessage, "success");
      setConfirmModal(null);
    } catch (cause) {
      const formatted = formatStaffErrorMessage(cause);
      triggerToast(formatted, "error");
      if (actionName === "assign") {
        setAssignErrorMsg(formatted);
      }
    } finally {
      setBusyAction(null);
    }
  }

  // Handler for Confirm Modal Submit
  async function handleConfirmSubmit() {
    if (!confirmModal) return;
    const { type, staff: target, assignmentId } = confirmModal;

    if (type === "approve") {
      await executeAction(
        target.id,
        "approve",
        () => setAdminStaffStatus(target.id, "approve"),
        `Đã phê duyệt tài khoản Staff cho ${target.fullName}.`,
      );
    } else if (type === "reject") {
      await executeAction(
        target.id,
        "reject",
        () => setAdminStaffStatus(target.id, "reject"),
        `Đã từ chối yêu cầu của ${target.fullName}.`,
      );
    } else if (type === "deactivate") {
      await executeAction(
        target.id,
        "deactivate",
        () => setAdminStaffStatus(target.id, "deactivate"),
        `Đã vô hiệu hóa tài khoản và thu hồi phân công của ${target.fullName}.`,
      );
    } else if (type === "reactivate") {
      await executeAction(
        target.id,
        "reactivate",
        () => setAdminStaffStatus(target.id, "reactivate"),
        `Đã kích hoạt lại tài khoản Staff cho ${target.fullName}.`,
      );
    } else if (type === "revokeAssignment" && assignmentId) {
      await executeAction(
        target.id,
        "revokeAssignment",
        () => revokeAdminStaffAssignment(target.id, assignmentId),
        `Đã thu hồi phân công sự kiện của ${target.fullName}.`,
      );
    }
  }

  // Handler for Renaming Staff in Drawer
  async function handleSaveName() {
    if (!selectedStaff || !editedName.trim()) return;
    const trimmed = editedName.trim();
    if (trimmed === selectedStaff.fullName) {
      setIsEditingName(false);
      return;
    }
    setBusyAction({ staffId: selectedStaff.id, action: "editName" });
    try {
      await editAdminStaff(selectedStaff.id, trimmed);
      setStaff((prev) =>
        prev.map((item) =>
          item.id === selectedStaff.id ? { ...item, fullName: trimmed } : item,
        ),
      );
      setEditedName(trimmed);
      setIsEditingName(false);
      triggerToast("Cập nhật họ tên thành công.", "success");
    } catch (cause) {
      triggerToast(formatStaffErrorMessage(cause), "error");
    } finally {
      setBusyAction(null);
    }
  }

  // Handler for Assigning Event in Drawer
  async function handleAssignEvent() {
    if (!selectedStaff || !selectedEventToAssign) return;
    setAssignErrorMsg(null);
    const eventIdNum = Number(selectedEventToAssign);
    await executeAction(
      selectedStaff.id,
      "assign",
      async () => {
        await assignAdminStaff(selectedStaff.id, eventIdNum);
        setSelectedEventToAssign("");
      },
      "Phân công sự kiện thành công.",
    );
  }

  function formatDate(val: string | null) {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("vi-VN");
  }

  function formatDateTime(val: string | null) {
    if (!val) return "—";
    return new Date(val).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return (
    <section className="factory-module-page space-y-6">
      {/* 1. Header Hero */}
      <header className="factory-module-hero">
        <div>
          <div className="admin-live-label">
            <ShieldCheck size={14} /> KIỂM SOÁT QUYỀN NHÂN VIÊN
          </div>
          <h2>Quản lý nhân viên</h2>
          <p>Duyệt tài khoản Google, quản lý trạng thái và phân công nhân viên theo sự kiện.</p>
        </div>
        <div className="factory-module-core">
          <Users size={32} />
        </div>
      </header>

      {/* 2. Overview Metric Cards */}
      <div className="staff-metrics-grid">
        {/* Card 1: Chờ duyệt */}
        <article
          className={`staff-metric-card cursor-pointer ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveTab("pending");
            }
          }}
          aria-pressed={activeTab === "pending"}
          aria-label="Xem danh sách tài khoản chờ duyệt"
        >
          <div className="staff-metric-top">
            <span className="staff-metric-label">Chờ duyệt</span>
            <div className="staff-metric-icon text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className="staff-metric-val text-amber-300">{pendingCount}</div>
            <div className="staff-metric-sub">Đăng ký mới qua Google</div>
          </div>
        </article>

        {/* Card 2: Đang hoạt động */}
        <article
          className={`staff-metric-card cursor-pointer ${activeTab === "active" ? "active" : ""}`}
          onClick={() => setActiveTab("active")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveTab("active");
            }
          }}
          aria-pressed={activeTab === "active"}
          aria-label="Xem danh sách nhân viên đang hoạt động"
        >
          <div className="staff-metric-top">
            <span className="staff-metric-label">Đang hoạt động</span>
            <div className="staff-metric-icon text-emerald-400">
              <UserCheck size={16} />
            </div>
          </div>
          <div>
            <div className="staff-metric-val text-emerald-300">{activeCount}</div>
            <div className="staff-metric-sub">Có quyền nhận sự kiện và check-in</div>
          </div>
        </article>

        {/* Card 3: Đã ngưng quyền */}
        <article
          className={`staff-metric-card cursor-pointer ${activeTab === "disabled" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("disabled");
            setDisabledSubFilter("all");
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveTab("disabled");
              setDisabledSubFilter("all");
            }
          }}
          aria-pressed={activeTab === "disabled"}
          aria-label="Xem danh sách tài khoản đã ngưng quyền"
        >
          <div className="staff-metric-top">
            <span className="staff-metric-label">Đã ngưng quyền</span>
            <div className="staff-metric-icon text-rose-400">
              <UserX size={16} />
            </div>
          </div>
          <div>
            <div className="staff-metric-val text-slate-300">{disabledTotal}</div>
            <div className="staff-metric-sub">
              {inactiveCount} khóa · {rejectedCount} từ chối
            </div>
          </div>
        </article>

        {/* Card 4: Tổng tài khoản (Clickable) */}
        <article
          className={`staff-metric-card cursor-pointer ${activeTab === "all" ? "active total" : ""}`}
          onClick={() => {
            setActiveTab("all");
            setDisabledSubFilter("all");
            clearAllFilters();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveTab("all");
              setDisabledSubFilter("all");
              clearAllFilters();
            }
          }}
          aria-pressed={activeTab === "all"}
          aria-label="Xem tất cả tài khoản nhân viên"
        >
          <div className="staff-metric-top">
            <span className="staff-metric-label">Tổng tài khoản</span>
            <div className="staff-metric-icon text-cyan-400">
              <Users size={16} />
            </div>
          </div>
          <div>
            <div className="staff-metric-val text-cyan-300">{staff.length}</div>
            <div className="staff-metric-sub">Tất cả hồ sơ trong hệ thống</div>
          </div>
        </article>
      </div>

      {selectedEventFilter && (
        <div className={`staff-event-scope ${selectedFilterEvent ? "" : "is-missing"}`} role="status">
          <div className="staff-event-scope-icon"><Calendar size={19} /></div>
          <div className="staff-event-scope-copy">
            <span>ĐANG LỌC THEO SỰ KIỆN</span>
            <strong>{selectedFilterEvent?.name ?? `Không tìm thấy sự kiện #${selectedEventFilter}`}</strong>
            <p>
              {selectedFilterEvent
                ? `${selectedEventAssignmentCount} nhân viên đang được phân công. Danh sách bên dưới không phải toàn bộ tài khoản trong hệ thống.`
                : "Sự kiện trong liên kết không còn khả dụng. Hãy xóa bộ lọc để xem toàn bộ tài khoản."}
            </p>
          </div>
          <div className="staff-event-scope-actions">
            {selectedFilterEvent && (
              <button type="button" className="staff-action-btn" onClick={() => navigate(`/admin/events`)}>
                <Calendar size={13} /> Danh sách sự kiện
              </button>
            )}
            <button type="button" className="staff-action-btn primary" onClick={clearAllFilters}>
              <Users size={13} /> Xem tất cả nhân viên
            </button>
          </div>
        </div>
      )}

      {/* Error banner if page load fails */}
      {pageError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-rose-400 flex-shrink-0" />
            <span className="text-sm">{pageError}</span>
          </div>
          <button
            type="button"
            className="staff-action-btn"
            onClick={() => void loadData(true)}
          >
            <RefreshCw size={14} /> Thử lại
          </button>
        </div>
      )}

      {/* 3. Toolbar & Filters */}
      <div className="staff-toolbar-wrap">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="staff-search-box">
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Tìm kiếm theo họ tên hoặc email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm kiếm nhân sự"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-white"
                title="Xóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter by assigned event */}
          <div className="staff-event-filter">
            <Filter size={14} className="text-slate-400 flex-shrink-0" />
            <select
              value={selectedEventFilter}
              onChange={(e) => setSelectedEventFilter(e.target.value)}
              aria-label="Lọc theo sự kiện đang phân công"
            >
              <option value="">Không lọc theo sự kiện</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} · {event.status === "draft" ? "Bản nháp" : event.status === "published" ? "Đã công bố" : event.status === "ongoing" ? "Đang diễn ra" : event.status === "completed" ? "Đã kết thúc" : "Đã hủy"}
                </option>
              ))}
            </select>
          </div>

          {/* Clear filters button */}
          {(searchQuery || selectedEventFilter) && (
            <button
              type="button"
              className="staff-action-btn"
              onClick={clearAllFilters}
              title="Xóa tất cả bộ lọc"
            >
              <RotateCcw size={13} />
              <span>Xóa bộ lọc</span>
            </button>
          )}

          <button
            type="button"
            className="staff-action-btn"
            onClick={() => void loadData(false)}
            disabled={loading}
            title="Làm mới danh sách dữ liệu"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </button>

          <span className="text-xs font-semibold text-slate-400 ml-1">
            Hiển thị <b>{filteredStaff.length}</b> / {staff.length}
          </span>
        </div>
      </div>

      {/* 4. Tablist: Tất cả + 3 Main Tabs */}
      <div>
        <div className="staff-tabs-container" role="tablist" aria-label="Phân loại tài khoản nhân viên">
          {/* Tab 0: Tất cả */}
          <button
            type="button"
            role="tab"
            id="tab-all"
            aria-selected={activeTab === "all"}
            aria-controls="panel-all"
            className={`staff-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("all");
              setDisabledSubFilter("all");
            }}
          >
            <Users size={16} />
            <span>Tất cả</span>
            <span className="staff-tab-badge all">{staff.length}</span>
          </button>

          {/* Tab 1: Chờ Admin duyệt */}
          <button
            type="button"
            role="tab"
            id="tab-pending"
            aria-selected={activeTab === "pending"}
            aria-controls="panel-pending"
            className={`staff-tab-btn ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            <Clock size={16} />
            <span>Chờ Admin duyệt</span>
            <span className="staff-tab-badge pending">{pendingCount}</span>
          </button>

          {/* Tab 2: Staff đang hoạt động */}
          <button
            type="button"
            role="tab"
            id="tab-active"
            aria-selected={activeTab === "active"}
            aria-controls="panel-active"
            className={`staff-tab-btn ${activeTab === "active" ? "active" : ""}`}
            onClick={() => setActiveTab("active")}
          >
            <UserCheck size={16} />
            <span>Nhân viên đang hoạt động</span>
            <span className="staff-tab-badge active">{activeCount}</span>
          </button>

          {/* Tab 3: Đã ngưng quyền */}
          <button
            type="button"
            role="tab"
            id="tab-disabled"
            aria-selected={activeTab === "disabled"}
            aria-controls="panel-disabled"
            className={`staff-tab-btn ${activeTab === "disabled" ? "active" : ""}`}
            onClick={() => setActiveTab("disabled")}
          >
            <UserX size={16} />
            <span>Đã ngưng quyền</span>
            <span className="staff-tab-badge disabled">{disabledTotal}</span>
          </button>
        </div>

        {/* Sub-filter Chips for Tab 3 (Disabled / Rejected) */}
        {activeTab === "disabled" && (
          <div className="staff-subfilters" role="group" aria-label="Lọc chi tiết tài khoản ngưng quyền">
            <span className="text-xs text-slate-400 font-medium">Trạng thái:</span>
            <button
              type="button"
              className={`staff-chip ${disabledSubFilter === "all" ? "active" : ""}`}
              onClick={() => setDisabledSubFilter("all")}
            >
              Tất cả ({disabledTotal})
            </button>
            <button
              type="button"
              className={`staff-chip ${disabledSubFilter === "inactive" ? "active" : ""}`}
              onClick={() => setDisabledSubFilter("inactive")}
            >
              Đã vô hiệu hóa ({inactiveCount})
            </button>
            <button
              type="button"
              className={`staff-chip ${disabledSubFilter === "rejected" ? "active" : ""}`}
              onClick={() => setDisabledSubFilter("rejected")}
            >
              Đã từ chối ({rejectedCount})
            </button>
          </div>
        )}
      </div>

      {/* 5. Staff List View */}
      <div>
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <LoaderCircle size={32} className="animate-spin text-cyan-400" />
            <span className="text-sm font-medium">Đang tải dữ liệu nhân sự TicketBox...</span>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 rounded-2xl border border-white/10 bg-slate-900/40 text-center text-slate-400">
            <Users size={40} className="mx-auto text-slate-600 mb-3" />
            <h4 className="text-base font-semibold text-slate-300">
              {selectedEventFilter && !searchQuery
                ? "Sự kiện chưa có nhân viên được phân công"
                : "Không tìm thấy tài khoản nào"}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {selectedEventFilter && !searchQuery
                ? `${selectedFilterEvent?.name ?? "Sự kiện này"} hiện chưa có phân công đang hoạt động. ${staff.length} tài khoản nhân viên trong hệ thống vẫn được giữ nguyên; hãy xem tất cả để chọn nhân viên và tạo phân công.`
                : searchQuery
                ? "Không có nhân viên phù hợp với từ khóa và bộ lọc hiện tại."
                : activeTab === "pending"
                ? "Hiện không có tài khoản Google nào đang chờ phê duyệt."
                : activeTab === "active"
                ? "Chưa có nhân viên chính thức nào đang hoạt động."
                : activeTab === "disabled"
                ? "Không có tài khoản nào bị vô hiệu hóa hoặc từ chối."
                : "Hệ thống chưa có dữ liệu nhân sự."}
            </p>
            {(searchQuery || selectedEventFilter) && (
              <button
                type="button"
                className="staff-action-btn mt-4 inline-flex"
                onClick={clearAllFilters}
              >
                <RotateCcw size={13} /> Xem tất cả nhân viên
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="staff-table-panel hidden md:block">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Nhân sự</th>
                    <th>Trạng thái</th>
                      <th>Sự kiện đang phân công</th>
                    <th>
                      {activeTab === "pending"
                        ? "Thời điểm gửi yêu cầu"
                        : "Thời điểm duyệt / tạo"}
                    </th>
                    <th className="text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((person) => {
                    const activeAssignments = person.assignments.filter((a) => a.isActive);
                    const nearestAssignment = activeAssignments[0];

                    return (
                      <tr key={person.id}>
                        {/* Column 1: Staff Info */}
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="staff-avatar-initials">
                              {getInitials(person.fullName)}
                            </div>
                            <div className="staff-name-col">
                              <strong>{person.fullName}</strong>
                              <span>{person.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Status Badge (Always Accurate) */}
                        <td>
                          {person.approvalStatus === "pending" ? (
                            <span className="staff-status-badge pending">
                              <Clock size={12} /> Chờ duyệt
                            </span>
                          ) : person.approvalStatus === "rejected" ? (
                            <span className="staff-status-badge rejected">
                              <UserX size={12} /> Đã từ chối
                            </span>
                          ) : person.isActive ? (
                            <span className="staff-status-badge active">
                              <CheckCircle2 size={12} /> Đang hoạt động
                            </span>
                          ) : (
                            <span className="staff-status-badge inactive">
                              <UserX size={12} /> Đã vô hiệu hóa
                            </span>
                          )}
                        </td>

                        {/* Column 3: Assigned Events */}
                        <td>
                          {person.approvalStatus === "pending" ? (
                            <span className="text-xs text-slate-500 italic">
                              Chưa được phân công
                            </span>
                          ) : activeAssignments.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-semibold">
                                <MapPin size={13} className="flex-shrink-0 text-cyan-400" />
                                <span className="truncate max-w-[200px]" title={nearestAssignment.eventName}>
                                  {nearestAssignment.eventName}
                                </span>
                              </div>
                              {activeAssignments.length > 1 && (
                                <span className="text-[11px] text-slate-400">
                                  + {activeAssignments.length - 1} sự kiện khác
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">Chưa gán sự kiện</span>
                          )}
                        </td>

                        {/* Column 4: Dates */}
                        <td>
                          <div className="text-xs text-slate-300 flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-400" />
                            <span>
                              {person.approvalStatus === "pending"
                                ? formatDateTime(person.createdAt)
                                : person.reviewedAt
                                ? formatDate(person.reviewedAt)
                                : formatDate(person.createdAt)}
                            </span>
                          </div>
                        </td>

                        {/* Column 5: Actions */}
                        <td>
                          <div className="staff-actions-cell">
                            {/* Actions for PENDING */}
                            {person.approvalStatus === "pending" && (
                              <>
                                <button
                                  type="button"
                                  className="staff-action-btn success"
                                  onClick={() =>
                                    setConfirmModal({ type: "approve", staff: person })
                                  }
                                  disabled={isActionBusy(person.id)}
                                >
                                  <UserCheck size={14} /> Duyệt làm nhân viên
                                </button>
                                <button
                                  type="button"
                                  className="staff-action-btn danger"
                                  onClick={() =>
                                    setConfirmModal({ type: "reject", staff: person })
                                  }
                                  disabled={isActionBusy(person.id)}
                                >
                                  <X size={14} /> Từ chối
                                </button>
                              </>
                            )}

                            {/* Actions for ACTIVE */}
                            {person.approvalStatus === "approved" && person.isActive && (
                              <>
                                <button
                                  type="button"
                                  className="staff-action-btn primary"
                                  onClick={() => openStaffDetails(person)}
                                >
                                  <Eye size={14} /> Xem chi tiết
                                </button>
                                <button
                                  type="button"
                                  className="staff-action-btn"
                                  onClick={() => openStaffDetails(person)}
                                  title="Gán sự kiện cho nhân sự này"
                                >
                                  <Plus size={14} /> Gán sự kiện
                                </button>
                                <button
                                  type="button"
                                  className="staff-action-btn danger"
                                  onClick={() =>
                                    setConfirmModal({ type: "deactivate", staff: person })
                                  }
                                  disabled={isActionBusy(person.id)}
                                  title="Vô hiệu hóa quyền và thu hồi phân công"
                                >
                                  <UserX size={14} />
                                </button>
                              </>
                            )}

                            {/* Actions for DISABLED / REJECTED */}
                            {(person.approvalStatus === "rejected" ||
                              (person.approvalStatus === "approved" && !person.isActive)) && (
                              <>
                                <button
                                  type="button"
                                  className="staff-action-btn"
                                  onClick={() => openStaffDetails(person)}
                                >
                                  <Eye size={14} /> Xem lịch sử
                                </button>
                                {person.approvalStatus === "rejected" ? (
                                  <button
                                    type="button"
                                    className="staff-action-btn success"
                                    onClick={() =>
                                      setConfirmModal({ type: "approve", staff: person })
                                    }
                                    disabled={isActionBusy(person.id)}
                                  >
                                    <UserCheck size={14} /> Duyệt lại
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="staff-action-btn primary"
                                    onClick={() =>
                                      setConfirmModal({ type: "reactivate", staff: person })
                                    }
                                    disabled={isActionBusy(person.id)}
                                  >
                                    <RotateCcw size={14} /> Kích hoạt lại
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Compact Cards View */}
            <div className="staff-mobile-cards md:hidden space-y-3">
              {filteredStaff.map((person) => {
                const activeAssignments = person.assignments.filter((a) => a.isActive);

                return (
                  <article key={person.id} className="staff-compact-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="staff-avatar-initials">
                          {getInitials(person.fullName)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-100 text-sm">
                            {person.fullName}
                          </h4>
                          <p className="text-xs text-slate-400">{person.email}</p>
                        </div>
                      </div>

                      {/* Status */}
                      {person.approvalStatus === "pending" ? (
                        <span className="staff-status-badge pending">Chờ duyệt</span>
                      ) : person.approvalStatus === "rejected" ? (
                        <span className="staff-status-badge rejected">Đã từ chối</span>
                      ) : person.isActive ? (
                        <span className="staff-status-badge active">Hoạt động</span>
                      ) : (
                        <span className="staff-status-badge inactive">Vô hiệu hóa</span>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="text-xs text-slate-400 flex flex-wrap gap-4 py-2 border-y border-white/5">
                      <div>
                        Sự kiện:{" "}
                        <b className="text-slate-200">
                          {activeAssignments.length > 0
                            ? `${activeAssignments.length} sự kiện`
                            : "Chưa gán"}
                        </b>
                      </div>
                      <div>
                        Ngày:{" "}
                        <b className="text-slate-200">
                          {person.reviewedAt ? formatDate(person.reviewedAt) : formatDate(person.createdAt)}
                        </b>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {person.approvalStatus === "pending" ? (
                        <>
                          <button
                            type="button"
                            className="staff-action-btn success flex-1"
                            onClick={() =>
                              setConfirmModal({ type: "approve", staff: person })
                            }
                            disabled={isActionBusy(person.id)}
                          >
                            <UserCheck size={14} /> Duyệt làm nhân viên
                          </button>
                          <button
                            type="button"
                            className="staff-action-btn danger flex-1"
                            onClick={() =>
                              setConfirmModal({ type: "reject", staff: person })
                            }
                            disabled={isActionBusy(person.id)}
                          >
                            <X size={14} /> Từ chối
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="staff-action-btn primary flex-1"
                            onClick={() => openStaffDetails(person)}
                          >
                            <Eye size={14} /> Xem chi tiết &amp; Phân công
                          </button>
                          {person.approvalStatus === "approved" && person.isActive ? (
                            <button
                              type="button"
                              className="staff-action-btn danger"
                              onClick={() =>
                                setConfirmModal({ type: "deactivate", staff: person })
                              }
                              disabled={isActionBusy(person.id)}
                            >
                              <UserX size={14} /> Khóa
                            </button>
                          ) : person.approvalStatus === "rejected" ? (
                            <button
                              type="button"
                              className="staff-action-btn success"
                              onClick={() =>
                                setConfirmModal({ type: "approve", staff: person })
                              }
                              disabled={isActionBusy(person.id)}
                            >
                              Duyệt lại
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="staff-action-btn primary"
                              onClick={() =>
                                setConfirmModal({ type: "reactivate", staff: person })
                              }
                              disabled={isActionBusy(person.id)}
                            >
                              Kích hoạt
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 6. Side Drawer for Staff Details & Event Assignments */}
      {selectedStaff &&
        createPortal(
          <div
            className="staff-drawer-backdrop"
            role="presentation"
            onMouseDown={() => setSelectedStaffId(null)}
          >
            <div
              className="staff-drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="staff-drawer-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="staff-drawer-header">
                <div className="flex items-center gap-3">
                  <div className="staff-avatar-initials">
                    {getInitials(selectedStaff.fullName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 id="staff-drawer-title" className="text-base font-bold text-slate-100">
                        {selectedStaff.fullName}
                      </h3>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                        #{selectedStaff.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{selectedStaff.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg border border-white/10 hover:border-white/30 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  onClick={() => setSelectedStaffId(null)}
                  aria-label="Đóng bảng chi tiết"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="staff-drawer-body">
                {/* Section A: Account Info */}
                <div className="staff-drawer-section">
                  <div className="staff-drawer-section-title">
                    <span className="flex items-center gap-1.5">
                      <Users size={15} /> THÔNG TIN TÀI KHOẢN
                    </span>
                    {!isEditingName && (
                      <button
                        type="button"
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                        onClick={() => setIsEditingName(true)}
                      >
                        <Edit2 size={12} /> Sửa họ tên
                      </button>
                    )}
                  </div>

                  {/* Inline Name Editing Form */}
                  {isEditingName ? (
                    <div className="mb-4 p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/30 space-y-2">
                      <label className="block text-xs font-semibold text-cyan-300">
                        Họ và tên nhân sự:
                      </label>
                      <input
                        type="text"
                        className="w-full h-9 px-3 rounded-lg border border-cyan-500/40 bg-slate-900 text-white text-xs outline-none focus:border-cyan-400"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Nhập họ và tên mới..."
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          className="staff-action-btn text-xs py-1 px-2.5"
                          onClick={() => {
                            setEditedName(selectedStaff.fullName);
                            setIsEditingName(false);
                          }}
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="staff-action-btn primary text-xs py-1 px-3"
                          disabled={!editedName.trim() || isActionBusy(selectedStaff.id, "editName")}
                          onClick={() => void handleSaveName()}
                        >
                          {isActionBusy(selectedStaff.id, "editName") ? (
                            <LoaderCircle size={13} className="animate-spin" />
                          ) : (
                            <Check size={13} />
                          )}
                          <span>Lưu tên</span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Trạng thái phê duyệt:</span>
                      {selectedStaff.approvalStatus === "approved" ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={13} /> Đã phê duyệt
                        </span>
                      ) : selectedStaff.approvalStatus === "rejected" ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <X size={13} /> Đã từ chối
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <Clock size={13} /> Chờ quản trị viên duyệt
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Quyền truy cập:</span>
                      {selectedStaff.isActive ? (
                        <span className="text-emerald-400 font-semibold">Đang hoạt động</span>
                      ) : (
                        <span className="text-rose-400 font-semibold">Đã bị vô hiệu hóa</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Ngày gửi yêu cầu:</span>
                      <span className="text-slate-200">{formatDateTime(selectedStaff.createdAt)}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Ngày quản trị viên duyệt:</span>
                      <span className="text-slate-200">{formatDateTime(selectedStaff.reviewedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Section B: Active Event Assignments */}
                <div className="staff-drawer-section">
                  <div className="staff-drawer-section-title">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={15} /> SỰ KIỆN ĐANG PHÂN CÔNG (
                      {selectedStaff.assignments.filter((a) => a.isActive).length})
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {selectedStaff.assignments.filter((a) => a.isActive).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        Hiện tại nhân sự này chưa được phân công vào sự kiện nào.
                      </p>
                    ) : (
                      selectedStaff.assignments
                        .filter((a) => a.isActive)
                        .map((assignment) => (
                          <div
                            key={assignment.id}
                            className="p-3 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="font-bold text-slate-100 text-xs">
                                  {assignment.eventName}
                                </h5>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                  <Clock size={12} className="text-cyan-400" />
                                  <span>
                                    {formatDateTime(assignment.startTime)} →{" "}
                                    {formatDateTime(assignment.endTime)}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 uppercase">
                                {eventStatusLabel(assignment.eventStatus)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-slate-400">
                              <span>Phân công: {formatDate(assignment.assignedAt)}</span>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 text-xs"
                                  onClick={() => navigate(`/admin/ticket-types?eventId=${assignment.eventId}`)}
                                  title="Xem và quản lý các loại vé của sự kiện này"
                                >
                                  <Ticket size={12} /> Quản lý vé
                                </button>
                                <button
                                  type="button"
                                  className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 text-xs"
                                  onClick={() =>
                                    setConfirmModal({
                                      type: "revokeAssignment",
                                      staff: selectedStaff,
                                      assignmentId: assignment.id,
                                      assignmentEventName: assignment.eventName,
                                    })
                                  }
                                >
                                  <Trash2 size={12} /> Gỡ phân công
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Section C: Assign New Event (Only for Approved & Active Staff) */}
                {selectedStaff.approvalStatus === "approved" && selectedStaff.isActive && (
                  <div className="staff-drawer-section">
                    <div className="staff-drawer-section-title">
                      <span className="flex items-center gap-1.5">
                        <Plus size={15} /> GÁN VÀO SỰ KIỆN MỚI
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Chọn sự kiện để phân công:
                        </label>
                        <select
                          className="w-full h-10 px-3 rounded-xl border border-white/10 bg-slate-900 text-slate-200 text-xs outline-none focus:border-cyan-400"
                          value={selectedEventToAssign}
                          onChange={(e) => {
                            setSelectedEventToAssign(e.target.value);
                            setAssignErrorMsg(null);
                          }}
                          aria-label="Chọn sự kiện để phân công"
                        >
                          <option value="">-- Chọn sự kiện có thể phân công --</option>
                          {assignableEventsForStaff.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.name} [{eventStatusLabel(event.status)}] ({formatDateTime(event.startTime)} - {formatDateTime(event.endTime)})
                            </option>
                          ))}
                        </select>
                        {assignableEventsForStaff.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic mt-1">
                            Không có sự kiện mở nào khả dụng hoặc nhân sự đã được phân công tất cả các sự kiện hiện có.
                          </p>
                        )}
                      </div>

                      {/* Inline Error Message for Schedule Conflict, Duplicate Assignment, etc. */}
                      {assignErrorMsg && (
                        <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-950/60 text-rose-300 text-xs flex items-start gap-2">
                          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-rose-400" />
                          <span>{assignErrorMsg}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        className="staff-action-btn primary w-full justify-center py-2.5"
                        disabled={
                          !selectedEventToAssign || isActionBusy(selectedStaff.id, "assign")
                        }
                        onClick={() => void handleAssignEvent()}
                      >
                        {isActionBusy(selectedStaff.id, "assign") ? (
                          <>
                            <LoaderCircle size={14} className="animate-spin" />
                            <span>Đang kiểm tra lịch &amp; phân công...</span>
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>Xác nhận phân công</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Section D: Assignment History (Revoked) */}
                <div className="staff-drawer-section">
                  <div
                    className="staff-drawer-section-title cursor-pointer select-none"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <span className="flex items-center gap-1.5">
                      <History size={15} /> LỊCH SỬ PHÂN CÔNG (
                      {selectedStaff.assignments.filter((a) => !a.isActive).length})
                    </span>
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-200"
                      aria-label="Thu gọn hoặc mở rộng lịch sử phân công"
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${
                          showHistory ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>

                  {showHistory && (
                    <div className="space-y-2 mt-2">
                      {selectedStaff.assignments.filter((a) => !a.isActive).length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          Chưa có phân công nào bị thu hồi trước đây.
                        </p>
                      ) : (
                        selectedStaff.assignments
                          .filter((a) => !a.isActive)
                          .map((assignment) => (
                            <div
                              key={assignment.id}
                              className="p-2.5 rounded-lg bg-white/5 text-xs flex flex-col gap-1 text-slate-300"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-200">
                                  {assignment.eventName}
                                </span>
                                <span className="text-[10px] text-rose-400 border border-rose-500/30 bg-rose-950/40 px-1.5 py-0.5 rounded">
                                  Đã thu hồi
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex flex-wrap gap-3">
                                <span>Phân công: {formatDate(assignment.assignedAt)}</span>
                                {assignment.revokedAt && (
                                  <span>Thu hồi: {formatDateTime(assignment.revokedAt)}</span>
                                )}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 7. Action Confirmation Modals (Dedicated compact responsive dialog) */}
      {confirmModal &&
        createPortal(
          <div
            className="staff-confirm-backdrop"
            role="presentation"
            onMouseDown={() => setConfirmModal(null)}
          >
            <div
              className="staff-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-modal-title"
              aria-describedby="confirm-modal-desc"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="staff-confirm-header">
                <div className="flex items-center gap-2.5">
                  {confirmModal.type === "deactivate" ||
                  confirmModal.type === "reject" ||
                  confirmModal.type === "revokeAssignment" ? (
                    <AlertTriangle size={18} className="text-rose-400" />
                  ) : confirmModal.type === "approve" ? (
                    <UserCheck size={18} className="text-emerald-400" />
                  ) : (
                    <RotateCcw size={18} className="text-cyan-400" />
                  )}
                  <h3 id="confirm-modal-title">
                    {confirmModal.type === "approve"
                      ? "Xác nhận duyệt tài khoản nhân viên"
                      : confirmModal.type === "reject"
                      ? "Xác nhận từ chối yêu cầu"
                      : confirmModal.type === "deactivate"
                      ? "Cảnh báo vô hiệu hóa tài khoản"
                      : confirmModal.type === "reactivate"
                      ? "Kích hoạt lại tài khoản nhân viên"
                      : "Xác nhận gỡ phân công sự kiện"}
                  </h3>
                </div>
                <button
                  type="button"
                  className="w-7 h-7 rounded-lg border border-white/10 hover:border-white/30 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  onClick={() => setConfirmModal(null)}
                  aria-label="Đóng hộp thoại"
                >
                  <X size={15} />
                </button>
              </div>

              <div id="confirm-modal-desc" className="staff-confirm-body">
                {confirmModal.type === "approve" && (
                  <>
                    <p>
                      Bạn đang chuẩn bị phê duyệt tài khoản nhân viên cho:{" "}
                      <strong className="text-white">{confirmModal.staff.fullName}</strong> (
                      {confirmModal.staff.email}).
                    </p>
                    <div className="staff-confirm-warning info flex items-start gap-2">
                      <Info size={15} className="flex-shrink-0 mt-0.5 text-cyan-400" />
                      <span>
                        Tài khoản sẽ được kích hoạt quyền nhân viên chính thức. Phê duyệt chưa tự động gán
                        sự kiện; bạn có thể phân công sau khi duyệt.
                      </span>
                    </div>
                  </>
                )}

                {confirmModal.type === "reject" && (
                  <>
                    <p>
                      Bạn có chắc chắn muốn từ chối yêu cầu đăng ký nhân viên của{" "}
                      <strong className="text-white">{confirmModal.staff.fullName}</strong> (
                      {confirmModal.staff.email})?
                    </p>
                    <div className="staff-confirm-warning danger flex items-start gap-2">
                      <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-rose-400" />
                      <span>
                        Tài khoản sẽ chuyển sang mục <b>Đã ngưng quyền</b> với trạng thái <b>Đã từ chối</b>. Bạn vẫn có thể xem xét duyệt lại sau này.
                      </span>
                    </div>
                  </>
                )}

                {confirmModal.type === "deactivate" && (
                  <>
                    <p>
                      Bạn sắp vô hiệu hóa quyền truy cập của nhân sự:{" "}
                      <strong className="text-white">{confirmModal.staff.fullName}</strong>.
                    </p>
                    <div className="staff-confirm-warning danger space-y-1.5">
                      <p className="font-semibold text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle size={14} /> Cảnh báo quan trọng:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-200">
                        <li>Mọi phân công sự kiện đang hoạt động sẽ bị thu hồi ngay lập tức.</li>
                        <li>Toàn bộ phiên làm việc của tài khoản này sẽ bị hủy bỏ.</li>
                        <li>Nhân viên không thể đăng nhập hoặc thực hiện check-in tại cổng.</li>
                        <li>Lịch sử quét và phân công cũ vẫn được lưu trữ đầy đủ để phục vụ kiểm toán.</li>
                      </ul>
                    </div>
                  </>
                )}

                {confirmModal.type === "reactivate" && (
                  <>
                    <p>
                      Kích hoạt lại quyền hoạt động cho nhân sự:{" "}
                      <strong className="text-white">{confirmModal.staff.fullName}</strong>.
                    </p>
                    <div className="staff-confirm-warning info flex items-start gap-2">
                      <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5 text-emerald-400" />
                      <span>
                        Nhân viên có thể đăng nhập lại hệ thống. Lưu ý: các phân công cũ không tự phục hồi, bạn có thể gán sự kiện mới sau khi kích hoạt.
                      </span>
                    </div>
                  </>
                )}

                {confirmModal.type === "revokeAssignment" && (
                  <>
                    <p>
                      Bạn có chắc muốn gỡ phân công sự kiện{" "}
                      <strong className="text-white">{confirmModal.assignmentEventName}</strong> khỏi nhân sự{" "}
                      <strong className="text-white">{confirmModal.staff.fullName}</strong>?
                    </p>
                    <div className="staff-confirm-warning danger flex items-start gap-2">
                      <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-rose-400" />
                      <span>
                        Phân công sẽ chuyển vào lịch sử thu hồi và nhân viên mất quyền check-in tại sự kiện này.
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="staff-confirm-footer">
                <button
                  type="button"
                  className="staff-action-btn"
                  onClick={() => setConfirmModal(null)}
                  disabled={Boolean(busyAction)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className={`staff-action-btn ${
                    confirmModal.type === "deactivate" ||
                    confirmModal.type === "reject" ||
                    confirmModal.type === "revokeAssignment"
                      ? "danger"
                      : "primary"
                  }`}
                  onClick={() => void handleConfirmSubmit()}
                  disabled={Boolean(busyAction)}
                >
                  {busyAction ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin mr-1.5" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : confirmModal.type === "approve" ? (
                    <>
                      <UserCheck size={14} className="mr-1" />
                      <span>Xác nhận duyệt</span>
                    </>
                  ) : confirmModal.type === "reject" ? (
                    <>
                      <UserX size={14} className="mr-1" />
                      <span>Từ chối yêu cầu</span>
                    </>
                  ) : confirmModal.type === "deactivate" ? (
                    <>
                      <AlertTriangle size={14} className="mr-1" />
                      <span>Vô hiệu hóa và thu hồi quyền</span>
                    </>
                  ) : confirmModal.type === "reactivate" ? (
                    <>
                      <RotateCcw size={14} className="mr-1" />
                      <span>Kích hoạt tài khoản</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} className="mr-1" />
                      <span>Xác nhận gỡ phân công</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 8. Floating Toast Notification */}
      {toast && (
        <div className={`staff-toast ${toast.type}`} role="status">
          {toast.type === "success" ? (
            <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-300" />
          ) : (
            <ShieldAlert size={18} className="flex-shrink-0 text-rose-300" />
          )}
          <span className="flex-1 text-xs">{toast.message}</span>
          <button
            type="button"
            className="text-white/60 hover:text-white"
            onClick={() => setToast(null)}
            aria-label="Đóng thông báo"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
