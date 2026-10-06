// Run with node --test tests/report-service.test.cjs; no new test framework.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const requests = [], exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/services/report.service.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, { exports, URLSearchParams, require(name) {
    assert.equal(name, './api');
    return {
      apiRequest: async (url) => { requests.push(url); return { data: {} }; },
      apiDownload: async (url) => { requests.push(url); return {}; },
    };
  } });
  return { services: exports, requests };
}
const filters = { eventId: '7', from: '2026-10-01', to: '2026-10-31', groupBy: 'month', staffId: '9', result: 'INVALID' };

test('Reports display/export use identical filters without retained Staff/log filters or pagination', async () => {
  const f = fixture();
  await f.services.loadReport(filters, null, new AbortController().signal);
  await f.services.exportOperations('reports', filters, null);
  const [view, download] = f.requests.map((url) => new URL(url, 'http://localhost'));
  assert.equal(view.search, download.search);
  assert.deepEqual(Object.fromEntries(download.searchParams), {
    eventId: '7', from: '2026-10-01', to: '2026-10-31', groupBy: 'month',
  });
});

test('Check-in export retains date/Staff/result filters but exports all pages without report grouping', async () => {
  const f = fixture();
  await f.services.loadAdminLogs(filters, 3, null, new AbortController().signal);
  await f.services.exportOperations('checkins', filters, null);
  const [view, download] = f.requests.map((url) => new URL(url, 'http://localhost'));
  assert.equal(view.searchParams.get('page'), '3');
  assert.equal(view.searchParams.get('limit'), '20');
  view.searchParams.delete('page'); view.searchParams.delete('limit');
  assert.equal(view.search, download.search);
  assert.equal(download.searchParams.has('groupBy'), false);
  assert.equal(download.searchParams.get('staffId'), '9');
  assert.equal(download.searchParams.get('result'), 'INVALID');
});

test('empty optional dates are omitted rather than replaced with a fabricated range', async () => {
  const f = fixture();
  await f.services.exportOperations('reports', { eventId: '7', from: '', to: '', groupBy: 'year' }, null);
  assert.deepEqual(Object.fromEntries(new URL(f.requests[0], 'http://localhost').searchParams), { eventId: '7', groupBy: 'year' });
});

// Lightweight hook/JSX harness, matching the existing client test approach.
// Verifies UI state/handlers, not browser layout or a real Excel download.
function renderReports({ pending = false, loadedEvent = 7 } = {}) {
  let cursor = 0, exportCalls = 0;
  const applied = { eventId: '7', from: '2026-10-01', to: '2026-10-31', groupBy: 'month' };
  const overrides = {
    5: { ...applied, to: pending ? '2026-10-07' : applied.to },
    6: applied, 7: { id: loadedEvent, name: 'Demo' },
  };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react: {
      useState(initial) { const index = cursor++; return [Object.hasOwn(overrides, index) ? overrides[index] : initial, () => {}]; },
      useEffect() {}, useMemo(fn) { return fn(); },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': {}, recharts: {},
    '@/context/AuthContext': { useAuth: () => ({ token: null }) },
    '@/lib/utils': { digitsOnly: value => value },
    '@/services/report.service': { exportOperations: async () => { exportCalls++; return {}; } },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/admin/AdminOperationsPage.tsx'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require(name) {
    assert.ok(name in dependencies, `Unexpected import: ${name}`); return dependencies[name];
  } });
  const tree = exports.AdminOperationsPage({ kind: 'reports' });
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const result = find(child, predicate); if (result) return result;
    }
  };
  return {
    button: find(tree, node => node.type === 'button' && [node.props.children].flat(Infinity).includes('Xuất Excel')),
    warning: find(tree, node => node.props?.role === 'status'),
    exportCalls: () => exportCalls,
  };
}

test('changed but unapplied filters disable export and show an apply-filter instruction', () => {
  const page = renderReports({ pending: true });
  assert.equal(page.button.props.disabled, true);
  assert.match(page.warning.props.children, /Áp dụng bộ lọc/);
  page.button.props.onClick();
  assert.equal(page.exportCalls(), 0);
});

test('export is enabled only when displayed report and applied Event agree', () => {
  assert.equal(renderReports().button.props.disabled, false);
  const stale = renderReports({ loadedEvent: 8 });
  assert.equal(stale.button.props.disabled, true);
  stale.button.props.onClick();
  assert.equal(stale.exportCalls(), 0);
});
