// Run with node --test tests/report-service.test.cjs; no new test framework.
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
  vm.runInNewContext(outputText, { exports, URLSearchParams, require: name => overrides[name] ?? require(name), ...globals });
  return exports;
}

function service() {
  const requests = [];
  const exports = load('services/report.service.ts', {
    './api': {
      apiRequest: async (url) => { requests.push(url); return { data: {} }; },
      apiDownload: async (url) => { requests.push(url); return {}; },
    },
  });
  return { services: exports, requests };
}
const filters = { eventId: '7', from: '2026-10-01', to: '2026-10-31', groupBy: 'month', staffId: '9', result: 'INVALID' };
const params = (url) => Object.fromEntries(new URL(url, 'http://localhost').searchParams);
const signal = () => new AbortController().signal;

test('Reports display/export use identical filters, without retained Staff/log filters', async () => {
  const f = service();
  await f.services.loadReport(filters, 1, null, null, signal());
  await f.services.exportOperations('reports', filters, 'SNAP', null);
  const [view, download] = f.requests.map(params);
  assert.deepEqual({ ...view }, { eventId: '7', from: '2026-10-01', to: '2026-10-31', groupBy: 'month', page: '1', limit: '20' });
  assert.deepEqual({ ...download }, { eventId: '7', from: '2026-10-01', to: '2026-10-31', groupBy: 'month', snapshotId: 'SNAP' });
});

test('paging reuses the viewed snapshot so the breakdown never changes underneath the Admin', async () => {
  const f = service();
  await f.services.loadReport(filters, 3, 'S'.repeat(30), null, signal());
  await f.services.loadAdminLogs(filters, 4, 'T'.repeat(30), null, signal());
  const [report, logs] = f.requests.map(params);
  assert.equal(report.page, '3'); assert.equal(report.snapshotId, 'S'.repeat(30));
  assert.equal(logs.page, '4'); assert.equal(logs.snapshotId, 'T'.repeat(30));
});

test('check-in export keeps date/Staff/result filters and the snapshot, without grouping or pagination', async () => {
  const f = service();
  await f.services.loadAdminLogs(filters, 3, null, null, signal());
  await f.services.exportOperations('checkins', filters, 'SNAP', null);
  const [view, download] = f.requests.map(params);
  assert.equal(view.page, '3'); assert.equal(view.limit, '20');
  assert.equal(download.groupBy, undefined);
  assert.equal(download.page, undefined);
  assert.equal(download.limit, undefined);
  assert.deepEqual({ ...download }, { eventId: '7', from: '2026-10-01', to: '2026-10-31', staffId: '9', result: 'INVALID', snapshotId: 'SNAP' });
});

test('an empty Event means "all Events" and empty dates are omitted rather than fabricated', async () => {
  const f = service();
  await f.services.exportOperations('reports', { eventId: '', from: '', to: '', groupBy: 'year' }, null, null);
  await f.services.loadAdminLogs({ eventId: '', from: '', to: '' }, 1, null, null, signal());
  const [report, logs] = f.requests.map(params);
  assert.deepEqual({ ...report }, { groupBy: 'year' });
  assert.deepEqual({ ...logs }, { page: '1', limit: '20' });
});

test('the Event picker requests a server page instead of a fixed 100 rows', async () => {
  const f = service();
  await f.services.searchReportEvents('rock live', 3, null, signal());
  const url = new URL(f.requests[0], 'http://localhost');
  assert.equal(url.pathname, '/admin/reports/events');
  assert.deepEqual({ ...params(f.requests[0]) }, { q: 'rock live', page: '3', limit: '20' });
});

// ------------------------------------------------------------------ pure page helpers

const dates = load('lib/admin-date-range.ts', {}, { Intl, Date });
const reports = load('lib/admin-reports.ts', { './admin-date-range': dates }, { Math });
const plain = (value) => JSON.parse(JSON.stringify(value));
const now = Date.parse('2026-10-17T19:00:00Z'); // 18/10/2026 02:00 in Vietnam

