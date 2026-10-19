// Run: node --test tests/layout-stability.test.cjs
// Source guards for the layout-stability rules (AGENTS "Layout stability"). The browser measurement is
// scripts/layout-audit.mjs (npm run audit:layout); these checks keep the cheap invariants from regressing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = (file) => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
const css = (file) => src(`styles/${file}`).replace(/\/\*[\s\S]*?\*\//g, '');

test('the scrollbar lane is reserved in Admin and Staff (no ~8px jump between short and long pages)', () => {
  assert.match(css('admin/shell.css'), /html:has\(\.adm-shell\)\s*\{[^}]*scrollbar-gutter:\s*stable/);
  assert.match(css('staff/portal.css'), /html:has\(\.staff-portal-room\)\s*\{[^}]*scrollbar-gutter:\s*stable/);
});

test('both shells load pages inside themselves, reset scroll per section and preload page chunks', () => {
  for (const file of ['layouts/AdminLayout.tsx', 'layouts/StaffLayout.tsx']) {
    const code = src(file);
    assert.match(code, /<Suspense\b/, `${file}: page chunks must load inside the shell`);
    assert.match(code, /useLayoutEffect\(\(\) => \{ window\.scrollTo\(0, 0\); \}, \[(location\.)?pathname\]\)/, `${file}: scroll reset keyed on pathname only`);
    assert.match(code, /usePreloadPages\(/, `${file}: preload so a click never leaves the old page on screen`);
  }
});

test('the data router lazy-loads every Admin and Staff page through the loaders the shells preload', () => {
  const router = src('routes/router.tsx');
  const loaders = src('routes/page-loaders.ts');
  assert.match(router, /createBrowserRouter\(/);
  for (const page of ['AdminDashboardPage', 'AdminEventsPage', 'AdminTicketTypesPage', 'AdminCategoriesPage', 'AdminStaffPage', 'AdminOrdersPage',
    'AdminCheckinLogsPage', 'AdminReportsPage', 'AdminSettingsPage', 'StaffOverviewPage', 'StaffCheckinPage', 'StaffEventsPage', 'StaffHistoryPage']) {
    assert.match(router, new RegExp(`lazy: page\\((admin|staff)PageLoaders\\.\\w+, "${page}"\\)`), `${page} must use page-loaders`);
    assert.ok(loaders.includes(`/${page}"`), `${page} missing from page-loaders.ts`);
  }
});

test('the route progress bar is shown by the Admin, Staff and Login shells only', () => {
  for (const file of ['layouts/AdminLayout.tsx', 'layouts/StaffLayout.tsx', 'components/auth/AuthShell.tsx']) assert.match(src(file), /<RouteProgress \/>/, file);
  assert.doesNotMatch(src('layouts/PublicLayout.tsx'), /RouteProgress/);
  assert.match(src('components/shared/RouteProgress.tsx'), /useNavigation\(\)/);
});

test('PageHeader keeps the meta line while it is unknown, and Admin pages pass meta from the first render', () => {
  const header = src('components/admin/ui/PageHeader.tsx');
  assert.match(header, /meta !== undefined/);
  assert.match(header, /adm-page-meta is-pending/);
  const pages = fs.readdirSync(path.join(__dirname, '../src/pages/admin')).filter((f) => f.endsWith('.tsx') && f !== 'AdminUiCatalogPage.tsx');
  for (const file of pages) {
    const code = src(`pages/admin/${file}`);
    if (!code.includes('<PageHeader')) continue;
    assert.match(code, /\bmeta=\{/, `${file}: pass meta (null while loading) so the header height does not change`);
  }
});

test('loading placeholders never make a line taller than its loaded content', () => {
  const kpi = src('components/admin/ui/KpiCard.tsx');
  assert.doesNotMatch(kpi, /height="1\.[1-9]em"/, 'KPI skeletons must stay under the 1.15 line-height');
  assert.match(kpi, /hint !== undefined/, 'a KPI that will show a hint keeps the hint line while loading');
  const shell = src('layouts/AdminLayout.tsx');
  assert.match(shell, /className="adm-page-header is-sticky"/, 'the route skeleton mirrors the real header classes');
});

test('cover images cannot grow their aspect-ratio box after loading', () => {
  assert.match(css('admin/events.css'), /\.ev-card-media\s*\{[^}]*aspect-ratio:[^}]*overflow:\s*hidden/);
});

test('a stored dark theme is painted before React for Admin, Staff and Login', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  for (const key of ['ticketbox:theme:admin:last', 'ticketbox:theme:staff:last', 'ticketbox:theme:login']) assert.ok(html.includes(key), key);
  assert.ok(html.includes('dataset.tbBoot'));
  for (const file of ['layouts/AdminLayout.tsx', 'layouts/StaffLayout.tsx', 'components/auth/AuthShell.tsx']) {
    assert.match(src(file), /delete document\.documentElement\.dataset\.tbBoot/, `${file} must clear the boot marker`);
  }
});

test('the two-column scan terminal keeps a fixed verdict height', () => {
  assert.match(css('staff/portal.css'), /@media \(min-width: 1101px\) \{ \.sp-result \{ min-height: \d+px; \} \}/);
});
