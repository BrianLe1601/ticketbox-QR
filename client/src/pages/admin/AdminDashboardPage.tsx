import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Radio,
  RefreshCw,
  ShieldAlert,
  Ticket,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import {
  getAdminDashboardSummary,
  type DashboardSummary,
} from "@/services/admin-dashboard.service";

function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

function formatDateTimeShort(isoStr: string | null): string {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSummary(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await getAdminDashboardSummary();
      setSummary(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể kết nối đến máy chủ để lấy số liệu tổng quan.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    void getAdminDashboardSummary()
      .then((data) => {
        if (active) {
          setSummary(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(
            err.message || "Không thể kết nối đến máy chủ để lấy số liệu tổng quan.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const hasAlerts =
    summary &&
    (summary.alerts.unstaffedUpcomingEvents.length > 0 ||
      summary.alerts.scheduledPublishFailedEvents.length > 0 ||
      summary.staff.pendingApproval > 0 ||
      summary.refunds.pendingCount > 0);

  return (
    <div className="admin-dashboard">
      {/* 1. Welcome & System Header */}
      <section className="admin-welcome">
        <div>
          <div className="admin-live-label">
            <Radio size={13} /> ĐIỀU HÀNH TRỰC TIẾP
          </div>
          <h2>Xin chào, {user?.fullName || "Quản trị viên"}</h2>
          <p>
            Trung tâm kiểm soát vận hành TicketBoxQR. Giám sát sự kiện thời gian thực,
            đáp ứng vé vào cổng và phối hợp nhân sự tại chỗ.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="button"
            className="events-secondary-button"
            onClick={() => void loadSummary(true)}
            disabled={loading || refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              background: "rgba(6, 21, 40, 0.7)",
              color: "#38bdf8",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Đang đồng bộ..." : "Đồng bộ lại"}</span>
          </button>

          <div className="admin-clock">
            <span>SYS.TIME (VN)</span>
            <strong>
              {new Date().toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              - {new Date().toLocaleDateString("vi-VN")}
            </strong>
          </div>
        </div>
      </section>

      {/* Error Banner */}
      {error && (
        <div className="categories-error" role="alert" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => void loadSummary(false)}>
            Thử lại
          </button>
        </div>
      )}

      {/* 2. Key Operational Metrics (4 main cards) */}
      <section className="admin-stat-grid" aria-label="Chỉ số hoạt động chính">
        {/* Card 1: Active Events */}
        <article
          className="admin-stat-card cyan"
          onClick={() => navigate("/admin/events")}
          style={{ cursor: "pointer" }}
          title="Bấm để xem danh sách sự kiện"
        >
          <div className="admin-stat-icon">
            <CalendarDays size={21} />
          </div>
          <div>
            <span>Sự kiện đang hoạt động</span>
            <strong>{loading ? "..." : summary?.events.active ?? 0}</strong>
            <small>
              {loading
                ? "Đang tải dữ liệu..."
                : `${summary?.events.draft ?? 0} nháp, ${summary?.events.scheduled ?? 0} hẹn giờ`}
            </small>
          </div>
          <TrendingUp className="admin-stat-signal" size={18} />
        </article>

        {/* Card 2: Issued Tickets */}
        <article
          className="admin-stat-card violet"
          onClick={() => navigate("/admin/ticket-types")}
          style={{ cursor: "pointer" }}
          title="Bấm để quản lý các hạng vé"
        >
          <div className="admin-stat-icon">
            <Ticket size={21} />
          </div>
          <div>
            <span>Vé đã phát hành</span>
            <strong>{loading ? "..." : summary?.tickets.issued ?? 0}</strong>
            <small>
              {loading
                ? "Đang tải dữ liệu..."
                : `${summary?.orders.confirmed ?? 0} đơn hàng thành công`}
            </small>
          </div>
          <TrendingUp className="admin-stat-signal" size={18} />
        </article>

        {/* Card 3: Today Checkins */}
        <article
          className="admin-stat-card green"
          onClick={() => navigate("/admin/checkins")}
          style={{ cursor: "pointer" }}
          title="Bấm để xem nhật ký check-in"
        >
          <div className="admin-stat-icon">
            <CheckCircle2 size={21} />
          </div>
          <div>
            <span>Check-in thành công</span>
            <strong>{loading ? "..." : summary?.checkins.todaySuccess ?? 0}</strong>
            <small>{loading ? "Đang tải dữ liệu..." : "Lượt quét hợp lệ hôm nay"}</small>
          </div>
          <TrendingUp className="admin-stat-signal" size={18} />
        </article>

        {/* Card 4: Staff On Duty */}
        <article
          className="admin-stat-card amber"
          onClick={() => navigate("/admin/staff")}
          style={{ cursor: "pointer" }}
          title="Bấm để quản lý nhân sự & phân công"
        >
          <div className="admin-stat-icon">
            <Users size={21} />
          </div>
          <div>
            <span>Nhân sự trực cổng</span>
            <strong>{loading ? "..." : summary?.staff.activeOnDuty ?? 0}</strong>
            <small>
              {loading
                ? "Đang tải dữ liệu..."
                : summary?.staff.pendingApproval
                  ? `${summary.staff.pendingApproval} tài khoản chờ duyệt`
                  : "Đang được phân công sự kiện"}
            </small>
          </div>
          <TrendingUp className="admin-stat-signal" size={18} />
        </article>
      </section>

      {/* 3. Secondary Metrics: Financial & Orders Overview */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginTop: "16px",
        }}
        aria-label="Tài chính và giao dịch"
      >
        <div
          style={{
            padding: "16px 18px",
            borderRadius: "14px",
            border: "1px solid rgba(120, 174, 215, 0.16)",
            background:
              "linear-gradient(135deg, rgba(4, 18, 36, 0.75), rgba(2, 10, 22, 0.65))",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              color: "#34d399",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <DollarSign size={20} />
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "#7a93a8", fontWeight: 700 }}>
              TỔNG DOANH THU ĐÃ THU
            </span>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#f1fbff",
                marginTop: "2px",
              }}
            >
              {loading ? "..." : formatVND(summary?.orders.totalRevenue ?? 0)}
            </div>
            <small style={{ fontSize: "10.5px", color: "#64748b" }}>
              Từ {summary?.orders.confirmed ?? 0} đơn hàng thành công
            </small>
          </div>
        </div>

        <div
          style={{
            padding: "16px 18px",
            borderRadius: "14px",
            border: "1px solid rgba(120, 174, 215, 0.16)",
            background:
              "linear-gradient(135deg, rgba(4, 18, 36, 0.75), rgba(2, 10, 22, 0.65))",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              color: "#38bdf8",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <CreditCard size={20} />
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "#7a93a8", fontWeight: 700 }}>
              ĐƠN HÀNG CHỜ THANH TOÁN
            </span>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#f1fbff",
                marginTop: "2px",
              }}
            >
              {loading ? "..." : `${summary?.orders.pending ?? 0} đơn`}
            </div>
            <small style={{ fontSize: "10.5px", color: "#64748b" }}>
              Đang giữ chỗ vé trong phiên
            </small>
          </div>
        </div>

        <div
          style={{
            padding: "16px 18px",
            borderRadius: "14px",
            border: "1px solid rgba(120, 174, 215, 0.16)",
            background:
              "linear-gradient(135deg, rgba(4, 18, 36, 0.75), rgba(2, 10, 22, 0.65))",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "rgba(244, 63, 94, 0.12)",
              border: "1px solid rgba(244, 63, 94, 0.25)",
              color: "#fb7185",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={20} />
          </div>
          <div>
            <span style={{ fontSize: "11px", color: "#7a93a8", fontWeight: 700 }}>
              HOÀN TIỀN CHỜ XỬ LÝ
            </span>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#f1fbff",
                marginTop: "2px",
              }}
            >
              {loading ? "..." : `${summary?.refunds.pendingCount ?? 0} yêu cầu`}
            </div>
            <small style={{ fontSize: "10.5px", color: "#64748b" }}>
              Giá trị: {formatVND(summary?.refunds.pendingAmount ?? 0)}
            </small>
          </div>
        </div>
      </section>

      {/* 4. Operational Alerts & Warnings (if any) */}
      {hasAlerts && (
        <section
          style={{
            marginTop: "18px",
            padding: "18px 20px",
            borderRadius: "16px",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            background: "linear-gradient(135deg, rgba(29, 21, 6, 0.8), rgba(18, 13, 3, 0.9))",
          }}
          aria-label="Cảnh báo vận hành cần xử lý"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "14px",
              color: "#fbbf24",
            }}
          >
            <AlertTriangle size={20} />
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#fef08a" }}>
              CẢNH BÁO VẬN HÀNH CẦN QUẢN TRỊ VIÊN XỬ LÝ
            </h3>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {/* Unstaffed Upcoming Events */}
            {summary.alerts.unstaffedUpcomingEvents.map((evt) => (
              <div
                key={evt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                  fontSize: "12.5px",
                }}
              >
                <div>
                  <strong style={{ color: "#fef08a" }}>{evt.name}</strong>
                  <span style={{ color: "#a89060", marginLeft: "10px" }}>
                    Bắt đầu: {formatDateTimeShort(evt.startTime)} — Chưa có nhân viên trực cổng!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/admin/staff")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    background: "rgba(245, 158, 11, 0.2)",
                    color: "#fef08a",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Phân công ngay <ArrowRight size={12} />
                </button>
              </div>
            ))}

            {/* Scheduled Publish Failures */}
            {summary.alerts.scheduledPublishFailedEvents.map((evt) => (
              <div
                key={evt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid rgba(244, 63, 94, 0.25)",
                  fontSize: "12.5px",
                }}
              >
                <div>
                  <strong style={{ color: "#fca5a5" }}>{evt.name}</strong>
                  <span style={{ color: "#f87171", marginLeft: "10px" }}>
                    Lỗi hẹn giờ công bố: {evt.publishFailureReason}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/admin/events")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(244, 63, 94, 0.4)",
                    background: "rgba(244, 63, 94, 0.2)",
                    color: "#fee2e2",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Xem sự kiện <ArrowRight size={12} />
                </button>
              </div>
            ))}

            {/* Pending Staff Approval */}
            {summary.staff.pendingApproval > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "rgba(56, 189, 248, 0.1)",
                  border: "1px solid rgba(56, 189, 248, 0.2)",
                  fontSize: "12.5px",
                }}
              >
                <div>
                  <strong style={{ color: "#7dd3fc" }}>Nhân sự Google mới:</strong>
                  <span style={{ color: "#93c5fd", marginLeft: "10px" }}>
                    Có {summary.staff.pendingApproval} tài khoản nhân viên đang chờ duyệt quyền truy cập cổng.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/admin/staff")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    background: "rgba(56, 189, 248, 0.2)",
                    color: "#e0f2fe",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Duyệt ngay <UserCheck size={12} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. Control Center & Quick Actions */}
      <section className="admin-panel-grid">
        {/* System Health Radar Panel */}
        <article className="admin-command-panel">
          <div className="admin-panel-heading">
            <div>
              <span>VẬN HÀNH HỆ THỐNG</span>
              <h3>Trạng thái dịch vụ nền tảng</h3>
            </div>
            <Activity size={20} />
          </div>

          <div className="admin-robot-console">
            <div className="admin-radar">
              <span className="admin-radar-sweep" />
              <div className="admin-robot-core">
                <Bot size={48} />
              </div>
            </div>

            <div className="admin-system-list">
              <div>
                <span>
                  <i className="online" /> Cổng API & Routing
                </span>
                <strong>HOẠT ĐỘNG</strong>
              </div>
              <div>
                <span>
                  <i className="online" /> Cơ sở dữ liệu MySQL (Connection Pool)
                </span>
                <strong>KẾT NỐI</strong>
              </div>
              <div>
                <span>
                  <i className="online" /> Khóa bảo mật QR Token (SHA-256)
                </span>
                <strong>AN TOÀN</strong>
              </div>
              <div>
                <span>
                  <i className="online" /> Trình quét cổng & Check-in Gate
                </span>
                <strong>SẴN SÀNG</strong>
              </div>
              <div>
                <span>
                  <i className={summary?.staff.pendingApproval ? "" : "online"} />{" "}
                  Phê duyệt quyền nhân sự
                </span>
                <strong>
                  {summary?.staff.pendingApproval
                    ? `${summary.staff.pendingApproval} CHỜ DUYỆT`
                    : "HOÀN TẤT"}
                </strong>
              </div>
            </div>
          </div>
        </article>

        {/* Quick Action Grid */}
        <article className="admin-command-panel">
          <div className="admin-panel-heading">
            <div>
              <span>LỆNH NHANH</span>
              <h3>Điều hướng thao tác</h3>
            </div>
            <Zap size={20} />
          </div>

          <div className="admin-quick-grid">
            <button type="button" onClick={() => navigate("/admin/events")}>
              <CalendarDays size={20} />
              <span>Quản lý sự kiện</span>
              <small>Tạo mới, chỉnh sửa và công bố sự kiện</small>
            </button>

            <button type="button" onClick={() => navigate("/admin/ticket-types")}>
              <Ticket size={20} />
              <span>Cấu hình hạng vé</span>
              <small>Phân bổ hạn mức, giá bán và mở bán</small>
            </button>

            <button type="button" onClick={() => navigate("/admin/staff")}>
              <Users size={20} />
              <span>Phân công nhân viên</span>
              <small>Bố trí nhân sự soát vé tại các cổng</small>
            </button>

            <button type="button" onClick={() => navigate("/admin/reports")}>
              <Activity size={20} />
              <span>Báo cáo doanh thu & check-in</span>
              <small>Theo dõi tỷ lệ soát vé và doanh thu</small>
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}
