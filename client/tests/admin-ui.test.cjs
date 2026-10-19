const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, overrides = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => overrides[name] ?? require(name), ...globals });
  return exports;
}
const categories = [
  { id: 1, name: 'Pop', slug: 'pop', description: 'Concert sinh viên', isActive: true, sortOrder: 2, eventCount: 3 },
  { id: 2, name: 'Rock', slug: 'rock', description: null, isActive: false, sortOrder: 1, eventCount: 1 },
  { id: 3, name: 'Acoustic', slug: 'acoustic', description: 'Đêm nhạc', isActive: true, sortOrder: 1, eventCount: 0 },
];

test('category summary and unsearched segments use the same predicate', () => {
  const api = load('lib/admin-category-view.ts');
  const summary = api.summarizeCategories(categories);
  assert.deepEqual(JSON.parse(JSON.stringify(summary)), { total: 3, active: 2, inactive: 1, totalEvents: 4 });
  for (const [status, count] of [['all', summary.total], ['active', summary.active], ['inactive', summary.inactive]]) {
    assert.equal(api.filterCategories(categories, status, '', 'order').length, count);
  }
});

test('category search combines status, handles null description and preserves the source order', () => {
  const { filterCategories } = load('lib/admin-category-view.ts');
  const before = categories.map(item => item.id);
  assert.equal(filterCategories(categories, 'active', ' ROCK ', 'name').length, 0);
  assert.equal(filterCategories(categories, 'all', ' ROCK ', 'name')[0].id, 2);
  assert.equal(filterCategories(categories, 'active', 'đêm nhạc', 'order')[0].id, 3);
  assert.equal(filterCategories(categories, 'all', 'missing', 'order').length, 0);
  assert.equal(filterCategories(categories, 'all', '', 'events')[0].id, 1);
  assert.deepEqual(categories.map(item => item.id), before);
});

test('pending-refund-only work is still surfaced (now in the topbar task bell) and Dashboard metrics navigate instead of filtering', () => {
  const format = load('lib/admin-format.ts');
  const insights = load('lib/admin-insights.ts', { './admin-format': format });
  const summary = { staff: { pendingApproval: 0 }, refunds: { pendingCount: 2, pendingAmount: 100000 },
    alerts: { unstaffedUpcomingEvents: [], scheduledPublishFailedEvents: [] } };
  const { tasks } = insights.buildTasks(summary);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].kind, 'refund');
  assert.equal(tasks[0].to, '/admin/orders?view=refunds', 'the bell opens the refund centre');
  assert.match(tasks[0].title, /2 yêu cầu hoàn tiền \(mô phỏng\) chờ xử lý/);
  // The bell renders these tasks; the Dashboard no longer duplicates a "Cần xử lý" block.
  const bell = fs.readFileSync(path.join(__dirname, '../src/components/admin/shell/TaskBell.tsx'), 'utf8');
  assert.match(bell, /buildTasks\(signals\.summary\)/);
  const page = fs.readFileSync(path.join(__dirname, '../src/pages/admin/AdminDashboardPage.tsx'), 'utf8');
  assert.doesNotMatch(page, /Cần xử lý/);
  // Summary-card contract: the Dashboard shows no metric that pretends to filter the page.
  // Any KPI card it may render is a link (to=), never an in-page filter (onClick=).
  const cards = page.match(/<KpiCard[\s\S]*?\/>/g) ?? [];
  for (const card of cards) {
    assert.match(card, /\bto="/);
    assert.doesNotMatch(card, /onClick=/);
  }
  // The quick-summary counts live in the sidebar and are read-only text.
  const sidebar = fs.readFileSync(path.join(__dirname, "../src/components/admin/shell/SidebarSummary.tsx"), "utf8");
  assert.doesNotMatch(sidebar, /onClick|<button/);
});

