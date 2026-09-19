import { CalendarDays, ClipboardCheck, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { AdminOperationsPage } from '@/pages/admin/AdminOperationsPage';

const actions = [
  { to: '/admin/checkins', label: 'Lịch sử check-in', icon: ClipboardCheck },
  { to: '/admin/events', label: 'Quản lý sự kiện', icon: CalendarDays },
  { to: '/admin/ticket-types', label: 'Quản lý loại vé', icon: Ticket },
];

export function AdminDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <section className="admin-welcome">
        <div>
          <h2>Xin chào, {user?.fullName}</h2>
          <p>Theo dõi vé, lượt vào cổng và doanh thu theo sự kiện. Áp dụng lại bộ lọc để cập nhật số liệu mới nhất.</p>
        </div>
      </section>
      <nav aria-label="Thao tác quản trị nhanh" className="flex flex-wrap gap-3">
        {actions.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-2 rounded-lg border border-cyan-500/40 px-4 py-2 text-slate-100 hover:bg-cyan-400/10 focus-visible:outline-2 focus-visible:outline-cyan-300">
            <Icon size={20} aria-hidden="true" />{label}
          </Link>
        ))}
      </nav>
      <AdminOperationsPage kind="reports" />
    </div>
  );
}
