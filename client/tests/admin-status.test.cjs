// Run: node --test tests/admin-status.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/admin-status.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const api = {};
vm.runInNewContext(outputText, { exports: api, Object, String });

const schema = fs.readFileSync(path.join(__dirname, '../../database/migrations/001_initial_schema.sql'), 'utf8');
const enumOf = (column, after) => {
  const start = after ? schema.indexOf(after) : 0;
  const match = schema.slice(start).match(new RegExp(`${column}\\s+ENUM\\(([^)]*)\\)`));
  return match[1].split(',').map((v) => v.trim().replace(/'/g, ''));
};

test('every persisted lifecycle value has a Vietnamese label (no "Không rõ")', () => {
  const cases = [
    ['event', enumOf('status', 'CREATE TABLE events')],
    ['visibility', enumOf('visibility', 'CREATE TABLE events')],
    ['order', enumOf('status', 'CREATE TABLE orders')],
    ['ticket', enumOf('status', 'CREATE TABLE tickets')],
    ['payment', enumOf('status', 'CREATE TABLE payments')],
    ['refund', enumOf('status', 'CREATE TABLE refunds')],
    ['scan', enumOf('result_code', 'CREATE TABLE checkin_logs')],
    ['email', enumOf('status', 'CREATE TABLE email_logs')],
  ];
  for (const [domain, values] of cases) {
    assert.ok(values.length > 1, `${domain} enum parsed`);
    for (const value of values) {
      const style = api.statusStyle(domain, value);
      assert.doesNotMatch(style.label, /Không rõ/, `${domain}.${value}`);
    }
  }
});

test('money states always say they are simulated', () => {
  for (const domain of ['payment', 'refund']) {
    for (const value of api.statusValues(domain).filter((v) => v !== 'not_required')) {
      assert.match(api.statusStyle(domain, value).label, /mô phỏng/, `${domain}.${value}`);
    }
  }
});

test('unknown values are shown honestly instead of guessed', () => {
  assert.deepEqual({ ...api.statusStyle('order', 'refunded') }, { label: 'Không rõ (refunded)', tone: 'neutral' });
  assert.equal(api.statusStyle('event', null).label, 'Không rõ');
});

test('staff state follows approval first, then the active flag', () => {
  assert.equal(api.staffState('pending', false), 'pending');
  assert.equal(api.staffState('rejected', false), 'rejected');
  assert.equal(api.staffState('approved', true), 'active');
  assert.equal(api.staffState('approved', false), 'inactive');
});

test('only duplicate, fake and wrong-event scans raise a gate alert', () => {
  assert.equal(api.isScanAlert('INVALID'), true);
  assert.equal(api.isScanAlert('ALREADY_CHECKED_IN'), true);
  assert.equal(api.isScanAlert('WRONG_EVENT'), true);
  assert.equal(api.isScanAlert('SUCCESS'), false);
  assert.equal(api.isScanAlert('EVENT_NOT_AVAILABLE'), false);
});
