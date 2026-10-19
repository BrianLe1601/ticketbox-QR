// Run: node --test tests/admin-setup-guide.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, extra = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Intl, Date, Number, String, Math, Object, Set, ...extra });
  return exports;
}
const format = load('admin-format.ts');
const api = load('admin-setup-guide.ts', { require: (name) => (name === './admin-format' ? format : require(name)) });

const now = new Date('2026-10-19T08:00:00Z');
const later = new Date(now.getTime() + 3 * 24 * 3600e3).toISOString();
const earlier = new Date(now.getTime() - 3600e3).toISOString();
const music = { catalog: true, isActive: true };
const other = { catalog: false, isActive: true };
const ev = (id, status, extra = {}) => ({ id, status, validTicketTypeCount: 0, activeStaffCount: 0, checkinEndAt: later, readiness: { ready: false }, ...extra });
const base = { venueConfigured: false, categories: [], events: [], pendingStaff: 0 };
const step = (progress, id) => progress.steps.find((item) => item.id === id);

test('a fresh install starts at the venue and locks Event creation with the reason', () => {
  const progress = api.buildSetupProgress(base, now);
  assert.equal(progress.completed, 0);
  assert.equal(progress.total, 6);
  assert.equal(progress.current, 'venue');
  assert.equal(step(progress, 'event').lockedReason, 'Cần cấu hình địa điểm (bước 1) trước');
  assert.equal(step(progress, 'tickets').lockedReason, 'Cần tạo sự kiện (bước 3) trước');
});

test('only switched-on catalogue genres count; a legacy Category never does (same rule as the server)', () => {
  assert.equal(api.selectableCategoryCount({ categories: [other, { catalog: true, isActive: false }] }), 0);
  assert.equal(api.selectableCategoryCount({ categories: [other, music, music] }), 2);
  const progress = api.buildSetupProgress({ ...base, venueConfigured: true, categories: [other] }, now);
  assert.equal(progress.current, 'categories');
  assert.equal(step(progress, 'event').lockedReason, 'Cần bật ít nhất một thể loại (bước 2)');
  assert.equal(step(progress, 'categories').status, 'Chưa bật thể loại nào');
});

test('with venue and a genre, the next action opens the create form', () => {
  const progress = api.buildSetupProgress({ ...base, venueConfigured: true, categories: [music] }, now);
  assert.equal(progress.current, 'event');
  assert.equal(step(progress, 'event').to, '/admin/events?create=1');
  assert.equal(step(progress, 'event').lockedReason, null);
});

test('a draft without tiers sends the Admin to its ticket types in setup mode', () => {
  const progress = api.buildSetupProgress({ ...base, venueConfigured: true, categories: [music], events: [ev(4, 'draft')] }, now);
  assert.equal(progress.current, 'tickets');
  assert.equal(step(progress, 'tickets').to, '/admin/ticket-types?eventId=4&setup=1');
  assert.equal(step(progress, 'publish').lockedReason, 'Cần thêm hạng vé (bước 4) trước');
});

test('a ready draft is opened for publishing', () => {
  const events = [ev(4, 'draft', { validTicketTypeCount: 1 }), ev(5, 'draft', { validTicketTypeCount: 2, readiness: { ready: true } })];
  const progress = api.buildSetupProgress({ ...base, venueConfigured: true, categories: [music], events }, now);
  assert.equal(progress.current, 'publish');
  assert.equal(step(progress, 'publish').to, '/admin/events?focus=5');
});

test('staff step: an on-sale Event without staff is the remaining task; closed gates do not count', () => {
  const events = [ev(6, 'published', { validTicketTypeCount: 1 }), ev(7, 'ongoing', { validTicketTypeCount: 1, checkinEndAt: earlier })];
  const progress = api.buildSetupProgress({ ...base, venueConfigured: true, categories: [music], events, pendingStaff: 2 }, now);
  assert.equal(progress.current, 'staff');
  assert.equal(step(progress, 'staff').to, '/admin/staff?assignEvent=6');
  assert.equal(step(progress, 'staff').status, '1 sự kiện đang bán chưa có nhân viên · 2 tài khoản chờ duyệt');
});

test('once a gate team was assigned, later unstaffed Events do not reopen setup (the bell tracks them)', () => {
  const events = [ev(6, 'published', { validTicketTypeCount: 1, activeStaffCount: 1 }), ev(9, 'published', { validTicketTypeCount: 1 })];
  const progress = api.buildSetupProgress({ ...base, venueConfigured: true, categories: [music], events }, now);
  assert.equal(progress.current, null);
  assert.equal(step(progress, 'staff').status, '1 sự kiện đang bán chưa có nhân viên');
  assert.equal(step(progress, 'staff').to, '/admin/staff?assignEvent=9');
});

test('everything done: no current step', () => {
  const events = [ev(6, 'published', { validTicketTypeCount: 1, activeStaffCount: 2 }), ev(8, 'cancelled')];
  const progress = api.buildSetupProgress({ ...base, venueConfigured: true, categories: [music], events }, now);
  assert.equal(progress.completed, 6);
  assert.equal(progress.current, null);
});

test('the guide opens by itself only once per session, while unfinished, and never over a deep link', () => {
  const open = (overrides) => api.shouldAutoOpenGuide({ complete: false, dismissed: false, seenThisSession: false, hasDeepLink: false, ...overrides });
  assert.equal(open({}), true);
  assert.equal(open({ complete: true }), false);
  assert.equal(open({ dismissed: true }), false);
  assert.equal(open({ seenThisSession: true }), false);
  assert.equal(open({ hasDeepLink: true }), false);
});
