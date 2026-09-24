import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Construction,
  Cpu,
  Radio,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLocation } from "react-router-dom";

const modules = {
  "/admin/orders": {
    eyebrow: "KIỂM SOÁT GIAO DỊCH",
    title: "Quản lý đơn hàng",
    description: "Theo dõi giữ chỗ, trạng thái thanh toán, vé đã phát hành và lịch sử đơn hàng.",
    icon: ClipboardCheck,
    metrics: [["Đơn đang chờ", "00"], ["Đã thanh toán hôm nay", "00"], ["Giữ chỗ hết hạn", "00"]],
  },
  "/admin/staff": {
    eyebrow: "VẬN HÀNH NHÂN SỰ",
    title: "Quản lý nhân viên",
    description: "Quản lý nhân viên tại cổng, phân công sự kiện, quyền truy cập và trạng thái sẵn sàng.",
    icon: Users,
    metrics: [["Nhân viên hoạt động", "00"], ["Đã phân công", "00"], ["Đang trực", "00"]],
  },
  "/admin/checkins": {
    eyebrow: "CỔNG KIỂM SOÁT",
    title: "Nhật ký check-in",
    description: "Kiểm tra kết quả quét, lượt quét trùng, mã bị từ chối và lượt vào cổng thành công.",
    icon: ScanLine,
    metrics: [["Thành công", "00"], ["Bị từ chối", "00"], ["Trùng lặp", "00"]],
  },
  "/admin/reports": {
    eyebrow: "PHÂN TÍCH DỮ LIỆU",
    title: "Báo cáo và phân tích",
    description: "Tổng hợp lượng người tham dự, doanh thu, tồn vé và hoạt động tại cổng.",
    icon: BarChart3,
    metrics: [["Tỷ lệ tham dự", "0%"], ["Doanh thu", "0 ₫"], ["Sự kiện đang mở", "00"]],
  },
} as const;

export function AdminPlaceholderPage() {
  const { pathname } = useLocation();
  const module = modules[pathname as keyof typeof modules] ?? modules["/admin/orders"];
  const Icon = module.icon;

  return (
    <section className="factory-module-page">
      <header className="factory-module-hero">
        <div>
          <div className="admin-live-label"><Radio size={13} /> {module.eyebrow}</div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className="factory-module-core"><Icon size={31} /></div>
      </header>

      <div className="factory-module-metrics">
        {module.metrics.map(([label, value], index) => (
          <article key={label}>
            {index === 0 ? <Activity size={17} /> : index === 1 ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
            <span>{label}</span><strong>{value}</strong>
          </article>
        ))}
      </div>

      <article className="factory-module-console">
        <div className="factory-console-visual"><Cpu size={42} /><i /><i /><i /></div>
        <div>
          <span><Construction size={13} /> MÔ-ĐUN ĐANG CHỜ KẾT NỐI</span>
          <h3>Giao diện đã sẵn sàng</h3>
          <p>Điều hướng, bố cục đáp ứng và giao diện đã hoàn tất. Hãy kết nối API khi quy trình nghiệp vụ của mô-đun được triển khai.</p>
        </div>
      </article>
    </section>
  );
}
