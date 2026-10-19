import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { CalendarDays, CornerDownLeft, Loader2, Mail, Search, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { formatDateTime } from "@/lib/admin-format";
import { statusStyle } from "@/lib/admin-status";
import { listAdminEvents, type AdminEvent } from "@/services/admin-events.service";
import { listAdminOrders, type AdminOrderListItem } from "@/services/admin-orders.service";
import { listAdminStaff, type AdminStaff } from "@/services/admin-staff.service";
import type { NavItem } from "./navigation";

interface Sources { events: AdminEvent[]; staff: AdminStaff[] }

/**
 * Global jump (Ctrl/⌘+K): pages, Events, Staff (loaded once per open) and Orders by buyer
 * email (server LIKE search; the API has no order-code search yet, so none is promised).
 */
export function CommandPalette({ open, onOpenChange, navigation }: { open: boolean; onOpenChange: (open: boolean) => void; navigation: NavItem[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<Sources | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Result of the last finished order search, tagged with the term it answers.
  const [orderResult, setOrderResult] = useState<{ term: string; orders: AdminOrderListItem[] }>({ term: "", orders: [] });
  const requestId = useRef(0);

  useEffect(() => {
    if (!open || sources) return;
    let cancelled = false;
    Promise.all([listAdminEvents(), listAdminStaff()])
      .then(([events, staff]) => { if (!cancelled) { setSources({ events: events.data, staff }); setLoadError(false); } })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [open, sources]);

  // Orders are searched on the server by email, debounced, latest request wins.
  const searchTerm = query.trim();
  useEffect(() => {
    if (!open || searchTerm.length < 3) return;
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      listAdminOrders({ buyerEmail: searchTerm, limit: 6 })
        .then((response) => { if (id === requestId.current) setOrderResult({ term: searchTerm, orders: response.data }); })
        .catch(() => { if (id === requestId.current) setOrderResult({ term: searchTerm, orders: [] }); });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm, open]);
  const ordersLoading = searchTerm.length >= 3 && orderResult.term !== searchTerm;
  const orders = orderResult.term === searchTerm ? orderResult.orders : [];

  function go(to: string) {
    onOpenChange(false);
    setQuery("");
    navigate(to);
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) { setQuery(""); setSources(null); }
  }

  const term = query.trim().toLocaleLowerCase("vi");
  const events = (sources?.events ?? []).filter((event) => !term || event.name.toLocaleLowerCase("vi").includes(term)).slice(0, 6);
  const staff = (sources?.staff ?? []).filter((person) => !term || `${person.fullName} ${person.email}`.toLocaleLowerCase("vi").includes(term)).slice(0, 6);

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="adm-overlay" />
        <Dialog.Content className="adm-cmdk" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Tìm nhanh</Dialog.Title>
          <Command label="Tìm nhanh trang, sự kiện, nhân viên, đơn hàng" shouldFilter={false} loop>
            <div className="adm-cmdk-input">
              <Search size={16} aria-hidden="true" />
              <Command.Input value={query} onValueChange={setQuery} placeholder="Tìm trang, sự kiện, nhân viên hoặc email người mua…" />
              <kbd>Esc</kbd>
            </div>
            <Command.List className="adm-cmdk-list">
              {loadError && <p className="adm-cmdk-note" role="alert">Không tải được danh sách sự kiện/nhân viên. Đóng và mở lại để thử lại.</p>}
              <Command.Empty className="adm-cmdk-note">{sources ? "Không có kết quả phù hợp." : "Đang tải…"}</Command.Empty>

              <Command.Group heading="Trang">
                {navigation.filter((item) => !term || item.label.toLocaleLowerCase("vi").includes(term)).map((item) => (
                  <Command.Item key={item.to} value={`page-${item.to}`} onSelect={() => go(item.to)} className="adm-cmdk-item">
                    <item.icon size={16} strokeWidth={1.5} aria-hidden="true" /><span>{item.label}</span><CornerDownLeft className="adm-cmdk-enter" size={14} aria-hidden="true" />
                  </Command.Item>
                ))}
              </Command.Group>

              {events.length > 0 && (
                <Command.Group heading="Sự kiện">
                  {events.map((event) => (
                    <Command.Item key={event.id} value={`event-${event.id}`} onSelect={() => go(`/admin/events?focus=${event.id}`)} className="adm-cmdk-item">
                      <CalendarDays size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span className="adm-cmdk-text"><span>{event.name}</span><small>{statusStyle("event", event.status).label} · {formatDateTime(event.startTime)}</small></span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {staff.length > 0 && (
                <Command.Group heading="Nhân viên">
                  {staff.map((person) => (
                    <Command.Item key={person.id} value={`staff-${person.id}`} onSelect={() => go(`/admin/staff?focus=${person.id}`)} className="adm-cmdk-item">
                      <Users size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span className="adm-cmdk-text"><span>{person.fullName}</span><small>{person.email}</small></span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {term.length >= 3 && (
                <Command.Group heading="Đơn hàng theo email người mua">
                  {ordersLoading && <p className="adm-cmdk-note"><Loader2 className="adm-spin" size={14} aria-hidden="true" /> Đang tìm…</p>}
                  {!ordersLoading && orders.length === 0 && <p className="adm-cmdk-note">Không có đơn nào khớp email này.</p>}
                  {orders.map((order) => (
                    <Command.Item key={order.id} value={`order-${order.id}`} onSelect={() => go(`/admin/orders?focus=${order.id}`)} className="adm-cmdk-item">
                      <Mail size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span className="adm-cmdk-text"><span className="tb-mono">{order.orderCode}</span><small>{order.buyerEmail} · {order.eventName}</small></span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
            <div className="adm-cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> chọn</span><span><kbd>Enter</kbd> mở</span><span><kbd>Ctrl</kbd>+<kbd>K</kbd> mở/đóng</span></div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
