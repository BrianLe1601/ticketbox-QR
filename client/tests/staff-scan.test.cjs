// Run: node --test tests/staff-scan.test.cjs; no DOM required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Date, require: (name) => require(name) });
  return exports;
}
const { scanVerdict, gateWindow } = load('components/checkin/scan-verdict.ts');
const CODES = ['SUCCESS', 'ALREADY_CHECKED_IN', 'WRONG_EVENT', 'CANCELLED', 'UNPAID', 'INVALID', 'EVENT_NOT_AVAILABLE', 'STAFF_NOT_ASSIGNED'];

test('only SUCCESS lets a ticket holder in', () => {
  assert.deepEqual(CODES.filter((code) => scanVerdict(code).allow), ['SUCCESS']);
  assert.equal(scanVerdict('SUCCESS').label, 'CHO VÀO');
});

test('every outcome has its own words, so the verdict never depends on colour alone', () => {
  const labels = CODES.map((code) => scanVerdict(code).label);
  assert.equal(new Set(labels).size, CODES.length);
  for (const label of labels) assert.match(label, /^[A-ZÀ-Ỹ -]+$/u);
});

test('tones separate a used ticket from a refusal and from a success', () => {
  assert.equal(scanVerdict('SUCCESS').tone, 'success');
  assert.equal(scanVerdict('ALREADY_CHECKED_IN').tone, 'warning');
  assert.equal(scanVerdict('EVENT_NOT_AVAILABLE').tone, 'warning');
  for (const code of ['WRONG_EVENT', 'CANCELLED', 'UNPAID', 'INVALID', 'STAFF_NOT_ASSIGNED']) assert.equal(scanVerdict(code).tone, 'failed', code);
});

test('a missing or unrecognised result is never shown as accepted', () => {
  for (const missing of [undefined, null, 'SOMETHING_NEW']) {
    const verdict = scanVerdict(missing);
    assert.equal(verdict.allow, false);
    assert.equal(verdict.tone, 'failed');
    assert.equal(verdict.label, 'CHƯA XÁC ĐỊNH');
  }
});

test('the gate window is shown in Vietnam time', () => {
  assert.equal(gateWindow('2026-10-17T06:00:00.000Z', '2026-10-17T09:30:00.000Z').replace(/ /g, ' '), '13:00 – 16:30');
});
