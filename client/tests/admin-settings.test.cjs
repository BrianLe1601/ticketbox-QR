// Run: node --test tests/admin-settings.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/admin-settings.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const api = {};
vm.runInNewContext(outputText, { exports: api, Number, String, Object });
const plain = (value) => JSON.parse(JSON.stringify(value));

const venue = { name: 'Nhà hát Hòa Bình', address: '240 Đường 3/2', city: 'TP.HCM', capacity: 2000 };

test('tabs come from the URL; anything unknown opens Hệ thống', () => {
  assert.equal(api.tabFromParam('account'), 'account');
  assert.equal(api.tabFromParam('appearance'), 'appearance');
  assert.equal(api.tabFromParam('billing'), 'system');
  assert.equal(api.tabFromParam(null), 'system');
});

test('venue form: dirty tracking ignores surrounding spaces, and no venue is always unsaved', () => {
  const form = api.venueFormOf(venue);
  assert.equal(api.venueDirty(venue, form), false);
  assert.equal(api.venueDirty(venue, { ...form, name: '  Nhà hát Hòa Bình ' }), false);
  assert.equal(api.venueDirty(venue, { ...form, capacity: '1800' }), true);
  assert.equal(api.venueDirty(null, plain(api.EMPTY_VENUE)), true);
  assert.deepEqual(plain(api.venuePayload({ ...form, city: ' Hà Nội ' })), { ...venue, city: 'Hà Nội' });
});

test('venue validation mirrors the server schema (1..1.000.000 seats, required text)', () => {
  assert.deepEqual(plain(api.validateVenue(api.venueFormOf(venue))), {});
  assert.deepEqual(Object.keys(plain(api.validateVenue({ name: ' ', address: '', city: '', capacity: '' }))).sort(), ['address', 'capacity', 'city', 'name']);
  assert.match(api.validateVenue({ ...api.venueFormOf(venue), capacity: '0' }).capacity, /từ 1/);
  assert.match(api.validateVenue({ ...api.venueFormOf(venue), capacity: '1000001' }).capacity, /1\.000\.000/);
  assert.equal(api.validateVenue({ ...api.venueFormOf(venue), capacity: '1000000' }).capacity, undefined);
});

test('venue impact explains that existing Events keep their snapshot', () => {
  assert.match(api.venueImpact({ venue: null, outOfSyncEventCount: 0 }, api.venueFormOf(venue)), /có thể tạo sự kiện mới/);
  assert.match(api.venueImpact({ venue, outOfSyncEventCount: 0 }, { ...api.venueFormOf(venue), capacity: '1500' }), /Sức chứa giảm không làm giảm số vé/);
  assert.doesNotMatch(api.venueImpact({ venue, outOfSyncEventCount: 0 }, { ...api.venueFormOf(venue), capacity: '2500' }), /Sức chứa giảm/);
});

test('scope counts: selectable music genres, other active ones, and legacy kept for history', () => {
  const cats = [
    { isActive: true, kind: 'music' }, { isActive: true, kind: 'music' }, { isActive: false, kind: 'music' },
    { isActive: true, kind: 'other' }, { isActive: false, kind: 'other' },
  ];
  assert.deepEqual(plain(api.scopeCounts(cats)), { music: 2, otherActive: 1, legacy: 2 });
});

test('password checklist and form errors follow the server rules', () => {
  const ok = (next, current = 'old-pass-1!') => plain(api.passwordChecks(next, current)).filter((c) => !c.ok).map((c) => c.id);
  assert.deepEqual(ok('new-pass-2@'), []);
  assert.deepEqual(ok('short1!'), ['length']);
  assert.deepEqual(ok('NOLOWER123!'), ['lower']);
  assert.deepEqual(ok('nodigits!!'), ['digit']);
  assert.deepEqual(ok('nospecial12'), ['special']);
  assert.deepEqual(ok('old-pass-1!'), ['different']);
  assert.deepEqual(plain(api.passwordFormErrors({ current: 'old-pass-1!', next: 'new-pass-2@', confirm: 'new-pass-2@' })), {});
  const bad = plain(api.passwordFormErrors({ current: '123', next: 'weak', confirm: 'other' }));
  assert.deepEqual(Object.keys(bad).sort(), ['confirm', 'current', 'next']);
  assert.equal(api.profileError(' A '), 'Họ tên phải có ít nhất 2 ký tự.');
  assert.equal(api.profileError('Lê Kim Bửu'), '');
});
