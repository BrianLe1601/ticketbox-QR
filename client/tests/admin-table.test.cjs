// Run: node --test tests/admin-table.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/admin-table.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const api = {};
vm.runInNewContext(outputText, { exports: api, Intl, Math, Set, String });

const ids = (list) => Array.from(list, (r) => r.id);
const rows = [
  { id: 1, name: 'Đêm nhạc B', sold: 10 },
  { id: 2, name: 'Đêm nhạc a', sold: null },
  { id: 3, name: 'Ánh sáng', sold: 30 },
  { id: 4, name: 'Đêm nhạc 10', sold: 10 },
  { id: 5, name: 'Đêm nhạc 2', sold: 5 },
];

test('sorting is Vietnamese-aware, numeric-aware and stable; empty values stay last', () => {
  assert.deepEqual(ids(api.sortRows(rows, (r) => r.name, 'asc')), [3, 5, 4, 2, 1]);
  assert.deepEqual(ids(api.sortRows(rows, (r) => r.sold, 'desc')), [3, 1, 4, 5, 2]);
  assert.deepEqual(ids(api.sortRows(rows, (r) => r.sold, 'asc')), [5, 1, 4, 3, 2]);
  assert.deepEqual(ids(api.sortRows(rows, undefined, 'asc')), [1, 2, 3, 4, 5]);
});

test('header sort cycles asc, desc, off', () => {
  let s = api.nextSort(null, 'name');
  assert.deepEqual({ ...s }, { id: 'name', direction: 'asc' });
  s = api.nextSort(s, 'name');
  assert.equal(s.direction, 'desc');
  assert.equal(api.nextSort(s, 'name'), null);
  assert.equal(api.nextSort(s, 'sold').direction, 'asc');
});

test('pagination clamps out-of-range pages and labels the visible range', () => {
  const many = Array.from({ length: 45 }, (_, i) => i + 1);
  assert.deepEqual(Array.from(api.paginate(many, 3, 20)), [41, 42, 43, 44, 45]);
  assert.deepEqual(Array.from(api.paginate(many, 99, 20)), [41, 42, 43, 44, 45]);
  assert.equal(api.pageCount(0, 20), 1);
  assert.equal(api.rangeLabel(2, 20, 45), 'Hiển thị 21–40 / 45');
  assert.equal(api.rangeLabel(1, 20, 0), 'Không có dòng nào');
  assert.equal(api.rangeLabel(1, 20, 1350), 'Hiển thị 1–20 / 1.350');
});

test('select-all only touches the visible page and keeps other pages selected', () => {
  const selected = new Set([99]);
  assert.equal(api.headerSelection([1, 2], selected), 'none');
  const all = api.toggleVisible([1, 2], selected);
  assert.deepEqual([...all].sort(), [1, 2, 99]);
  assert.equal(api.headerSelection([1, 2], all), 'all');
  assert.equal(api.headerSelection([1, 2, 3], all), 'some');
  const cleared = api.toggleVisible([1, 2], all);
  assert.deepEqual([...cleared], [99]);
  assert.deepEqual([...api.toggleOne(5, cleared)].sort(), [5, 99]);
});

test('bulk eligibility reports how many of the selection the action applies to', () => {
  const result = api.eligibility(rows, (r) => r.sold !== null && r.sold >= 10);
  assert.equal(result.label, '3/5');
  assert.deepEqual(ids(result.ineligible), [2, 5]);
});
