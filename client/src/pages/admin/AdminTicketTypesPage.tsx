import { ArrowRight, CalendarClock, CheckCircle2, Clock3, MapPin, Plus, RefreshCw, Ticket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { CapacityPanel } from "@/components/admin/ticket-types/CapacityPanel";
import { EventSelect } from "@/components/admin/ticket-types/EventSelect";
import { ReadinessCard } from "@/components/admin/ticket-types/ReadinessCard";
import { TierDetailPanel } from "@/components/admin/ticket-types/TierDetailPanel";
import { TierFormPanel } from "@/components/admin/ticket-types/TierFormPanel";
import { TierTable, type TierHandlers } from "@/components/admin/ticket-types/TierTable";
import {
  BentoCard, BentoGrid, Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, Notice, PageHeader, PageLayout,
  SkeletonBlock, StatusBadge, notify,
} from "@/components/admin/ui";
import { EVENT_LIFECYCLE_FALLBACK_REFRESH_MS } from "@/constants/eventconstants";
import { formatDateTime, formatNumber, formatTime } from "@/lib/admin-format";
import {
  TIER_FILTERS, canCreateTier, defaultTierEvent, inventory, isReadOnly, matchesTierFilter, tierCounts, type TierFilter,
} from "@/lib/admin-ticket-types";
import { cn } from "@/lib/utils";
import { listAdminEvents, publishAdminEvent, type AdminEvent } from "@/services/admin-events.service";
import {
  deleteAdminTicketType, listAdminTicketTypes, setAdminTicketSalesStatus, type AdminTicketType,
} from "@/services/admin-ticket-types.service";
import { subscribeToEventLifecycleUpdates } from "@/services/event-realtime.service";
import "@/styles/admin/ticket-types.css";

const FILTERS: Record<TierFilter, { label: string; empty: string }> = {
  all: { label: "Tổng hạng vé", empty: "Sự kiện chưa có hạng vé" },
  active: { label: "Đang bán/đang hoạt động", empty: "Không có hạng vé đang hoạt động" },
  paused: { label: "Tạm dừng", empty: "Không có hạng vé tạm dừng" },
  soldOut: { label: "Hết vé", empty: "Không có hạng vé hết vé" },
  hasReserved: { label: "Có vé đang giữ", empty: "Không có hạng vé có vé đang giữ" },
};

const POLICY: Record<"draft" | "live" | "closed", { tone: "info" | "warning"; title: string; points: string[] }> = {
  draft: { tone: "info", title: "Bản nháp: cấu hình tự do", points: ["Giá, số lượng, lịch bán và trạng thái đều sửa được.", "Cần ít nhất một hạng hoạt động hợp lệ để công bố."] },
  live: { tone: "warning", title: "Đã công bố: bảo vệ người mua", points: ["Số vé chỉ tăng, không giảm.", "Đổi giá: tạm dừng hạng chưa có đơn; hạng đã bán thì tạo hạng giá mới.", "Hạng mới tạo ở trạng thái Tạm dừng."] },
  closed: { tone: "info", title: "Chỉ đọc", points: ["Sự kiện đã kết thúc hoặc đã hủy; kho vé được giữ làm lịch sử."] },
};

// Tier colours for the capacity split; the same swatch marks the row in the table.
const SWATCHES = ["var(--tb-chart-1)", "var(--tb-ring-2)", "var(--tb-ring-3)", "var(--tb-chart-2)", "var(--tb-ring-4)", "var(--tb-ring-1)"];

export function AdminTicketTypesPage() {
  const [params, setParams] = useSearchParams();
  const requestedId = Number(params.get("eventId")) || 0;
  const setup = params.get("setup") === "1";

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");

  const [tiers, setTiers] = useState<{ eventId: number; rows: AdminTicketType[]; error: string; at: number }>({ eventId: 0, rows: [], error: "", at: 0 });
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<TierFilter>("all");
  const [form, setForm] = useState<{ open: boolean; tierId: number | null; key: number }>({ open: false, tierId: null, key: 0 });
  const [detailId, setDetailId] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminTicketType | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  const loadEvents = useCallback((showError: boolean) => listAdminEvents().then(
    ({ data }) => { setEvents(data); setEventsError(""); return true; },
    (error: unknown) => { if (showError) setEventsError(error instanceof Error ? error.message : "Không tải được sự kiện."); return false; },
  ).finally(() => setEventsLoading(false)), []);

  useEffect(() => {
    void loadEvents(true);
    const unsubscribe = subscribeToEventLifecycleUpdates(() => void loadEvents(false));
    const timer = window.setInterval(() => void loadEvents(false), EVENT_LIFECYCLE_FALLBACK_REFRESH_MS);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, [loadEvents]);

  // Selection lives in the URL (?eventId=) so links from Sự kiện/Tổng quan open the right Event;
  // without one, open the Event most likely being worked on (on sale soonest, then Drafts).
  const selected = events.find((event) => event.id === requestedId) ?? defaultTierEvent(events);
  const selectedId = selected?.id ?? 0;

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    listAdminTicketTypes(selectedId).then(
      (rows) => { if (active) setTiers({ eventId: selectedId, rows, error: "", at: Date.now() }); },
      (error: unknown) => { if (active) setTiers({ eventId: selectedId, rows: [], error: error instanceof Error ? error.message : "Không tải được hạng vé.", at: Date.now() }); },
    );
    return () => { active = false; };
  }, [selectedId, reload]);

  const tiersLoading = Boolean(selectedId) && tiers.eventId !== selectedId;
  const rows = tiers.eventId === selectedId ? tiers.rows : [];
  const now = tiers.at;
  const counts = tierCounts(rows);
  const visibleRows = rows.filter((tier) => matchesTierFilter(tier, filter));
  const inv = inventory(rows, selected?.venueCapacity);
  const editing = form.tierId ? rows.find((tier) => tier.id === form.tierId) ?? null : null;
  const detail = detailId ? rows.find((tier) => tier.id === detailId) ?? null : null;
  const create = selected ? canCreateTier(selected, inv.unallocated, now) : { allowed: false, reason: "Chưa chọn sự kiện." };
  const swatch = (id: number) => SWATCHES[Math.max(0, rows.findIndex((tier) => tier.id === id)) % SWATCHES.length];

  function selectEvent(id: number) {
    const next = new URLSearchParams(params);
    next.set("eventId", String(id));
    next.delete("setup");
    setParams(next, { replace: true });
    setFilter("all");
    setDetailId(null);
  }

  function openCreate() { setForm((current) => ({ open: true, tierId: null, key: current.key + 1 })); }

  function replaceTier(saved: AdminTicketType) {
    setTiers((current) => ({ ...current, rows: current.rows.some((tier) => tier.id === saved.id) ? current.rows.map((tier) => tier.id === saved.id ? saved : tier) : [...current.rows, saved].sort((a, b) => a.price - b.price || a.id - b.id) }));
  }

  /** Tier changes alter the Event's readiness/valid-tier counts, so refresh the Event list too. */
  function afterMutation() { void loadEvents(false); }

  const handlers: TierHandlers = {
    edit: (tier) => { setDetailId(null); setForm((current) => ({ open: true, tierId: tier.id, key: current.key + 1 })); },
    detail: (tier) => setDetailId(tier.id),
    remove: (tier) => { setDialogError(""); setRemoveTarget(tier); },
    toggle: (tier) => void toggle(tier),
  };

  async function toggle(tier: AdminTicketType) {
    if (pendingId) return;
    setPendingId(tier.id);
    try {
      const saved = await setAdminTicketSalesStatus(tier.id, !tier.isActive);
      replaceTier(saved);
      afterMutation();
      notify.success(saved.isActive ? "Đã mở bán hạng vé" : "Đã tạm dừng hạng vé", { description: saved.name });
    } catch (error) {
      notify.error(tier.isActive ? "Không tạm dừng được" : "Không mở bán được", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setPendingId(null);
    }
  }

  async function confirmRemove() {
    if (!removeTarget || pendingId) return;
    setPendingId(removeTarget.id); setDialogError("");
    try {
      await deleteAdminTicketType(removeTarget.id);
      setTiers((current) => ({ ...current, rows: current.rows.filter((tier) => tier.id !== removeTarget.id) }));
      afterMutation();
      notify.success("Đã xóa hạng vé", { description: removeTarget.name });
      setRemoveTarget(null);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Không xóa được hạng vé.");
    } finally {
      setPendingId(null);
    }
  }

  async function confirmPublish() {
    if (!selected || publishing) return;
    setPublishing(true); setPublishError("");
    try {
      const saved = await publishAdminEvent(selected.id);
      setEvents((current) => current.map((event) => (event.id === saved.id ? saved : event)));
      setPublishOpen(false);
      notify.success("Đã công bố sự kiện", { description: `${saved.name} · hạng vé mở bán theo khung giờ của từng hạng` });
      setReload((value) => value + 1);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Không công bố được sự kiện.");
    } finally {
      setPublishing(false);
    }
  }

  const policy = !selected ? null : selected.status === "draft" ? POLICY.draft : isReadOnly(selected) ? POLICY.closed : POLICY.live;

  return (
    <PageLayout className="ttp">
      <PageHeader
        title="Hạng vé"
        description="Giá, số vé và khung giờ bán của từng sự kiện."
        meta={now ? <span className="tb-num"><Clock3 size={13} aria-hidden="true" /> Kho vé cập nhật lúc {formatTime(new Date(now), true)}</span> : null}
        actions={<>
          <Button icon={RefreshCw} loading={tiersLoading && Boolean(tiers.eventId)} onClick={() => { setReload((value) => value + 1); void loadEvents(false); }}>Làm mới</Button>
          <Button variant="primary" icon={Plus} disabled={!create.allowed || tiersLoading} disabledReason={create.reason} onClick={openCreate}>Thêm hạng vé</Button>
        </>}
      />

      {eventsError && events.length === 0 ? (
        <ErrorState title="Không tải được danh sách sự kiện" description={eventsError} onRetry={() => { setEventsLoading(true); void loadEvents(true); }} retrying={eventsLoading} />
      ) : eventsLoading ? (
        <SkeletonBlock lines={6} label="Đang tải sự kiện" />
      ) : !selected ? (
        <EmptyState icon={CalendarClock} title="Chưa có sự kiện" description="Tạo một bản nháp sự kiện trước khi cấu hình hạng vé." action={<ButtonLink to="/admin/events" variant="primary">Mở trang Sự kiện</ButtonLink>} />
      ) : (
        <>
          <section className="tt-context" aria-label="Sự kiện đang cấu hình">
            <EventSelect events={events} selected={selected} onSelect={selectEvent} />
            <span className="tt-context-meta">
              <StatusBadge domain="event" status={selected.status} size="sm" />
              {selected.visibility === "hidden" && <StatusBadge label="Đang ẩn" tone="warning" size="sm" />}
              <span className="tb-num"><CalendarClock size={14} aria-hidden="true" />{formatDateTime(selected.startTime)}</span>
              <span><MapPin size={14} aria-hidden="true" />{selected.venue}</span>
            </span>
            <ButtonLink to={`/admin/events?focus=${selected.id}`} size="sm" variant="ghost" iconRight={ArrowRight}>Xem sự kiện</ButtonLink>
          </section>

          {setup && (rows.length === 0
            ? <Notice tone="info" title={`Bước 2/3 · Thêm hạng vé cho ${selected.name}`}>Tạo ít nhất một hạng vé hoạt động; hạng vé tự dùng lịch bán của sự kiện nếu không đặt riêng.</Notice>
            : <Notice tone="success" title="Đã có hạng vé" action={<ButtonLink to={`/admin/events?focus=${selected.id}`} size="sm" iconRight={ArrowRight}>Kiểm tra và công bố</ButtonLink>}>{selected.name} có {rows.length} hạng vé. Bước 3/3: quay lại Sự kiện để công bố.</Notice>)}

          <BentoGrid>
            <BentoCard
              span={8}
              title="Hạng vé"
              subtitle={tiersLoading ? "Đang tải…" : filter === "all" ? `${rows.length} hạng · sắp theo giá` : `${visibleRows.length}/${rows.length} hạng · ${FILTERS[filter].label}`}
              actions={create.allowed && !tiersLoading ? <Button size="sm" variant="ghost" icon={Plus} onClick={openCreate}>Thêm hạng</Button> : undefined}
            >
              {rows.length > 0 && (
                <div className="tt-chips" role="group" aria-label="Lọc hạng vé">
                  {TIER_FILTERS.map((key) => (
                    <button key={key} type="button" className={cn("tt-chip", filter === key && "is-active")} aria-pressed={filter === key}
                      onClick={() => setFilter(key)}>
                      {FILTERS[key].label}<span className="tt-chip-count tb-num">{counts[key]}</span>
                    </button>
                  ))}
                </div>
              )}

              {tiersLoading ? <SkeletonBlock lines={5} label="Đang tải hạng vé" /> : tiers.error ? (
                <ErrorState title="Không tải được hạng vé" description={tiers.error} onRetry={() => setReload((value) => value + 1)} />
              ) : visibleRows.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title={FILTERS[filter].empty}
                  description={filter === "all" ? "Sự kiện chỉ công bố được khi có ít nhất một hạng vé hợp lệ đang hoạt động." : undefined}
                  action={filter !== "all"
                    ? <Button onClick={() => setFilter("all")}>Xem tất cả ({rows.length})</Button>
                    : create.allowed ? <Button variant="primary" icon={Plus} onClick={openCreate}>Tạo hạng vé đầu tiên</Button> : undefined}
                />
              ) : (
                <TierTable tiers={visibleRows} event={selected} now={now} handlers={handlers} pendingId={pendingId} swatch={swatch} />
              )}
            </BentoCard>

            {/* This column mounts once tiers are loaded (see ticket-types.css): no skeleton-to-content jump
                inside it, and in stacked layouts the tier table never pushes it down. */}
            <div className={`span-4 tt-side${tiersLoading ? " is-loading" : ""}`}>
            {selected.status === "draft" && (
              <ReadinessCard event={selected} canAddTier={create.allowed && !tiersLoading} onAddTier={openCreate}
                onPublish={() => { setPublishError(""); setPublishOpen(true); }} />
            )}
            <BentoCard span={12} title="Sức chứa địa điểm" subtitle={`${selected.venue} · ${formatNumber(inv.venueCapacity)} chỗ`}>
              {tiersLoading ? <SkeletonBlock lines={4} label="Đang tải sức chứa" /> : <CapacityPanel tiers={rows} inv={inv} swatch={swatch} />}
              {/* Footnote right under the panel: the notices below may only appear once tiers load, and as the
                  last blocks of the card they never push anything else down. */}
              <p className="tt-foot-note"><CheckCircle2 size={14} aria-hidden="true" />Giá trị tiền là mô phỏng; không chuyển tiền thật.</p>
              {policy && (
                <Notice tone={policy.tone} title={policy.title}>
                  <ul className="tt-list">{policy.points.map((point) => <li key={point}>{point}</li>)}</ul>
                </Notice>
              )}
              {!tiersLoading && inv.unallocated === 0 && inv.venueCapacity > 0 && !isReadOnly(selected) && (
                <Notice tone="warning" title="Đã phân bổ hết chỗ">
                  {selected.status === "draft" ? "Giảm số vé của một hạng nháp để thêm hạng mới." : "Không thêm được hạng mới; số vé đã công bố không giảm được."}
                </Notice>
              )}
            </BentoCard>
            </div>
          </BentoGrid>

          {form.open && (
            <TierFormPanel
              key={form.key}
              open={form.open}
              onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
              event={selected}
              editing={editing}
              unallocated={inv.unallocated}
              onSaved={(saved, created) => {
                replaceTier(saved);
                afterMutation();
                setForm((current) => ({ ...current, open: false }));
                notify.success(created ? "Đã tạo hạng vé" : "Đã lưu hạng vé", { description: created && !saved.isActive && selected.status !== "draft" ? `${saved.name} · đang Tạm dừng, bấm Mở bán khi sẵn sàng` : saved.name });
              }}
            />
          )}

          <TierDetailPanel tier={detail} event={selected} now={now} onClose={() => setDetailId(null)} onEdit={handlers.edit} />

          <ConfirmDialog
            open={publishOpen}
            onOpenChange={(open) => { if (!open) setPublishOpen(false); }}
            tone="primary"
            title="Công bố sự kiện?"
            description={selected.name}
            consequences={[
              "Sự kiện hiện trên trang khách và mở bán theo khung giờ của từng hạng vé.",
              "Máy chủ kiểm tra lại điều kiện công bố trước khi đổi trạng thái.",
              "Sau khi công bố: số vé chỉ tăng, đổi giá cần tạm dừng hạng; không đưa về bản nháp được.",
            ]}
            confirmLabel="Công bố"
            pending={publishing}
            error={publishError}
            onConfirm={confirmPublish}
          />

          <ConfirmDialog
            open={Boolean(removeTarget)}
            onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
            title="Xóa hạng vé?"
            description={removeTarget?.name}
            consequences={["Hạng vé bị xóa vĩnh viễn, không khôi phục được.", "Chỉ xóa được khi chưa có vé giữ chỗ hoặc đã bán; máy chủ kiểm tra lại."]}
            confirmLabel="Xóa hạng vé"
            pending={Boolean(removeTarget && pendingId === removeTarget.id)}
            error={dialogError}
            onConfirm={confirmRemove}
          />
        </>
      )}
    </PageLayout>
  );
}
