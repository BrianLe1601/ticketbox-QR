// Run: node --test tests/admin-format.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/admin-format.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const api = {};
vm.runInNewContext(outputText, { exports: api, Intl, Date, Number, String, Math });

test('money uses Vietnamese grouping and the đồng sign', () => {
  assert.equal(api.formatMoney(1500000), '1.500.000 ₫');
  assert.equal(api.formatMoney(0), '0 ₫');
  assert.equal(api.formatMoney(null), '0 ₫');
});

test('compact money keeps one unit family and the sign for refunds', () => {
  assert.equal(api.formatMoneyCompact(850000), '850 N ₫');
  assert.equal(api.formatMoneyCompact(36000000), '36 Tr ₫');
  assert.equal(api.formatMoneyCompact(-700000), '-700 N ₫');
  assert.equal(api.formatMoneyCompact(1200000000), '1,2 Tỷ ₫');
});

test('dates are shown in Vietnam time regardless of the machine zone', () => {
  assert.equal(api.formatDateTime('2026-10-17T12:30:00Z'), '17/10/2026 19:30');
  assert.equal(api.formatDate('2026-10-17T18:00:00Z'), '18/10/2026');
  assert.equal(api.formatTime('2026-10-17T12:30:05Z', true), '19:30:05');
  assert.equal(api.formatDateTime(null), '');
  assert.equal(api.formatDateTime('not a date'), '');
});

test('initials drop brackets, digits and symbols before taking letters', () => {
  assert.equal(api.initials('[DEMO] 1 Nguyễn Văn An'), 'NA');
  assert.equal(api.initials('[0] Trần Bình'), 'TB');
  assert.equal(api.initials('Đặng'), 'ĐẶ');
  assert.equal(api.initials('123 !!'), '?');
  assert.equal(api.initials(''), '?');
});

test('percent accepts either a percentage or a ratio', () => {
  assert.equal(api.formatPercent(45.67), '45,7%');
  assert.equal(api.formatPercent(0.4567, true), '45,7%');
});
