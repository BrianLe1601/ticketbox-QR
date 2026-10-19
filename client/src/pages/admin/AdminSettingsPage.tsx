import { Clock3, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";

import { AccountSettings } from "@/components/admin/settings/AccountSettings";
import { AppearanceSettings } from "@/components/admin/settings/AppearanceSettings";
import { SystemSettings } from "@/components/admin/settings/SystemSettings";
import { BentoGrid, Button, Notice, PageHeader, PageLayout, SkeletonBlock, TabPanel, Tabs } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/admin-format";
import { SETTINGS_TABS, tabFromParam, venueDirty, venueFormOf, type VenueForm } from "@/lib/admin-settings";
import type { AdminOutletContext } from "@/layouts/AdminLayout";
import { listAdminCategories, type AdminCategory } from "@/services/admin-categories.service";
import { getPlatformSettings, type PlatformSettings } from "@/services/admin-platform-settings.service";
import "@/styles/admin/settings.css";

const message = (cause: unknown) => (cause instanceof Error && cause.message ? cause.message : "Không thể kết nối máy chủ.");

export function AdminSettingsPage() {
  const { appearance, updateAppearance, themePreference, setThemePreference } = useOutletContext<AdminOutletContext>();
  const [params, setParams] = useSearchParams();
  const tab = tabFromParam(params.get("tab"));

  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [venueForm, setVenueForm] = useState<VenueForm>(venueFormOf(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([getPlatformSettings(), listAdminCategories(true)])
      .then(([platform, list]) => {
        if (!active) return;
        setSettings(platform); setCategories(list); setVenueForm(venueFormOf(platform.venue)); setError("");
      })
      .catch((cause: unknown) => { if (active) setError(message(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const unsaved = Boolean(settings?.venue) && settings !== null && venueDirty(settings.venue, venueForm);
  const items = SETTINGS_TABS.map((item) => (item.value === "system" && unsaved ? { ...item, label: `${item.label} (chưa lưu)` } : item));

  return (
    <PageLayout className="stp">
      <PageHeader
        title="Cài đặt"
        description="Địa điểm và danh mục dùng chung cho cả hệ thống; giao diện và tài khoản là của riêng bạn."
        meta={settings?.updatedAt ? <span className="tb-num"><Clock3 size={13} aria-hidden="true" /> Cấu hình hệ thống cập nhật {formatDateTime(settings.updatedAt)}{settings.updatedBy?.fullName ? ` bởi ${settings.updatedBy.fullName}` : ""}</span> : null}
        actions={tab === "system" ? <Button icon={RefreshCw} loading={loading && Boolean(settings)} disabled={unsaved} disabledReason="Lưu hoặc hoàn tác địa điểm trước" onClick={() => { setLoading(true); setReload((n) => n + 1); }}>Tải lại</Button> : undefined}
      />

      <Tabs ariaLabel="Nhóm cài đặt" items={items} value={tab} onValueChange={(next) => { const p = new URLSearchParams(params); if (next === "system") p.delete("tab"); else p.set("tab", next); setParams(p, { replace: true }); }}>
        <TabPanel value="system">
          {error && <Notice tone="danger" title="Không tải được cấu hình hệ thống" action={<Button size="sm" icon={RefreshCw} onClick={() => { setLoading(true); setReload((n) => n + 1); }}>Thử lại</Button>}>{error}</Notice>}
          {!settings ? (!error && <BentoGrid><div className="st-skel"><SkeletonBlock lines={6} /></div><div className="st-skel"><SkeletonBlock lines={6} /></div></BentoGrid>) : (
            <BentoGrid>
              <SystemSettings settings={settings} categories={categories} form={venueForm} onForm={setVenueForm} onSettings={setSettings} onCategories={setCategories} />
            </BentoGrid>
          )}
        </TabPanel>
        <TabPanel value="appearance">
          <BentoGrid>
            <AppearanceSettings appearance={appearance} onAppearance={updateAppearance} theme={themePreference} onTheme={setThemePreference} />
          </BentoGrid>
        </TabPanel>
        <TabPanel value="account">
          <BentoGrid>
            <AccountSettings />
          </BentoGrid>
        </TabPanel>
      </Tabs>
    </PageLayout>
  );
}
