// Run: node --test tests/theme.test.cjs; no DOM or browser required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ blocked = false, corrupt = false } = {}) {
  const values = new Map();
  const events = [];
  const localStorage = {
    getItem(key) { if (blocked) throw new Error('Blocked'); return corrupt ? '{"theme":' : values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Blocked'); values.set(key, value); },
  };
  const window = { localStorage, dispatchEvent(event) { events.push(event.type); }, addEventListener() {}, removeEventListener() {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/ticketbox-theme.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, window, Event: class { constructor(type) { this.type = type; } }, require: (name) => name === 'react' ? { useCallback: (fn) => fn, useSyncExternalStore: () => 'light' } : require(name) });
  return { api: exports, values, events };
}

test('light is the default for every scope and account', () => {
  const { api } = fixture();
  for (const scope of ['admin', 'staff', 'login']) assert.equal(api.readTheme(scope, 7), 'light');
  assert.equal(api.readTheme('login'), 'light');
});

test('the choice is namespaced by scope and account so it cannot leak between roles', () => {
  const { api, values } = fixture();
  assert.equal(api.writeTheme('admin', 'dark', 7), true);
  assert.equal(api.readTheme('admin', 7), 'dark');
  assert.equal(api.readTheme('admin', 8), 'light');
  assert.equal(api.readTheme('staff', 7), 'light');
  assert.equal(api.readTheme('login'), 'light');
  // The account-free boot key only lets index.html paint the right Admin background early.
  assert.deepEqual([...values.keys()], ['ticketbox:theme:admin:7', 'ticketbox:theme:admin:last']);
  api.writeTheme('staff', 'dark', 7);
  assert.equal(values.get('ticketbox:theme:admin:last'), 'dark');
  assert.equal(values.has('ticketbox:theme:staff:7'), true);
});

test('auto follows the Vietnam clock, not the OS or the UTC clock', () => {
  const { api } = fixture();
  const at = (utc) => new Date(`2026-10-17T${utc}:00Z`);
  assert.equal(api.vietnamHour(at('23:00')), 6);
  assert.equal(api.resolveTheme('auto', at('22:59')), 'dark');   // 05:59 VN
  assert.equal(api.resolveTheme('auto', at('23:00')), 'light');  // 06:00 VN
  assert.equal(api.resolveTheme('auto', at('10:59')), 'light');  // 17:59 VN
  assert.equal(api.resolveTheme('auto', at('11:00')), 'dark');   // 18:00 VN
  assert.equal(api.resolveTheme('light', at('15:00')), 'light');
  assert.equal(api.resolveTheme('dark', at('03:00')), 'dark');
});

test('auto is stored as a preference and a manual choice replaces it', () => {
  const { api } = fixture();
  assert.equal(api.readThemePreference('admin', 2), 'light');
  api.writeTheme('admin', 'auto', 2);
  assert.equal(api.readThemePreference('admin', 2), 'auto');
  api.writeTheme('admin', 'dark', 2);
  assert.equal(api.readThemePreference('admin', 2), 'dark');
  assert.equal(api.readTheme('admin', 2), 'dark');
});

test('changing the theme notifies subscribers in this tab', () => {
  const { api, events } = fixture();
  api.writeTheme('staff', 'dark', 3);
  assert.deepEqual(events, ['ticketbox-theme-change']);
});

test('blocked storage still switches the theme for the current page and reports it was not saved', () => {
  const { api } = fixture({ blocked: true });
  assert.equal(api.readTheme('admin', 1), 'light');
  assert.equal(api.writeTheme('admin', 'dark', 1), false);
  assert.equal(api.readTheme('admin', 1), 'dark');
});

test('corrupt or unexpected stored values fall back to light', () => {
  const { api } = fixture({ corrupt: true });
  assert.equal(api.readTheme('admin', 1), 'light');
  const other = fixture();
  other.values.set('ticketbox:theme:admin:1', 'purple');
  assert.equal(other.api.readTheme('admin', 1), 'light');
});