test('report URL filters: "all Events" by default, malformed values dropped, inverted range loses to', () => {
  const read = (query) => plain(reports.reportFiltersFromParams(new URLSearchParams(query)));
  assert.deepEqual(read(''), { eventId: '', from: '', to: '', groupBy: 'day' });
  assert.deepEqual(read('eventId=7&from=2026-10-01&to=2026-10-31&groupBy=month'), { eventId: '7', from: '2026-10-01', to: '2026-10-31', groupBy: 'month' });
  assert.deepEqual(read('eventId=x&from=bad&groupBy=week'), { eventId: '', from: '', to: '', groupBy: 'day' });
  assert.equal(read('from=2026-10-02&to=2026-10-01').to, '');
  const filters = { eventId: '3', from: '', to: '2026-10-05', groupBy: 'year' };
  assert.deepEqual(plain(reports.reportFiltersFromKey(reports.reportKey(filters))), filters);
});

test('presets are inclusive Vietnam days; the report offers month and year', () => {
  assert.equal(dates.vnDay(now), '2026-10-18');
  assert.deepEqual(plain(dates.presetRange('month', now)), { from: '2026-10-01', to: '2026-10-18' });
  assert.deepEqual(plain(dates.presetRange('year', now)), { from: '2026-01-01', to: '2026-10-18' });
  assert.deepEqual(plain(dates.presetRange('7d', now)), { from: '2026-10-12', to: '2026-10-18' });
  const offered = ['all', '7d', '30d', 'month', 'year'];
  assert.equal(dates.presetOf({ from: '2026-10-01', to: '2026-10-18' }, now, offered), 'month');
  assert.equal(dates.presetOf({ from: '2026-10-18', to: '2026-10-18' }, now, offered), 'custom'); // "today" not offered here
  assert.equal(dates.rangeText({ from: '', to: '2026-10-05' }), 'Đến hết 05/10/2026');
});

test('period labels follow the selected grouping', () => {
  assert.equal(reports.periodLabel('2026-10-06', 'day'), '06/10');
  assert.equal(reports.periodTitle('2026-10-06', 'day'), '06/10/2026');
  assert.equal(reports.periodLabel('2026-10', 'month'), '10/2026');
  assert.equal(reports.periodTitle('2026-10', 'month'), 'Tháng 10/2026');
  assert.equal(reports.periodTitle('2026', 'year'), 'Năm 2026');
});

test('ticket path uses the server totals and scales bars to the largest value (attendance may exceed sales)', () => {
  const steps = plain(reports.ticketFunnel({ capacity: 1010, soldTickets: 15, issuedTickets: 15, admissions: 6 }));
  assert.deepEqual(steps.map((s) => [s.key, s.value]), [['capacity', 1010], ['sold', 15], ['issued', 15], ['admitted', 6]]);
  assert.equal(steps[0].share, 1);
  const over = plain(reports.ticketFunnel({ capacity: 0, soldTickets: 4, issuedTickets: 4, admissions: 5 }));
  assert.equal(over[3].share, 1); // date-filtered admissions above sales still draw within the card
  assert.equal(reports.rejectedShare({ scans: 0, rejectedScans: 0 }), 0);
  assert.equal(reports.rejectedShare({ scans: 8, rejectedScans: 2 }), 0.25);
});

test('Excel file names describe scope, range and grouping in ASCII', () => {
  assert.equal(reports.reportFileName({ eventId: '', from: '', to: '', groupBy: 'day' }, now), 'bao-cao_tat-ca-su-kien_xuat_2026-10-18_theo-ngay.xlsx');
  assert.equal(reports.reportFileName({ eventId: '7', from: '2026-10-01', to: '2026-10-31', groupBy: 'month' }, now), 'bao-cao_su-kien-7_2026-10-01_den_2026-10-31_theo-thang.xlsx');
});
