// Run: node --test tests/admin-ticket-types.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/admin-ticket-types.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const api = {};
vm.runInNewContext(outputText, { exports: api, Date, Number, String, Math, Object });
const plain = (value) => JSON.parse(JSON.stringify(value));

const now = Date.parse('2026-11-01T00:00:00Z');
const event = (extra = {}) => ({ status: 'published', visibility: 'visible', salesStartAt: '2026-10-01T00:00:00Z', salesEndAt: '2026-11-20T00:00:00Z', endTime: '2026-11-20T15:00:00Z', ...extra });
const tier = (extra = {}) => {
  const t = { isActive: true, capacity: 100, reservedQuantity: 0, soldQuantity: 0, price: 200000, salesStartAt: null, salesEndAt: null, ...extra };
  return { availableQuantity: t.capacity - t.reservedQuantity - t.soldQuantity, ...t };
};

test('default Event: on sale soonest first, then Drafts, then history', () => {
  const list = [
    { id: 1, status: 'cancelled', startTime: '2026-10-01T00:00:00Z' },
    { id: 2, status: 'draft', startTime: '2026-10-02T00:00:00Z' },
    { id: 3, status: 'published', startTime: '2026-12-01T00:00:00Z' },
    { id: 4, status: 'published', startTime: '2026-11-01T00:00:00Z' },
  ];
  assert.equal(api.defaultTierEvent(list).id, 4);
  assert.equal(api.defaultTierEvent(list.filter((e) => e.status !== 'published')).id, 2);
  assert.equal(api.defaultTierEvent([]), null);
});

test('display state: paused, sold out, closed, scheduled and on sale', () => {
  assert.equal(api.tierState(tier({ isActive: false }), event(), now), 'paused');
  assert.equal(api.tierState(tier({ soldQuantity: 100 }), event(), now), 'sold_out');
  assert.equal(api.tierState(tier({ salesStartAt: '2026-10-01T00:00:00Z', salesEndAt: '2026-10-20T00:00:00Z' }), event(), now), 'closed');
  assert.equal(api.tierState(tier({ salesStartAt: '2026-11-05T00:00:00Z' }), event(), now), 'scheduled');
  assert.equal(api.tierState(tier(), event({ salesStartAt: '2026-11-03T00:00:00Z' }), now), 'scheduled', 'inherits the Event window');
  assert.equal(api.tierState(tier(), event(), now), 'active');
});

test('summary cards: counts equal the rows each filter shows', () => {
  const tiers = [tier(), tier({ isActive: false }), tier({ soldQuantity: 100 }), tier({ reservedQuantity: 3 }), tier({ isActive: false, reservedQuantity: 1 })];
  const counts = api.tierCounts(tiers);
  assert.deepEqual(plain(counts), { all: 5, active: 3, paused: 2, soldOut: 1, hasReserved: 2 });
  for (const filter of api.TIER_FILTERS) assert.equal(tiers.filter((t) => api.matchesTierFilter(t, filter)).length, counts[filter], filter);
});

test('inventory adds tiers and never reports negative unallocated seats', () => {
  const inv = api.inventory([tier({ soldQuantity: 10, reservedQuantity: 5 }), tier({ capacity: 50, price: 0 })], 120);
  assert.deepEqual(plain(inv), { venueCapacity: 120, allocated: 150, sold: 10, reserved: 5, available: 135, unallocated: 0, soldValue: 2000000, maxValue: 20000000 });
});

test('price: free in Draft, pause first when active, locked forever after sales', () => {
  assert.equal(api.priceLock(tier(), { status: 'draft' }).allowed, true);
  assert.match(api.priceLock(tier(), { status: 'published' }).reason, /Tạm dừng/);
  assert.equal(api.priceLock(tier({ isActive: false }), { status: 'published' }).allowed, true);
  assert.match(api.priceLock(tier({ isActive: false, soldQuantity: 1 }), { status: 'ongoing' }).reason, /khóa/);
  assert.equal(api.priceLock(null, { status: 'published' }).allowed, true, 'a new tier always sets its price');
});

test('pause/resume follows the server: last visible active tier, sold out, closed window, Draft', () => {
  assert.equal(api.canToggleSales(tier(), event(), 1, now).allowed, true);
  assert.equal(api.canToggleSales(tier(), event(), 0, now).allowed, false, 'last active tier of a visible Event');
  assert.equal(api.canToggleSales(tier(), event({ visibility: 'hidden' }), 0, now).allowed, true);
  assert.equal(api.canToggleSales(tier({ isActive: false, soldQuantity: 100 }), event(), 0, now).allowed, false);
  assert.equal(api.canToggleSales(tier({ isActive: false, salesEndAt: '2026-10-20T00:00:00Z' }), event(), 0, now).allowed, false);
  assert.equal(api.canToggleSales(tier({ isActive: false }), event(), 0, now).allowed, true);
  assert.equal(api.canToggleSales(tier(), event({ status: 'draft' }), 0, now).allowed, false);
  assert.equal(api.canToggleSales(tier(), event({ status: 'completed' }), 0, now).allowed, false);
});

