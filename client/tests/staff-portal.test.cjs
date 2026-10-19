// Run: node --test tests/staff-portal.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/staff-portal.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const api = {};
vm.runInNewContext(outputText, { exports: api, Intl, Date, Math, Number, String, JSON });
const plain = (value) => JSON.parse(JSON.stringify(value));

test('initials for the profile pill', () => {
  assert.equal(api.initialsOf('Kim Bửu Lê'), 'KL');
  assert.equal(api.initialsOf('  an  '), 'AN');
  assert.equal(api.initialsOf(''), 'NV');
  assert.equal(api.initialsOf(null), 'NV');
});

test('clock, times and the shift date badge use Vietnam time', () => {
  assert.equal(api.clockText(new Date('2026-10-19T01:02:03Z')), '08:02:03');
  assert.equal(api.timeText('2026-10-19T12:30:00Z'), '19:30');
  // 17:30 UTC on Fri 16/10 is already Sat 17/10 in Vietnam
  assert.deepEqual(plain(api.dateBadge('2026-10-16T17:30:00Z')), { day: '17', month: 'TH10', weekday: 'T7' });
});

test('countdown to the next gate in words, null once passed', () => {
  const now = new Date('2026-10-19T10:00:00Z');
  assert.equal(api.countdownText('2026-10-19T12:05:30Z', now), '2 giờ 05 phút');
  assert.equal(api.countdownText('2026-10-19T10:12:00Z', now), '12 phút');
  assert.equal(api.countdownText('2026-10-19T10:00:20Z', now), 'dưới 1 phút');
  assert.equal(api.countdownText('2026-10-21T13:00:00Z', now), '2 ngày 3 giờ');
  assert.equal(api.countdownText('2026-10-19T09:59:00Z', now), null);
  assert.equal(api.countdownText('not a date', now), null);
});

test('gate progress is clamped to the check-in window', () => {
  const start = '2026-10-19T10:00:00Z', end = '2026-10-19T14:00:00Z';
  assert.equal(api.gateProgress(start, end, new Date('2026-10-19T09:00:00Z')), 0);
  assert.equal(api.gateProgress(start, end, new Date('2026-10-19T11:00:00Z')), 0.25);
  assert.equal(api.gateProgress(start, end, new Date('2026-10-19T15:00:00Z')), 1);
  assert.equal(api.gateProgress(end, start, new Date('2026-10-19T11:00:00Z')), 0);
});

test('session tally counts this session only and paces over the last 5 minutes', () => {
  const now = 10 * 60_000;
  const scans = [
    { at: 0, allowed: true }, { at: 4 * 60_000, allowed: false },
    { at: 6 * 60_000, allowed: true }, { at: 9 * 60_000, allowed: true }, { at: 9.5 * 60_000, allowed: false },
  ];
  assert.deepEqual(plain(api.sessionTally(scans, now)), { total: 5, allowed: 3, refused: 2, perMinute: 0.6 });
  assert.deepEqual(plain(api.sessionTally([], now)), { total: 0, allowed: 0, refused: 0, perMinute: 0 });
});

test('feedback preferences are per account and fall back to on', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(plain(api.readFeedbackPrefs(7, storage)), { sound: true, vibrate: true, keepAwake: false });
  assert.equal(api.saveFeedbackPrefs(7, { sound: false, vibrate: true, keepAwake: true }, storage), true);
  assert.deepEqual(plain(api.readFeedbackPrefs(7, storage)), { sound: false, vibrate: true, keepAwake: true });
  assert.deepEqual(plain(api.readFeedbackPrefs(8, storage)), { sound: true, vibrate: true, keepAwake: false });
  store.set('ticketbox:staff:7:scan-feedback', '{oops');
  assert.deepEqual(plain(api.readFeedbackPrefs(7, storage)), { sound: true, vibrate: true, keepAwake: false });
  const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(plain(api.readFeedbackPrefs(7, blocked)), { sound: true, vibrate: true, keepAwake: false });
  assert.equal(api.saveFeedbackPrefs(7, { sound: true, vibrate: false }, blocked), false);
});

test('keep-awake is opt-in: only an explicit true turns it on', () => {
  const storage = { getItem: () => JSON.stringify({ keepAwake: 'yes' }), setItem: () => {} };
  assert.equal(api.readFeedbackPrefs(1, storage).keepAwake, false);
});

test('gate attendance text and bar share', () => {
  assert.equal(api.attendanceView(null), null);
  const view = plain(api.attendanceView({ admitted: 12, validTickets: 200, remaining: 188 }));
  assert.equal(view.text, '12/200 vé đã vào');
  assert.equal(view.remaining, 'còn 188 vé chưa vào');
  assert.equal(view.share, 0.06);
  assert.equal(api.attendanceView({ admitted: 0, validTickets: 0, remaining: 0 }).share, 0);
  assert.equal(api.attendanceView({ admitted: 5, validTickets: 3, remaining: 0 }).share, 1);
  assert.match(api.attendanceView({ admitted: 1200, validTickets: 2000, remaining: 800 }).text, /^1\.200\/2\.000 /);
});

test('each verdict tone has its own sound and vibration', () => {
  for (const tone of ['success', 'warning', 'failed']) {
    assert.ok(api.VIBRATION[tone].length > 0);
    assert.ok(api.BEEPS[tone].length > 0);
  }
  assert.notDeepEqual(plain(api.BEEPS.success), plain(api.BEEPS.failed));
  assert.ok(api.VIBRATION.failed.reduce((a, b) => a + b) > api.VIBRATION.success.reduce((a, b) => a + b));
});

test('history summary never shows more allowed than total', () => {
  assert.deepEqual(plain(api.historySummary(12, 9)), { total: 12, allowed: 9, refused: 3 });
  assert.deepEqual(plain(api.historySummary(3, 5)), { total: 3, allowed: 3, refused: 0 });
  assert.deepEqual(plain(api.historySummary(-1, 0)), { total: 0, allowed: 0, refused: 0 });
});

test('empty states explain each segment', () => {
  for (const segment of ['all', 'open', 'upcoming', 'history']) {
    const copy = api.emptySegmentText(segment);
    assert.ok(copy.title.length > 5 && copy.text.length > 10);
  }
  assert.match(api.emptySegmentText('open').text, /khung giờ check-in/);
});
