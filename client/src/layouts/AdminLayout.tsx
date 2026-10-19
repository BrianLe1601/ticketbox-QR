import { ArrowRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { CommandPalette } from "@/components/admin/shell/CommandPalette";
import { RouteProgress } from "@/components/shared/RouteProgress";
import { NavItemLink, type NavBadgeView } from "@/components/admin/shell/NavItemLink";
import { SidebarSummary } from "@/components/admin/shell/SidebarSummary";
import { TaskBell } from "@/components/admin/shell/TaskBell";
import { ADMIN_NAVIGATION, ADMIN_SETTINGS_NAV, sectionLabel, type NavBadge, type NavItem } from "@/components/admin/shell/navigation";
import { IconButton, Skeleton, ThemeMenu, Toaster, Tooltip, TooltipProvider, notify } from "@/components/admin/ui";
import { useAuth } from "@/context/AuthContext";
import { useAdminSignals, type AdminSignals } from "@/hooks/useAdminSignals";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { usePreloadPages } from "@/hooks/usePreloadPages";
import { initials } from "@/lib/admin-format";
import { adminFonts, adminFontSizes, readAdminAppearance, writeAdminAppearance, type AdminAppearance } from "@/lib/admin-appearance";
import { useTheme, type ThemePreference } from "@/lib/ticketbox-theme";
import { cn } from "@/lib/utils";
import { adminPageLoaders } from "@/routes/page-loaders";

/** What Admin pages may read from the shell through useOutletContext(). */
export interface AdminOutletContext {
  appearance: AdminAppearance;
  updateAppearance: (next: AdminAppearance) => boolean;
  themePreference: ThemePreference;
  setThemePreference: (next: ThemePreference) => void;
  signals: AdminSignals & { refresh: () => Promise<void> };
  openSearch: () => void;
}

const DRAWER_QUERY = "(max-width: 1023px)";
const collapseKey = (accountId: number) => `ticketbox:admin:sidebar:${accountId}`;

function readCollapsed(accountId: number) {
  try { return window.localStorage.getItem(collapseKey(accountId)) === "1"; } catch { return false; }
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu']"));
}

function badgeFor(badge: NavBadge | undefined, signals: AdminSignals): NavBadgeView | null {
  if (!badge || !signals.summary) return null;
  if (badge === "live") return signals.openGates.length > 0 ? { kind: "live" as const, text: "Live", label: `${signals.openGates.length} sự kiện đang mở cổng check-in` } : null;
  const count = badge === "pendingOrders" ? signals.summary.orders.pending : signals.summary.staff.pendingApproval;
  if (!count) return null;
  return { kind: "count" as const, text: count > 99 ? "99+" : String(count), label: badge === "pendingOrders" ? `${count} đơn chờ thanh toán` : `${count} tài khoản chờ duyệt` };
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const accountId = user?.id ?? 0;
  const navigate = useNavigate();
  const location = useLocation();
  const signals = useAdminSignals();

  const [appearance, setAppearance] = useState(() => readAdminAppearance(accountId));
  const { theme, preference, setPreference } = useTheme("admin", accountId);
  const [collapsed, setCollapsed] = useState(() => readCollapsed(accountId));
  const [drawerMode, setDrawerMode] = useState(() => window.matchMedia(DRAWER_QUERY).matches);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const drawerOpener = useRef<HTMLElement | null>(null);

  const appearanceStyle = {
    "--admin-font": adminFonts[appearance.font].family,
    "--admin-font-size": `${adminFontSizes[appearance.size]}px`,
  } as CSSProperties;

  // Portals render into body; scope Admin-only selectors there and clean up on exit.
  useEffect(() => {
    document.body.dataset.adminAppearance = theme;
    document.body.style.setProperty("--admin-font", adminFonts[appearance.font].family);
    document.body.style.setProperty("--admin-font-size", `${adminFontSizes[appearance.size]}px`);
    // index.html painted an early background to avoid a light flash; the shell owns it now.
    delete document.documentElement.dataset.tbBoot;
    return () => {
      delete document.body.dataset.adminAppearance;
      document.body.style.removeProperty("--admin-font");
      document.body.style.removeProperty("--admin-font-size");
    };
  }, [appearance, theme]);

  useEffect(() => {
    const media = window.matchMedia(DRAWER_QUERY);
    const sync = () => { setDrawerMode(media.matches); if (!media.matches) setDrawerOpen(false); };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try { window.localStorage.setItem(collapseKey(accountId), next ? "1" : "0"); } catch { /* preference only */ }
      return next;
    });
  }, [accountId]);

  // Shortcuts: Ctrl/⌘+K opens search anywhere; "[" collapses the sidebar when not typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === "Escape" && drawerOpen) { setDrawerOpen(false); return; }
      if (event.key === "[" && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping(event.target) && !drawerMode) {
        event.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerMode, drawerOpen, toggleCollapsed]);

  useDialogFocus(drawerMode && drawerOpen, ".adm-shell-sidebar", true, drawerOpener);
  // Section clicks must switch at once (React Router keeps the old page while a chunk downloads).
  usePreloadPages(adminPageLoaders);

  // A new section always opens at its top (the SPA would otherwise keep the previous page's scroll
  // offset). Only the pathname counts: filters in the query string keep the position.
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  // Auto mode never flips mid-task; with a gate open in daylight it only suggests Tối, once per session.
  useEffect(() => {
    if (preference !== "auto" || theme !== "light" || signals.openGates.length === 0) return;
    const key = `ticketbox:admin:dark-hint:${accountId}`;
    try { if (window.sessionStorage.getItem(key)) return; window.sessionStorage.setItem(key, "1"); } catch { /* show anyway */ }
    notify.info("Có sự kiện đang mở cổng check-in", {
      description: "Giao diện tối dễ nhìn hơn khi theo dõi cổng. Bạn có thể quay lại Tự động trong menu Giao diện.",
      action: { label: "Chuyển", onClick: () => setPreference("dark") },
      persistent: true,
      id: "dark-hint",
    });
  }, [preference, theme, signals.openGates.length, accountId, setPreference]);

  function updateAppearance(next: AdminAppearance) {
    setAppearance(next);
    return writeAdminAppearance(accountId, next);
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const compact = collapsed && !drawerMode;
  const section = sectionLabel(location.pathname);
  const context: AdminOutletContext = { appearance, updateAppearance, themePreference: preference, setThemePreference: setPreference, signals, openSearch: () => setPaletteOpen(true) };

  function renderLink(item: NavItem) {
    return <li key={item.to}><NavItemLink item={item} badge={badgeFor(item.badge, signals)} compact={compact} onNavigate={() => setDrawerOpen(false)} /></li>;
  }

  return (
    <TooltipProvider>
      <div
        className={cn("admin-room adm-shell", compact && "is-collapsed", drawerMode && "is-drawer-mode", drawerOpen && "is-drawer-open")}
        data-theme={theme}
        style={appearanceStyle}
      >
        <RouteProgress />
        <a className="adm-skip-link" href="#admin-main">Bỏ qua điều hướng</a>
        {drawerMode && drawerOpen && <button type="button" className="adm-shell-backdrop" aria-label="Đóng menu" onClick={() => setDrawerOpen(false)} />}

        <aside
          id="admin-navigation"
          className="adm-shell-sidebar"
          aria-label="Điều hướng quản trị"
          role={drawerMode && drawerOpen ? "dialog" : undefined}
          aria-modal={drawerMode && drawerOpen ? true : undefined}
          inert={drawerMode && !drawerOpen}
        >
          {!drawerMode && (
            <Tooltip side="right" content={compact ? "Mở rộng thanh bên ( [ )" : "Thu gọn thanh bên ( [ )"}>
              <button type="button" className="adm-shell-collapse" onClick={toggleCollapsed} aria-expanded={!compact} aria-controls="admin-navigation" aria-keyshortcuts="["
                aria-label={compact ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}>
                {compact ? <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden="true" /> : <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden="true" />}
              </button>
            </Tooltip>
          )}
          <div className="adm-shell-profile">
            {drawerMode && <IconButton icon={X} label="Đóng thanh điều hướng" className="adm-shell-nav-icon adm-shell-close" onClick={() => setDrawerOpen(false)} />}
            <Link to="/admin" className="adm-shell-logo" aria-label="TicketBox Admin — về Tổng quan" onClick={() => setDrawerOpen(false)}>
              <span className="adm-shell-avatar" aria-hidden="true">{initials(user?.fullName)}</span>
            </Link>
            <div className="adm-shell-profile-text">
              <strong className="adm-shell-name">{user?.fullName}</strong>
              <Link to="/admin/settings" className="adm-shell-role" onClick={() => setDrawerOpen(false)}>
                Quản trị viên <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <nav className="adm-shell-nav" aria-label="Các khu vực quản trị">
            <ul>{[...ADMIN_NAVIGATION, ADMIN_SETTINGS_NAV].map(renderLink)}</ul>
          </nav>

          {!compact && <SidebarSummary signals={signals} />}

          <div className="adm-shell-sidebar-foot">
            <Tooltip side="right" content="Đăng xuất" disabled={!compact}>
              <button type="button" className="adm-shell-logout" onClick={handleLogout} aria-label={compact ? "Đăng xuất" : undefined}>
                <span className="adm-shell-logout-icon" aria-hidden="true"><LogOut size={18} strokeWidth={1.75} /></span>
                <span className="adm-nav-text">Đăng xuất</span>
              </button>
            </Tooltip>
          </div>
        </aside>

        <div className="adm-shell-main" inert={drawerMode && drawerOpen}>
          <header className="adm-shell-topbar">
            <div className="adm-shell-topbar-start">
              {drawerMode && (
                <IconButton
                  icon={Menu}
                  label="Mở thanh điều hướng"
                  aria-expanded={drawerOpen}
                  aria-controls="admin-navigation"
                  onClick={(event) => { drawerOpener.current = event.currentTarget; setDrawerOpen(true); }}
                />
              )}
              <nav aria-label="Vị trí hiện tại" className="adm-shell-crumb">
                <ol><li><Link to="/admin">Quản trị</Link></li><li aria-current="page">{section}</li></ol>
              </nav>
            </div>
            <div className="adm-shell-topbar-end">
              <button type="button" className="adm-shell-search" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K Meta+K">
                <Search size={16} aria-hidden="true" />
                <span className="adm-shell-search-text">Tìm nhanh…</span>
                <kbd aria-hidden="true">Ctrl K</kbd>
              </button>
              <TaskBell signals={signals} accountId={accountId} />
              <ThemeMenu preference={preference} theme={theme} onChange={setPreference} />
            </div>
          </header>

          <main id="admin-main" className="adm-shell-content" tabIndex={-1}>
            <div className="adm-shell-workspace">
              {/* Page chunks load here, so the shell (sidebar, topbar) never disappears between pages. */}
              <Suspense fallback={<RouteSkeleton />}>
                <Outlet context={context} />
              </Suspense>
            </div>
          </main>
        </div>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} navigation={[...ADMIN_NAVIGATION, ADMIN_SETTINGS_NAV]} />
        <Toaster theme={theme} />
      </div>
    </TooltipProvider>
  );
}

/**
 * Lazy page placeholder with the same frame as a loaded page (title, description and meta lines,
 * then a content block), so nothing below the topbar jumps when the page chunk arrives.
 */
function RouteSkeleton() {
  return (
    <div className="adm-page adm-route-loading" role="status" aria-live="polite">
      <span className="sr-only">Đang tải trang</span>
      {/* Same classes as PageHeader, so line heights (and the user's font size) give the same height. */}
      <div className="adm-page-header is-sticky" aria-hidden="true">
        <div className="adm-page-header-row">
          <div className="adm-page-header-text">
            <div className="adm-page-title"><Skeleton width="240px" height="0.8em" /></div>
            <p className="adm-page-desc"><Skeleton width="min(520px, 80%)" height="0.8em" /></p>
            <div className="adm-page-meta"><Skeleton width="180px" height="0.8em" /></div>
          </div>
        </div>
      </div>
      <div className="adm-route-loading-body" aria-hidden="true" />
    </div>
  );
}