test('delete: unused Draft tiers, or paused unused tiers that keep one active tier visible', () => {
  assert.equal(api.canDeleteTier(tier(), event({ status: 'draft' }), 0).allowed, true);
  assert.equal(api.canDeleteTier(tier({ reservedQuantity: 1 }), event({ status: 'draft' }), 0).allowed, false);
  assert.equal(api.canDeleteTier(tier(), event(), 2).allowed, false, 'pause before delete');
  assert.equal(api.canDeleteTier(tier({ isActive: false }), event(), 1).allowed, true);
  assert.equal(api.canDeleteTier(tier({ isActive: false }), event(), 0).allowed, false);
  assert.equal(api.canDeleteTier(tier({ isActive: false }), event({ status: 'cancelled' }), 1).allowed, false);
});

test('create is blocked for closed Events and when the venue is fully allocated', () => {
  assert.equal(api.canCreateTier(event(), 10, now).allowed, true);
  assert.equal(api.canCreateTier(event(), 0, now).allowed, false);
  assert.equal(api.canCreateTier(event({ status: 'completed' }), 10, now).allowed, false);
  assert.equal(api.canCreateTier(event({ endTime: '2026-10-30T00:00:00Z' }), 10, now).allowed, false);
});

const form = { ...api.EMPTY_TIER_FORM, name: 'Vé VIP', price: '500000', capacity: '50' };
const fields = (errors) => errors.map((e) => e.field);

test('form: valid input passes and maps to the API payload', () => {
  assert.deepEqual(plain(api.validateTierForm(form, { event: event({ status: 'draft' }), editing: null, unallocated: 100 })), []);
  const payload = api.tierPayload({ ...form, description: ' ' }, { status: 'published' }, null);
  assert.equal(payload.isActive, false, 'a new tier of a published Event starts paused');
  assert.equal(payload.description, null);
  assert.equal(payload.salesStartAt, null);
  assert.equal(api.tierPayload(form, { status: 'draft' }, null).isActive, true);
});

test('form: capacity respects unallocated seats, publish lock and committed tickets', () => {
  assert.ok(fields(api.validateTierForm({ ...form, capacity: '101' }, { event: event({ status: 'draft' }), editing: null, unallocated: 100 })).includes('capacity'));
  const editing = tier({ capacity: 50, soldQuantity: 20 });
  assert.equal(api.validateTierForm({ ...form, capacity: '60' }, { event: event(), editing, unallocated: 10 }).length, 0, 'own seats count as room');
  // Own sales window: not after the Event end, and not after check-in end (the gates are closed).
  const custom = { ...form, customSales: true, salesStart: '2026-10-01T10:00', salesEnd: '' };
  const tierEvent = event({ status: 'draft', endTime: '2026-11-20T23:00', checkinEndAt: '2026-11-20T22:00' });
  const salesEndErr = (salesEnd) => api.validateTierForm({ ...custom, salesEnd }, { event: tierEvent, editing: null, unallocated: 100 }).filter((e) => e.field === 'salesEnd').map((e) => e.message);
  assert.deepEqual(plain(salesEndErr('2026-11-20T22:00')), []);
  assert.match(salesEndErr('2026-11-20T22:30')[0], /sau khi đóng check-in/);
  assert.match(salesEndErr('2026-11-20T23:30')[0], /sau khi sự kiện kết thúc/);
  assert.ok(fields(api.validateTierForm({ ...form, capacity: '40' }, { event: event(), editing, unallocated: 10 })).includes('capacity'));
  assert.ok(fields(api.validateTierForm({ ...form, capacity: '10' }, { event: event({ status: 'draft' }), editing, unallocated: 10 })).includes('capacity'));
  assert.equal(api.capacityRoom(10, editing), 60);
  assert.equal(api.capacityPreset(60, 25), 15);
  assert.equal(api.capacityPreset(1, 25), 1);
});

test('form: empty fields, max per order and custom sales window', () => {
  const map = fields(api.validateTierForm({ ...api.EMPTY_TIER_FORM, maxPerOrder: '101', customSales: true }, { event: event(), editing: null, unallocated: 10 }));
  for (const field of ['name', 'price', 'capacity', 'maxPerOrder', 'salesStart', 'salesEnd']) assert.ok(map.includes(field), field);
  assert.ok(fields(api.validateTierForm({ ...form, customSales: true, salesStart: '2026-11-10T10:00', salesEnd: '2026-11-10T09:00' }, { event: event(), editing: null, unallocated: 100 })).includes('salesEnd'));
  assert.ok(fields(api.validateTierForm({ ...form, customSales: true, salesStart: '2026-11-10T10:00', salesEnd: '2026-12-10T09:00' }, { event: event(), editing: null, unallocated: 100 })).includes('salesEnd'));
  assert.equal(api.validateTierForm({ ...form, price: '0' }, { event: event(), editing: null, unallocated: 100 }).length, 0, 'free tier');
});
