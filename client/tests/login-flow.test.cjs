// Run: node --test tests/login-flow.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/login-flow.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const api = {};
vm.runInNewContext(outputText, { exports: api, JSON, Math, Uint8Array, TextDecoder, Intl, atob, URLSearchParams });
const plain = (value) => JSON.parse(JSON.stringify(value));

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenWith = (payload) => `${b64url({ alg: 'RS256' })}.${b64url(payload)}.signature`;

test('the waiting card reads the email claim (including non-ASCII payloads) for display only', () => {
  assert.equal(api.emailFromIdToken(tokenWith({ email: 'an.nguyen@gmail.com', name: 'Nguyễn Văn Ân' })), 'an.nguyen@gmail.com');
});

test('malformed or email-less credentials show no address instead of throwing', () => {
  assert.equal(api.emailFromIdToken('not-a-jwt'), null);
  assert.equal(api.emailFromIdToken('a.%%%.c'), null);
  assert.equal(api.emailFromIdToken(tokenWith({ sub: '123' })), null);
  assert.equal(api.emailFromIdToken(tokenWith({ email: 42 })), null);
});

test('checked-at time is Vietnam wall-clock time', () => {
  assert.equal(api.checkedAtText(new Date('2026-10-19T01:02:03Z')), '08:02:03');
});

test('the last used role is remembered per browser; blocked or odd storage falls back to Quản trị viên', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(api.readLastEntry(storage), 'admin');
  api.saveLastEntry('staff', storage);
  assert.equal(api.readLastEntry(storage), 'staff');
  store.set(api.LAST_ENTRY_KEY, 'superuser');
  assert.equal(api.readLastEntry(storage), 'admin');
  const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.equal(api.readLastEntry(blocked), 'admin');
  assert.doesNotThrow(() => api.saveLastEntry('staff', blocked));
  assert.equal(api.readLastEntry(null), 'admin');
});

test('the reset token is read from the #fragment only, with sane bounds', () => {
  const token = '7.1760000000.' + 'a'.repeat(43);
  assert.equal(api.tokenFromHash('#token=' + encodeURIComponent(token)), token);
  assert.equal(api.tokenFromHash('token=' + token), token);
  assert.equal(api.tokenFromHash(''), null);
  assert.equal(api.tokenFromHash('#token=short'), null);
  assert.equal(api.tokenFromHash('#other=' + token), null);
});

test('reset password rules mirror the server schema and the confirmation must match', () => {
  const failing = (value) => plain(api.resetPasswordChecks(value)).filter((c) => !c.ok).map((c) => c.id);
  assert.deepEqual(failing('new-pass-2@'), []);
  assert.deepEqual(failing('short1!'), ['length']);
  assert.deepEqual(failing('NOLOWER123!'), ['lower']);
  assert.deepEqual(failing('nodigits!!'), ['digit']);
  assert.deepEqual(failing('nospecial12'), ['special']);
  assert.deepEqual(plain(api.resetFormErrors({ next: 'new-pass-2@', confirm: 'new-pass-2@' })), {});
  assert.deepEqual(Object.keys(plain(api.resetFormErrors({ next: 'weak', confirm: '' }))).sort(), ['confirm', 'next']);
  assert.match(api.resetFormErrors({ next: 'new-pass-2@', confirm: 'new-pass-3@' }).confirm, /chưa khớp/);
});
