// Run: node --test tests/admin-gate.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/admin-gate.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const api = {};
vm.runInNewContext(outputText, { exports: api, Date, Number, Math });

const event = (status, start, end) => ({ status, checkinStartAt: start, checkinEndAt: end });
const now = new Date('2026-10-17T12:00:00Z');

test('the gate is open only for published/ongoing events inside the closed window', () => {
  assert.equal(api.isGateOpen(event('ongoing', '2026-10-17T11:00:00Z', '2026-10-17T15:00:00Z'), now), true);
  assert.equal(api.isGateOpen(event('published', '2026-10-17T12:00:00Z', '2026-10-17T15:00:00Z'), now), true);
  assert.equal(api.isGateOpen(event('published', '2026-10-17T09:00:00Z', '2026-10-17T12:00:00Z'), now), true);
  assert.equal(api.isGateOpen(event('published', '2026-10-17T12:00:01Z', '2026-10-17T15:00:00Z'), now), false);
  assert.equal(api.isGateOpen(event('cancelled', '2026-10-17T11:00:00Z', '2026-10-17T15:00:00Z'), now), false);
  assert.equal(api.isGateOpen(event('draft', '2026-10-17T11:00:00Z', '2026-10-17T15:00:00Z'), now), false);
  assert.equal(api.isGateOpen(event('ongoing', 'bad', '2026-10-17T15:00:00Z'), now), false);
});

test('next boundary tells when the badge must be re-evaluated', () => {
  const list = [event('published', '2026-10-17T13:00:00Z', '2026-10-17T15:00:00Z'), event('ongoing', '2026-10-17T11:00:00Z', '2026-10-17T12:30:00Z')];
  assert.equal(api.nextGateBoundary(list, now), 30 * 60 * 1000 + 1);
  assert.equal(api.nextGateBoundary([], now), null);
  assert.equal(api.openGateEvents(list, now).length, 1);
});
