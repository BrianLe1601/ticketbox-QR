// Run: node --test tests/admin-events.test.cjs
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
  vm.runInNewContext(outputText, { exports, Intl, Date, Number, String, Math, Object, URL, Map, Set, ...extra });
  return exports;
}
const readiness = load('admin-readiness.ts');
const view = load('admin-events-view.ts', { require: (name) => (name === '@/lib/admin-readiness' ? readiness : require(name)) });
const form = load('admin-event-form.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

const base = {
  name: 'Đêm nhạc', venue: 'Nhà hát', city: 'TP.HCM', category: 'pop', visibility: 'visible',
  soldQuantity: 0, pendingOrderCount: 0, confirmedOrderCount: 0, readiness: { ready: true, missing: [] },
  startTime: '2026-10-20T12:00:00.000Z',
};
const ev = (id, status, extra = {}) => ({ ...base, id, status, ...extra });
const events = [
  ev(1, 'draft', { name: 'Acoustic Sài Gòn', category: 'acoustic' }),
  ev(2, 'draft', { readiness: { ready: false, missing: ['VALID_TICKET_TYPE_REQUIRED', 'COVER_IMAGE_REQUIRED'] } }),
  ev(3, 'published', { name: 'ROCK Fest' , category: 'rock' }),
  ev(4, 'ongoing'),
  ev(5, 'completed'),
  ev(6, 'cancelled'),
];

test('counts and status filter use one predicate for every card', () => {
  const counts = view.eventCounts(events);
  assert.deepEqual(plain(counts), { all: 6, draft: 2, published: 1, ongoing: 1, completed: 1, cancelled: 1 });
  for (const status of ['all', ...view.EVENT_STATUSES]) {
    assert.equal(view.filterEvents(events, { status, category: 'all', query: '' }).length, counts[status], status);
  }
});

test('search ignores case/edges and combines with status and category', () => {
  assert.deepEqual(view.filterEvents(events, { status: 'all', category: 'all', query: '  rock ' }).map((e) => e.id), [3]);
  assert.equal(view.filterEvents(events, { status: 'draft', category: 'all', query: 'rock' }).length, 0);
  assert.deepEqual(view.filterEvents(events, { status: 'all', category: 'acoustic', query: '' }).map((e) => e.id), [1]);
  assert.deepEqual(view.filterEvents(events, { status: 'all', category: 'all', query: 'SÀI GÒN' }).map((e) => e.id), [1]);
});

test('Vietnam date key crosses midnight at UTC+7', () => {
  assert.equal(view.vnDateKey('2026-10-18T16:59:00Z'), '2026-10-18');
  assert.equal(view.vnDateKey('2026-10-18T17:00:00Z'), '2026-10-19');
  assert.deepEqual(plain(view.monthOf('2026-12-31T18:00:00Z')), { year: 2027, month: 1 });
});

test('month grid is 6 Monday-first weeks and shiftMonth wraps years', () => {
  const grid = view.monthGrid({ year: 2026, month: 10 });
  assert.equal(grid.length, 6);
  assert.ok(grid.every((week) => week.length === 7));
  // 1 Oct 2026 is a Thursday -> first cell is Monday 28 Sep.
  assert.equal(grid[0][0].key, '2026-09-28');
  assert.equal(grid[0][3].key, '2026-10-01');
  assert.equal(grid[0][3].inMonth, true);
  assert.equal(grid[0][0].inMonth, false);
  assert.deepEqual(plain(view.shiftMonth({ year: 2026, month: 12 }, 1)), { year: 2027, month: 1 });
  assert.deepEqual(plain(view.shiftMonth({ year: 2026, month: 1 }, -1)), { year: 2025, month: 12 });
});

test('events are grouped by their Vietnam start day, sorted by time', () => {
  const map = view.eventsByDay([
    { id: 'b', startTime: '2026-10-18T15:00:00Z' },
    { id: 'a', startTime: '2026-10-18T02:00:00Z' },
    { id: 'c', startTime: '2026-10-18T18:00:00Z' },
  ]);
  assert.deepEqual(plain(map.get('2026-10-18').map((e) => e.id)), ['a', 'b']);
  assert.deepEqual(plain(map.get('2026-10-19').map((e) => e.id)), ['c']);
});

test('Kanban: only publish (ready Draft) and cancel (Published/Ongoing) are offered', () => {
  assert.equal(view.kanbanDrop(events[0], 'published').action, 'publish');
  const notReady = view.kanbanDrop(events[1], 'published');
  assert.equal(notReady.action, 'reject');
  assert.match(notReady.reason, /hạng vé hợp lệ/);
  assert.match(notReady.reason, /ảnh bìa/);
  assert.doesNotMatch(notReady.reason, /[A-Z]{3,}_[A-Z]/, 'no raw server codes');
  assert.equal(view.kanbanDrop(events[2], 'cancelled').action, 'cancel');
  assert.equal(view.kanbanDrop(events[3], 'cancelled').action, 'cancel');
  assert.equal(view.kanbanDrop(events[0], 'cancelled').action, 'reject');
  assert.equal(view.kanbanDrop(events[2], 'ongoing').action, 'reject');
  assert.equal(view.kanbanDrop(events[3], 'completed').action, 'reject');
  assert.equal(view.kanbanDrop(events[2], 'draft').action, 'reject');
  assert.equal(view.kanbanDrop(events[4], 'cancelled').action, 'reject');
  assert.equal(view.kanbanDrop(events[5], 'published').action, 'reject');
  assert.equal(view.kanbanDrop(events[2], 'published').action, 'none');
});

test('delete is only for Drafts without orders; terminal Events are read-only', () => {
  assert.equal(view.canDelete(events[0]).allowed, true);
  assert.equal(view.canDelete(ev(9, 'draft', { pendingOrderCount: 1 })).allowed, false);
  assert.equal(view.canDelete(events[2]).allowed, false);
  assert.equal(view.canEdit(events[4]).allowed, false);
  assert.equal(view.canToggleVisibility(events[5]).allowed, false);
  assert.equal(view.canEdit(events[3]).allowed, true);
});

const valid = {
  ...form.EMPTY_EVENT_FORM, name: 'Đêm nhạc', category: 'pop',
  startTime: '2026-11-20T19:00', endTime: '2026-11-20T22:00',
  salesStartAt: '2026-11-01T09:00', salesEndAt: '2026-11-20T21:00',
  checkinStartAt: '2026-11-20T16:00', checkinEndAt: '2026-11-20T21:30',
};
const ctx = { editing: null, venueMissing: false };
const fields = (errors) => errors.map((e) => e.field);

test('a complete form has no errors and maps to an ISO payload', () => {
  assert.deepEqual(plain(form.validateEventForm(valid, ctx)), []);
  const payload = form.toEventPayload({ ...valid, description: '  ' });
  assert.equal(payload.description, null);
  assert.equal(payload.scheduledPublishAt, null);
  assert.equal(payload.startTime, new Date('2026-11-20T19:00').toISOString());
});

test('check-in must open on the Event day and at least 2 hours before it starts', () => {
  assert.ok(fields(form.validateEventForm({ ...valid, checkinStartAt: '2026-11-20T17:30' }, ctx)).includes('checkinStartAt'));
  assert.ok(fields(form.validateEventForm({ ...valid, checkinStartAt: '2026-11-19T20:00' }, ctx)).includes('checkinStartAt'));
  assert.equal(form.validateEventForm({ ...valid, checkinStartAt: '2026-11-20T17:00' }, ctx).length, 0);
  assert.equal(form.checkinStartMax('2026-11-20T19:00'), '2026-11-20T17:00');
});

test('errors point at their field; missing venue and scheduled publish are reported', () => {
  const errors = form.validateEventForm({ ...form.EMPTY_EVENT_FORM, publishMode: 'scheduled' }, { editing: null, venueMissing: true });
  const map = form.errorsByField(errors);
  for (const field of ['name', 'category', 'venue', 'startTime', 'endTime', 'salesStartAt', 'salesEndAt', 'checkinStartAt', 'checkinEndAt', 'scheduledPublishAt']) {
    assert.ok(map[field], field);
  }
  assert.ok(fields(form.validateEventForm({ ...valid, publishMode: 'scheduled', scheduledPublishAt: '2026-11-20T19:00' }, ctx)).includes('scheduledPublishAt'));
  assert.ok(fields(form.validateEventForm({ ...valid, coverImageUrl: 'ftp://x' }, ctx)).includes('coverImageUrl'));
});

test('schedule changes are blocked while Staff are assigned; same times pass', () => {
  const editing = { status: 'published', activeStaffCount: 2, startTime: new Date(valid.startTime).toISOString(), endTime: new Date(valid.endTime).toISOString() };
  assert.equal(form.validateEventForm(valid, { editing, venueMissing: false }).length, 0);
  assert.ok(fields(form.validateEventForm({ ...valid, endTime: '2026-11-20T23:00', checkinEndAt: '2026-11-20T22:30' }, { editing, venueMissing: false })).includes('staff'));
});

test('a published Event needs explicit confirmation to re-apply the venue', () => {
  const editing = { status: 'published', activeStaffCount: 0, startTime: new Date(valid.startTime).toISOString(), endTime: new Date(valid.endTime).toISOString() };
  assert.ok(fields(form.validateEventForm({ ...valid, syncVenue: true }, { editing, venueMissing: false })).includes('confirmPublicVenueChange'));
  assert.equal(form.validateEventForm({ ...valid, syncVenue: true, confirmPublicVenueChange: true }, { editing, venueMissing: false }).length, 0);
});

test('formFromEvent round-trips local inputs', () => {
  const values = form.formFromEvent({
    name: 'A', description: null, category: 'pop', coverImageUrl: null, coverImagePublicId: null, coverImageAlt: null,
    startTime: new Date(valid.startTime).toISOString(), endTime: new Date(valid.endTime).toISOString(),
    salesStartAt: new Date(valid.salesStartAt).toISOString(), salesEndAt: new Date(valid.salesEndAt).toISOString(),
    checkinStartAt: new Date(valid.checkinStartAt).toISOString(), checkinEndAt: new Date(valid.checkinEndAt).toISOString(),
    scheduledPublishAt: null,
  });
  assert.equal(values.startTime, valid.startTime);
  assert.equal(values.checkinEndAt, valid.checkinEndAt);
  assert.equal(values.publishMode, 'manual');
  assert.equal(form.toLocalInput(null), '');
});

test('readiness codes read in Vietnamese and group into a checklist', () => {
  assert.equal(readiness.readinessText('COVER_IMAGE_REQUIRED'), 'Chưa có ảnh bìa.');
  assert.match(readiness.readinessText('SOMETHING_NEW'), /SOMETHING_NEW/, 'unknown codes are still shown');
  assert.equal(readiness.readinessFix('VALID_TICKET_TYPE_REQUIRED'), 'tickets');
  assert.equal(readiness.readinessFix('VENUE_CAPACITY_REQUIRED'), 'settings');
  const list = readiness.readinessChecklist(['CHECKIN_TOO_LATE', 'VALID_TICKET_TYPE_REQUIRED', 'X_NEW']);
  assert.deepEqual(plain(list.map((g) => [g.id, g.ok])), [['info', true], ['schedule', true], ['sales', true], ['checkin', false], ['tickets', false], ['other', false]]);
  assert.equal(readiness.readinessChecklist([]).every((g) => g.ok), true);
});

// ---------------------------------------------------------------- schedule suggestions
const empty = () => ({ ...form.EMPTY_EVENT_FORM });
const at = (local) => new Date(local).getTime();

test('suggestions: sell from now until the show starts, gates 2 h before, close at the end', () => {
  const now = at('2026-10-18T10:15:42');
  assert.deepEqual(plain(form.suggestSchedule({ startTime: '2026-11-20T20:00', endTime: '2026-11-20T23:00' }, now)), {
    salesEndAt: '2026-11-20T20:00', checkinEndAt: '2026-11-20T23:00', salesStartAt: '2026-10-18T10:15', checkinStartAt: '2026-11-20T18:00',
  });
  assert.deepEqual(plain(form.suggestSchedule({ startTime: '2026-11-20T23:00', endTime: '2026-11-20T20:00' }, now)), {}); // end before start
  // A show starting at 01:00 cannot open gates 2 h earlier on the same day: no wrong suggestion.
  assert.equal(form.suggestSchedule({ startTime: '2026-11-21T01:00', endTime: '2026-11-21T03:00' }, now).checkinStartAt, undefined);
  // A show already starting: no sales start proposed.
  assert.equal(form.suggestSchedule({ startTime: '2026-10-18T09:00', endTime: '2026-10-18T23:00' }, now).salesStartAt, undefined);
});

test('suggestions never overwrite a typed value, refresh untouched ones and clear stale ones', () => {
  const now = at('2026-10-18T10:00');
  const first = form.applySuggestions({ ...empty(), startTime: '2026-11-20T20:00', endTime: '2026-11-20T23:00', salesEndAt: '2026-11-20T18:30' }, new Set(), now);
  assert.equal(first.form.salesEndAt, '2026-11-20T18:30'); // typed by the Admin
  assert.equal(first.form.checkinEndAt, '2026-11-20T23:00');
  assert.deepEqual([...first.suggested].sort(), ['checkinEndAt', 'checkinStartAt', 'salesStartAt']);
  const moved = form.applySuggestions({ ...first.form, startTime: '2026-11-21T01:00', endTime: '2026-11-21T03:00' }, first.suggested, now);
  assert.equal(moved.form.checkinEndAt, '2026-11-21T03:00'); // untouched suggestion follows the new end
  assert.equal(moved.form.checkinStartAt, ''); // no valid same-day value any more
  assert.equal(moved.form.salesEndAt, '2026-11-20T18:30');
});

test('sales-end presets stop at check-in end; selling after the gates close is an error', () => {
  const f = { startTime: '2026-11-20T20:00', endTime: '2026-11-20T23:00', salesStartAt: '2026-10-18T10:00', checkinEndAt: '2026-11-20T22:00' };
  assert.equal(form.salesEndFor('start', f), '2026-11-20T20:00');
  assert.equal(form.salesEndFor('beforeStart', f), '2026-11-20T18:00');
  assert.equal(form.salesEndFor('checkinEnd', f), '2026-11-20T22:00');
  assert.equal(form.salesEndFor('checkinEnd', { ...f, checkinEndAt: '' }), ''); // no gates time yet
  assert.equal(form.salesEndFor('start', { ...f, checkinEndAt: '2026-11-20T19:30' }), ''); // gates close before the show
  assert.equal(form.salesEndFor('beforeStart', { ...f, salesStartAt: '2026-11-20T19:00' }), ''); // not after sales start
  const w = (salesEndAt) => plain(form.scheduleWarnings({ ...f, salesEndAt }));
  assert.deepEqual(w('2026-11-20T20:00'), []);
  assert.match(w('2026-11-20T21:00')[0].message, /sau giờ mở màn \(20:00\)/);
  assert.deepEqual(w('2026-11-20T22:30').map((x) => x.severity), ['error']); // shown live; saving is refused below
  assert.match(w('2026-11-20T22:30')[0].message, /sau giờ đóng check-in \(22:00\)/);
  assert.equal(w('2026-11-20T21:00')[0].severity, 'warning');
  const base = { ...form.EMPTY_EVENT_FORM, name: 'Đêm nhạc', category: 'pop', startTime: '2026-11-20T20:00', endTime: '2026-11-20T23:00', salesStartAt: '2026-10-18T10:00', checkinStartAt: '2026-11-20T18:00', checkinEndAt: '2026-11-20T22:00' };
  const errs = (salesEndAt) => plain(form.validateEventForm({ ...base, salesEndAt }, { editing: null, venueMissing: false })).filter((e) => e.field === 'salesEndAt').map((e) => e.message);
  assert.deepEqual(errs('2026-11-20T22:00'), []); // exactly at check-in end is allowed
  assert.match(errs('2026-11-20T22:30')[0], /sau khi đóng check-in/);
  assert.match(errs('2026-11-20T23:30')[0], /sau khi sự kiện kết thúc/); // the Event-end message wins
  // A suggestion respects a typed early check-in end.
  const early = form.applySuggestions({ ...form.EMPTY_EVENT_FORM, startTime: '2026-11-20T20:00', endTime: '2026-11-20T23:00', checkinEndAt: '2026-11-20T19:30' }, new Set(), at('2026-10-18T10:00'));
  assert.equal(early.form.salesEndAt, '2026-11-20T19:30');
});
