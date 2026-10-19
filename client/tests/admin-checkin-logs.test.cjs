// Run: node --test tests/admin-checkin-logs.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (name) => modules[name], Date, Intl, Math, Number, String, Object });
  return exports;
}
const dates = load('admin-date-range.ts');
const api = { ...load('admin-checkin-logs.ts', { './admin-date-range': dates }), ...dates };
const plain = (value) => JSON.parse(JSON.stringify(value));

// 2026-10-18 02:00 in Vietnam is still 2026-10-17 in UTC.
const now = Date.parse('2026-10-17T19:00:00Z');

test('URL filters: unknown or malformed values are dropped, inverted ranges lose "to"', () => {
  const read = (query) => plain(api.filtersFromParams(new URLSearchParams(query)));
  assert.deepEqual(read('eventId=12&from=2026-10-01&to=2026-10-18&staffId=5&result=FAILED'),
    { eventId: '12', from: '2026-10-01', to: '2026-10-18', staffId: '5', result: 'FAILED' });
  assert.deepEqual(read('eventId=abc&from=hôm-nay&staffId=-1&result=PAID'), { eventId: '', from: '', to: '', staffId: '', result: '' });
  assert.equal(read('from=2026-10-18&to=2026-10-01').to, '');
  assert.equal(api.resultFromParam('ALREADY_CHECKED_IN'), 'ALREADY_CHECKED_IN');
});

test('the snapshot key round-trips the filters it was built from', () => {
  const filters = { eventId: '3', from: '2026-10-01', to: '', staffId: '', result: 'SUCCESS' };
  assert.deepEqual(plain(api.filtersFromKey(api.filterKey(filters))), filters);
  assert.notEqual(api.filterKey(filters), api.filterKey({ ...filters, result: '' }));
});

test('date presets are inclusive Vietnam days ending today', () => {
  assert.equal(api.vnDay(now), '2026-10-18');
  assert.deepEqual(plain(api.presetRange('today', now)), { from: '2026-10-18', to: '2026-10-18' });
  assert.deepEqual(plain(api.presetRange('7d', now)), { from: '2026-10-12', to: '2026-10-18' });
  assert.deepEqual(plain(api.presetRange('30d', now)), { from: '2026-09-19', to: '2026-10-18' });
  assert.equal(api.presetOf({ from: '', to: '' }, now), 'all');
  assert.equal(api.presetOf({ from: '2026-10-12', to: '2026-10-18' }, now), '7d');
  assert.equal(api.presetOf({ from: '2026-10-01', to: '' }, now), 'custom');
  assert.equal(api.rangeText({ from: '2026-10-18', to: '2026-10-18' }), 'Ngày 18/10/2026');
  assert.equal(api.rangeText({ from: '2026-10-01', to: '' }), 'Từ 01/10/2026');
  assert.equal(api.rangeText({ from: '', to: '' }), 'Toàn bộ thời gian');
});

test('summary cards map to the server stats; "lý do khác" is the rest of the rejections', () => {
  const stats = { total: 10, success: 6, rejected: 4, duplicate: 1, invalid: 2 };
  assert.deepEqual(plain(api.RESULT_SEGMENTS.map((s) => [s.key, stats[s.stat]])), [['', 10], ['SUCCESS', 6], ['FAILED', 4], ['ALREADY_CHECKED_IN', 1], ['INVALID', 2]]);
  assert.equal(api.shareOf(stats, 'success'), 0.6);
  assert.equal(api.shareOf({ ...stats, total: 0 }, 'success'), 0);
  assert.equal(api.otherRejected(stats), 1);
  assert.equal(api.resultLabel('WRONG_EVENT'), 'Vé của sự kiện khác');
  assert.equal(api.resultLabel('NEW_CODE'), 'NEW_CODE');
});

test('export file names are ASCII and describe scope and range', () => {
  assert.equal(api.exportFileName({ eventId: '', from: '', to: '' }, now), 'nhat-ky-check-in_tat-ca-su-kien_xuat_2026-10-18.xlsx');
  assert.equal(api.exportFileName({ eventId: '7', from: '2026-10-01', to: '' }, now), 'nhat-ky-check-in_su-kien-7_tu_2026-10-01.xlsx');
  assert.equal(api.exportFileName({ eventId: '54', from: '2026-10-18', to: '2026-10-18' }, now), 'nhat-ky-check-in_su-kien-54_2026-10-18.xlsx');
  assert.equal(api.exportFileName({ eventId: '', from: '2026-10-01', to: '2026-10-18' }, now), 'nhat-ky-check-in_tat-ca-su-kien_2026-10-01_den_2026-10-18.xlsx');
});
