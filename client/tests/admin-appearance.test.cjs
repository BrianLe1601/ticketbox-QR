// Run: node --test tests/admin-appearance.test.cjs; no DOM or database required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(blocked = false) {
  const values = new Map();
  const localStorage = {
    getItem(key) { if (blocked) throw new Error('Blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Blocked'); values.set(key, value); },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/admin-appearance.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, localStorage });
  return { api: exports, values };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('default appearance and font sizes are readable without stored data', () => {
  const { api } = fixture();
  assert.deepEqual(plain(api.readAdminAppearance(1)), { font: 'system', size: 'default' });
  assert.deepEqual(plain(api.adminFontSizes), { small: 14, default: 15, large: 17 });
});

test('preferences persist per account; reset does not affect another account', () => {
  const { api } = fixture();
  assert.equal(api.writeAdminAppearance(1, { font: 'arial', size: 'large' }), true);
  api.writeAdminAppearance(2, { font: 'serif', size: 'small' });
  assert.deepEqual(plain(api.readAdminAppearance(1)), { font: 'arial', size: 'large' });
  api.writeAdminAppearance(1, api.defaultAdminAppearance);
  assert.deepEqual(plain(api.readAdminAppearance(1)), { font: 'system', size: 'default' });
  assert.deepEqual(plain(api.readAdminAppearance(2)), { font: 'serif', size: 'small' });
});

test('invalid, corrupt and prototype keys fall back safely', () => {
  const { api, values } = fixture();
  for (const value of ['broken', 'null', '42', '{}', '{"font":"system","size":"huge"}', '{"font":"__proto__","size":"large"}']) {
    values.set('ticketbox:admin-appearance:1', value);
    assert.deepEqual(plain(api.readAdminAppearance(1)), { font: 'system', size: 'default' });
  }
});

test('blocked storage never throws on read and reports failed persistence', () => {
  const { api } = fixture(true);
  assert.deepEqual(plain(api.readAdminAppearance(1)), { font: 'system', size: 'default' });
  assert.equal(api.writeAdminAppearance(1, { font: 'arial', size: 'large' }), false);
});
