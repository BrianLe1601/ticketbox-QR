// Run: node --test tests/admin-staff.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, extra = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Date, Number, String, Math, Object, ...extra });
  return exports;
}
const status = load('admin-status.ts');
const api = load('admin-staff.ts', { require: (name) => (name === '@/lib/admin-status' ? status : require(name)) });
const plain = (value) => JSON.parse(JSON.stringify(value));

const now = Date.parse('2026-11-01T00:00:00Z');
const asg = (eventId, start, end, extra = {}) => ({ id: eventId * 10, eventId, eventName: `Event ${eventId}`, eventStatus: 'published', checkinStartAt: start, checkinEndAt: end, isActive: true, ...extra });
const person = (id, approvalStatus, isActive, extra = {}) => ({ id, fullName: `Nguyễn Văn ${id}`, email: `staff${id}@ticketbox.local`, approvalStatus, isActive, assignments: [], ...extra });
const people = [
  person(1, 'pending', false),
  person(2, 'approved', true, { assignments: [asg(7, '2026-11-10T09:00:00Z', '2026-11-10T14:00:00Z')] }),
  person(3, 'approved', true, { fullName: 'Trần Thị Mai' }),
  person(4, 'approved', false),
  person(5, 'rejected', false),
];

test('segments: counts equal the rows each segment shows', () => {
  const counts = api.segmentCounts(people);
  assert.deepEqual(plain(counts), { all: 5, pending: 1, active: 2, inactive: 1, rejected: 1 });
  for (const segment of api.STAFF_SEGMENTS) assert.equal(api.filterStaff(people, { segment, query: '', eventId: null }).length, counts[segment], segment);
});

test('old ?tab values still open the right segment', () => {
  assert.equal(api.segmentFromParam('pending'), 'pending');
  assert.equal(api.segmentFromParam('disabled'), 'inactive');
  assert.equal(api.segmentFromParam('nope'), 'all');
  assert.equal(api.segmentFromParam(null), 'all');
});

test('search (name/email, accents, case) and Event filter combine with the segment', () => {
  assert.deepEqual(plain(api.filterStaff(people, { segment: 'all', query: '  TRẦN thị ', eventId: null }).map((p) => p.id)), [3]);
  assert.deepEqual(plain(api.filterStaff(people, { segment: 'all', query: 'staff5@', eventId: null }).map((p) => p.id)), [5]);
  assert.deepEqual(plain(api.filterStaff(people, { segment: 'active', query: '', eventId: 7 }).map((p) => p.id)), [2]);
  assert.equal(api.filterStaff(people, { segment: 'pending', query: '', eventId: 7 }).length, 0);
});

test('row actions follow approval first, then the active flag', () => {
  assert.deepEqual(plain(api.availableActions(people[0])), ['approve', 'reject']);
  assert.deepEqual(plain(api.availableActions(people[1])), ['deactivate']);
  assert.deepEqual(plain(api.availableActions(people[3])), ['reactivate']);
  assert.deepEqual(plain(api.availableActions(people[4])), ['approve']);
  assert.equal(api.primaryAction(people[1]), null);
  assert.equal(api.primaryAction(people[3]), 'reactivate');
});

test('check-in windows are closed intervals: touching boundaries conflict', () => {
  const a = { checkinStartAt: '2026-11-10T09:00:00Z', checkinEndAt: '2026-11-10T14:00:00Z' };
  assert.equal(api.windowsOverlap(a, { checkinStartAt: '2026-11-10T14:00:00Z', checkinEndAt: '2026-11-10T16:00:00Z' }), true);
  assert.equal(api.windowsOverlap(a, { checkinStartAt: '2026-11-10T14:00:01Z', checkinEndAt: '2026-11-10T16:00:00Z' }), false);
});

test('assignable Events: open lifecycle and check-in not over, soonest first', () => {
  const events = [
    { id: 1, name: 'A', status: 'published', checkinStartAt: '2026-11-20T09:00:00Z', checkinEndAt: '2026-11-20T12:00:00Z' },
    { id: 2, name: 'B', status: 'completed', checkinStartAt: '2026-11-21T09:00:00Z', checkinEndAt: '2026-11-21T12:00:00Z' },
    { id: 3, name: 'C', status: 'draft', checkinStartAt: '2026-11-05T09:00:00Z', checkinEndAt: '2026-11-05T12:00:00Z' },
    { id: 4, name: 'D', status: 'ongoing', checkinStartAt: '2026-10-31T09:00:00Z', checkinEndAt: '2026-10-31T12:00:00Z' },
  ];
  assert.deepEqual(plain(api.assignableEvents(events, now).map((e) => e.id)), [3, 1]);
});

test('canAssign explains inactive staff, closed Events, duplicates and overlaps', () => {
  const event = { id: 9, name: 'Đêm nhạc', status: 'published', checkinStartAt: '2026-11-10T13:00:00Z', checkinEndAt: '2026-11-10T18:00:00Z' };
  assert.equal(api.canAssign(people[2], event, now).allowed, true);
  assert.match(api.canAssign(people[0], event, now).reason, /đang hoạt động/);
  assert.match(api.canAssign(people[1], event, now).reason, /Event 7/, 'overlaps 09:00–14:00');
  assert.match(api.canAssign(people[1], { ...event, id: 7 }, now).reason, /Đã được phân công/);
  assert.match(api.canAssign(people[2], { ...event, status: 'cancelled' }, now).reason, /kết thúc hoặc đã hủy/);
  assert.match(api.canAssign(people[2], { ...event, checkinEndAt: '2026-10-30T00:00:00Z' }, now).reason, /đã qua/);
  const revoked = person(6, 'approved', true, { assignments: [asg(7, '2026-11-10T09:00:00Z', '2026-11-10T14:00:00Z', { isActive: false })] });
  assert.equal(api.canAssign(revoked, event, now).allowed, true, 'revoked assignments do not block');
});

test('staffOnEvent and activeAssignments use only active rows', () => {
  assert.deepEqual(plain(api.staffOnEvent(people, 7).map((p) => p.id)), [2]);
  const list = api.activeAssignments([asg(2, '2026-11-12T00:00:00Z', '2026-11-12T01:00:00Z'), asg(1, '2026-11-11T00:00:00Z', '2026-11-11T01:00:00Z'), asg(3, '2026-11-01T00:00:00Z', '2026-11-01T01:00:00Z', { isActive: false })]);
  assert.deepEqual(plain(list.map((a) => a.eventId)), [1, 2]);
});