test('nested focus scopes restore their own opener and preserve the underlying scroll lock', () => {
  const document = { body: { style: { overflow: 'auto' } }, activeElement: null };
  class Element {
    constructor(visible = true, disabled = false) { this.tabIndex = 0; this.visible = visible; this.disabled = disabled; this.isConnected = true; }
    focus() { document.activeElement = this; }
    getClientRects() { return this.visible ? [1] : []; }
    matches() { return this.disabled; }
    getAttribute() { return null; }
    removeAttribute() {}
  }
  const trigger = new Element(), link = new Element(), summary = new Element();
  const drawer = new Element(), modal = new Element(), cancel = new Element();
  drawer.querySelectorAll = () => [link, new Element(false), summary, new Element(true, true)];
  modal.querySelectorAll = () => [cancel];
  drawer.contains = element => [link, summary].includes(element);
  modal.contains = element => element === cancel;
  document.querySelector = selector => selector === 'drawer' ? drawer : modal;
  const refs = [], cleanups = [], listeners = new Set();
  const api = load('hooks/useDialogFocus.ts', { react: {
    useRef(value) { const ref = { current: value }; refs.push(ref); return ref; },
    useEffect(callback) { const cleanup = callback(); if (cleanup) cleanups.push(cleanup); },
  } }, { document, HTMLElement: Element, window: {
    addEventListener(_name, handler) { listeners.add(handler); },
    removeEventListener(_name, handler) { listeners.delete(handler); },
  } });
  trigger.focus();
  api.useDialogFocus(true, 'drawer');
  assert.equal(document.activeElement, link);
  assert.equal(api.dialogControls(drawer).length, 2);
  summary.focus();
  let prevented = false;
  for (const handler of listeners) handler({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(document.activeElement, link);
  summary.focus(); refs[0].current = false;
  // Applying inert to the drawer may blur its button before the effect runs.
  trigger.focus();
  api.useDialogFocus(true, 'modal', true, { current: summary });
  assert.equal(document.activeElement, cancel);
  cleanups.pop()();
  assert.equal(document.activeElement, summary);
  assert.equal(document.body.style.overflow, 'hidden');
  cleanups.pop()();
  assert.equal(document.activeElement, trigger);
  assert.equal(document.body.style.overflow, 'auto');
  assert.equal(listeners.size, 0);
});

test('category reorder: move, 10-step sortOrder plan with only changed rows, and exact undo', () => {
  const api = load('lib/admin-category-view.ts');
  const plain = (value) => JSON.parse(JSON.stringify(value));
  const ordered = api.inDisplayOrder(categories);
  assert.deepEqual(plain(ordered.map((c) => c.id)), [3, 2, 1], 'ties broken by name: Acoustic before Rock');
  const moved = api.moveItem(ordered, 1, 3);
  assert.deepEqual(plain(moved.map((c) => c.id)), [1, 3, 2]);
  const changes = api.orderChanges(moved);
  assert.deepEqual(plain(changes), [{ id: 1, from: 2, to: 10 }, { id: 3, from: 1, to: 20 }, { id: 2, from: 1, to: 30 }]);
  assert.deepEqual(plain(api.revertChanges(changes)), [{ id: 1, from: 10, to: 2 }, { id: 3, from: 20, to: 1 }, { id: 2, from: 30, to: 1 }]);
  assert.deepEqual(plain(api.orderChanges([{ id: 9, sortOrder: 10 }, { id: 8, sortOrder: 20 }])), [], 'already in plan order: nothing to save');
});

test('fixed genre catalogue: legacy Categories are kept apart, catalogue errors read in Vietnamese', () => {
  const api = load('lib/admin-category-view.ts');
  const items = [{ id: 1, catalog: true }, { id: 30, catalog: false }, { id: 2, catalog: true }];
  const { genres, legacy } = api.splitCatalog(items);
  assert.deepEqual(genres.map((item) => item.id), [1, 2]);
  assert.deepEqual(legacy.map((item) => item.id), [30]);
  assert.equal(api.categoryErrorText({ code: 'CATEGORY_CATALOG_FIXED', message: 'English' }, 'x'), 'Danh sách thể loại là cố định; chỉ bật/tắt và sắp xếp được.');
  assert.equal(api.categoryErrorText({ code: 'CATEGORY_LEGACY_READ_ONLY' }, 'x'), 'Danh mục cũ không bật lại được; hãy dùng một thể loại nhạc.');
  assert.equal(api.categoryErrorText(new Error('Mạng lỗi'), 'x'), 'Mạng lỗi');
});
