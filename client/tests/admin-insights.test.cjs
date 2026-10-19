// Run: node --test tests/admin-insights.test.cjs
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
  vm.runInNewContext(outputText, { exports, Intl, Date, Number, String, Math, Object, ...extra });
  return exports;
}
const format = load('admin-format.ts');
const api = load('admin-insights.ts', { require: (name) => (name === './admin-format' ? format : require(name)) });
const plain = (value) => JSON.parse(JSON.stringify(value));

const now = new Date('2026-10-17T12:00:00Z');
const iso = (hours) => new Date(now.getTime() + hours * 3600e3).toISOString();

test('tasks: publish failures and unstaffed events within 48h are urgent and listed first', () => {
  const { tasks, truncated } = api.buildTasks({
    staff: { pendingApproval: 2 },
    refunds: { pendingCount: 1, pendingAmount: 1500000 },
    alerts: {
      unstaffedUpcomingEvents: [{ id: 7, name: 'Đêm nhạc A', startTime: iso(30) }, { id: 8, name: 'Đêm nhạc B', startTime: iso(24 * 5) }],
      scheduledPublishFailedEvents: [{ id: 9, name: 'Đêm nhạc C', publishFailureReason: 'Thiếu hạng vé' }],
    },
  }, now);
  assert.deepEqual(plain(tasks.map((t) => [t.id, t.severity])), [
    ['publish-9', 'urgent'], ['unstaffed-7', 'urgent'], ['unstaffed-8', 'todo'], ['staff-approval', 'todo'], ['refunds', 'todo'],
  ]);
  assert.equal(truncated, false);
  assert.match(tasks.find((t) => t.id === 'refunds').title, /mô phỏng/);
  assert.equal(tasks.find((t) => t.id === 'refunds').detail, 'Tổng 1.500.000 ₫');
  assert.equal(tasks.find((t) => t.id === 'refunds').to, '/admin/orders?view=refunds', 'opens the refund centre');
});

test('tasks: nothing to do yields an empty list, and a full server list is flagged as truncated', () => {
  const empty = { staff: { pendingApproval: 0 }, refunds: { pendingCount: 0, pendingAmount: 0 }, alerts: { unstaffedUpcomingEvents: [], scheduledPublishFailedEvents: [] } };
  assert.equal(api.buildTasks(empty, now).tasks.length, 0);
  assert.equal(api.buildTasks(null, now).tasks.length, 0);
  const five = Array.from({ length: 5 }, (_, i) => ({ id: i, name: `E${i}`, startTime: iso(100) }));
  assert.equal(api.buildTasks({ ...empty, alerts: { ...empty.alerts, unstaffedUpcomingEvents: five } }, now).truncated, true);
});

const event = (id, sold, cap, startHours, extra = {}) => ({ id, name: `E${id}`, status: 'published', startTime: iso(startHours), salesStartAt: iso(-100), salesEndAt: iso(startHours - 1), allocatedCapacity: cap, soldQuantity: sold, ...extra });

test('suggestions: slow sales first, then almost sold out, then sold out; past and empty events ignored', () => {
  const list = api.buildSuggestions([
    event(1, 170, 200, 24 * 10),          // 85% -> almost
    event(2, 10, 100, 24 * 3),            // 10% within 7 days -> slow
    event(3, 50, 50, 24 * 20),            // sold out
    event(4, 10, 100, 24 * 30),           // slow but far away -> nothing
    event(5, 90, 100, -2),                // already started -> ignored
    event(6, 0, 0, 24 * 2),               // no capacity -> ignored
  ], now);
  assert.deepEqual(plain(list.map((s) => s.id)), ['slow-2', 'almost-1', 'soldout-3']);
  assert.equal(list[1].detail, 'E1 · đã bán 85% (170/200)');
  assert.equal(list[0].detail, 'E2 · mới bán 10%, còn 3 ngày');
});

test('suggestions: slow sales only while the sales window is open', () => {
  const closed = event(2, 10, 100, 24 * 3, { salesEndAt: iso(-1) });
  assert.equal(api.buildSuggestions([closed], now).length, 0);
});

test('upcoming: ongoing first, then by start time, past events excluded', () => {
  const list = api.upcomingEvents([event(1, 0, 10, 48), event(2, 0, 10, 5), event(3, 0, 10, -3, { status: 'ongoing' }), event(4, 0, 10, -30)], now);
  assert.deepEqual(plain(list.map((e) => e.id)), [3, 2, 1]);
  assert.equal(api.startsInLabel(iso(5), 'published', now), 'còn 5 giờ');
  assert.equal(api.startsInLabel(iso(50), 'published', now), 'còn 3 ngày');
  assert.equal(api.startsInLabel(iso(0.5), 'published', now), 'còn 30 phút');
  assert.equal(api.startsInLabel(iso(-1), 'ongoing', now), 'Đang diễn ra');
});

test('new-task detection ignores the first snapshot and reports only additions', () => {
  const t = (id) => ({ id });
  assert.equal(api.newTasks(null, [t('a'), t('b')]).length, 0);
  assert.deepEqual(plain(api.newTasks(new Set(['a']), [t('a'), t('b')]).map((x) => x.id)), ['b']);
  assert.equal(api.newTasks(new Set(['a', 'b']), [t('a')]).length, 0);
  assert.deepEqual(plain(api.unseenTasks(new Set(['a']), [t('a'), t('c')]).map((x) => x.id)), ['c']);
});
