#!/usr/bin/env node
/**
 * Layout-stability audit for /login, /admin/* and /staff/* (no extra dependency: Node >= 22 global
 * WebSocket + a locally installed Chrome or Edge driven through the DevTools protocol).
 *
 * Read-only: it signs in, follows the section links like a user and measures; it never clicks an
 * action button. Run it against the dev server of a DISPOSABLE database (AGENTS.md). Credentials come
 * from the environment only and are never printed.
 *
 *   AUDIT_BASE_URL=http://localhost:5173 \
 *   AUDIT_ADMIN_EMAIL=... AUDIT_ADMIN_PASSWORD=... \
 *   [AUDIT_STAFF_EMAIL=... AUDIT_STAFF_PASSWORD=...] [AUDIT_BROWSER=/path/to/chrome] \
 *   npm run audit:layout -- [--width=1440] [--slow] [--json]
 *
 * For every section it records where the page frame sits right after the click, while data loads and
 * once settled, plus the browser's own layout-shift entries (CLS). It fails (exit 1) when a frame moves
 * inside a page or differs between pages of the same area, or when CLS is poor.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = new Map(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const BASE = (process.env.AUDIT_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const WIDTH = Number(args.get('width') ?? 1440);
const HEIGHT = 900;
const DRIFT_PX = 2;       // allowed movement of a frame anchor
const CLS_FAIL = 0.1;     // Web Vitals "poor"
const CLS_WARN = 0.02;
const SWAP_FAIL_MS = 600; // a click must visibly switch the page within this time
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ADMIN_ROUTES = ['/admin', '/admin/events', '/admin/ticket-types', '/admin/categories', '/admin/staff', '/admin/orders', '/admin/checkins', '/admin/reports', '/admin/settings', '/admin'];
const STAFF_ROUTES = ['/staff', '/staff/check-in', '/staff/events', '/staff/history', '/staff'];

function findBrowser() {
  if (process.env.AUDIT_BROWSER) return process.env.AUDIT_BROWSER;
  const local = process.env.LOCALAPPDATA ?? '';
  const candidates = {
    win32: ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe', path.join(local, 'Google/Chrome/Application/chrome.exe')],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'],
  }[process.platform] ?? [];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Chrome/Edge not found: set AUDIT_BROWSER to the browser executable.');
  return found;
}

async function launch() {
  const profile = mkdtempSync(path.join(tmpdir(), 'tb-layout-audit-'));
  const child = spawn(findBrowser(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 80 && !port; i++) {
    await sleep(150);
    try { port = readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { /* not yet */ }
  }
  if (!port) throw new Error('Browser did not start.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const waitFor = async (condition, timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) { try { if (await evaluate(`Boolean(${condition})`)) return true; } catch { /* navigating */ } await sleep(100); }
    throw new Error(`Timed out waiting for ${condition}`);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH <= 480 });
  // Collect the browser's layout-shift entries in every document.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__shifts = [];
    try { new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__shifts.push({ t: e.startTime, value: e.value, input: e.hadRecentInput,
      sources: (e.sources || []).slice(0, 3).map((s) => s.node && s.node.nodeType === 1 ? s.node.tagName.toLowerCase() + '.' + [...s.node.classList].slice(0, 3).join('.') : '#text') }); })
      .observe({ type: 'layout-shift', buffered: true }); } catch {}` });
  if (args.get('slow')) await send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: -1, uploadThroughput: -1 });
  const close = async () => {
    const exited = new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
    try { await send('Browser.close'); } catch { /* gone */ }
    ws.close();
    await Promise.race([exited, sleep(3000)]);
    child.kill();
    // Windows may hold profile files for a moment after exit; a leftover temp folder is harmless.
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* ignore */ }
  };
  return { send, evaluate, waitFor, close, goto: async (url) => { await send('Page.navigate', { url }); await sleep(400); await waitFor('document.readyState === "complete"'); } };
}

const setValue = (selector, value) => `(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus();
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`;

async function signIn(b, email, password, prefix) {
  await b.goto(`${BASE}/login`);
  await b.waitFor('document.querySelector("#email")');
  await b.evaluate('document.querySelectorAll("[role=tab]")[0]?.click()');
  await sleep(200);
  await b.evaluate(setValue('#email', email));
  await b.evaluate(setValue('#password', password));
  await b.evaluate('document.querySelector(".login-form button[type=submit]").click()');
  await b.waitFor(`location.pathname.startsWith(${JSON.stringify(prefix)})`);
  await sleep(1200);
}

const BUSY = '.adm-route-loading, .sp-route-loading, [aria-busy="true"], .adm-skeleton, .sp-loading, .sp-attend.is-pending';
const probe = (frame) => `(() => {
  const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), h: Math.round(r.height) }; };
  const root = document.querySelector(${JSON.stringify(frame.root)});
  return { stale: Boolean(window.__oldRoot) && root === window.__oldRoot, header: box(${JSON.stringify(frame.header)}), next: box(${JSON.stringify(frame.next)}), busy: Boolean(document.querySelector(${JSON.stringify(BUSY)})),
    gutter: getComputedStyle(document.documentElement).scrollbarGutter, scrollY: Math.round(scrollY) };
})()`;

async function auditArea(b, name, routes, frame) {
  const rows = [];
  // The shell (and its section links) may still be loading, especially with --slow.
  await b.waitFor(`document.querySelector(${JSON.stringify(frame.nav + ' a[href]')})`, 60000);
  try { await b.waitFor(`!document.querySelector(${JSON.stringify(BUSY)})`, 30000); } catch { /* measured per route */ }
  await sleep(800);
  for (const route of routes) {
    // Below 1024px the Admin navigation is a drawer: open it first (before the timer starts), like a user.
    if (frame.openNav) {
      await b.evaluate(`document.querySelector(${JSON.stringify(frame.openNav)})?.click()`);
      await sleep(350);
    }
    // The page root element is replaced when the new page mounts; until then the OLD page is on screen.
    const samePage = await b.evaluate(`location.pathname === ${JSON.stringify(route)}`);
    await b.evaluate(`(() => { window.__mark = performance.now(); window.__swapMs = ${samePage} ? 0 : null;
      const current = document.querySelector(${JSON.stringify(frame.root)});
      // A loading frame already tells the user the click was taken: only real old content counts as stale.
      window.__oldRoot = ${samePage} || !current || current.matches(".adm-route-loading, .sp-route-loading") ? null : current;
      if (!window.__oldRoot) window.__swapMs = 0;
      const tick = () => { const now = performance.now();
        if (document.querySelector(${JSON.stringify(frame.root)}) !== window.__oldRoot) { window.__swapMs = window.__swapMs ?? Math.round(now - window.__mark); return; }
        if (now - window.__mark < 20000) requestAnimationFrame(tick); };
      requestAnimationFrame(tick); })()`);
    const clicked = await b.evaluate(`(() => { const a = [...document.querySelectorAll(${JSON.stringify(frame.nav + ' a[href]')})].find((x) => x.getAttribute('href') === ${JSON.stringify(route)}); if (!a) return false; a.click(); return true; })()`);
    if (!clicked) { rows.push({ route, error: 'section link not found' }); continue; }
    const samples = [];
    for (const wait of [60, 400]) { await sleep(wait === 60 ? 60 : 340); samples.push(await b.evaluate(probe(frame))); }
    try { await b.waitFor(`!document.querySelector(${JSON.stringify(BUSY)})`, 20000); } catch { /* report as busy */ }
    await sleep(600);
    samples.push(await b.evaluate(probe(frame)));
    const shifts = await b.evaluate('(window.__shifts || []).filter((s) => s.t >= window.__mark)');
    const anchors = samples.filter((s) => s.header && !s.stale);
    // Fallback when no animation frame observed the swap: the new page is up by the last sample.
    const swapMs = await b.evaluate('window.__swapMs') ?? (samples.at(-1).stale ? null : await b.evaluate('Math.round(performance.now() - window.__mark)'));
    const drift = (key, prop) => { const v = anchors.map((s) => s[key]?.[prop]).filter((n) => n !== undefined); return v.length ? Math.max(...v) - Math.min(...v) : 0; };
    rows.push({
      route,
      swapMs,
      header: anchors.at(-1)?.header ?? null,
      next: anchors.at(-1)?.next ?? null,
      drift: Math.max(drift('header', 'x'), drift('header', 'y'), drift('header', 'h'), drift('next', 'y')),
      cls: Number(shifts.filter((s) => !s.input).reduce((sum, s) => sum + s.value, 0).toFixed(4)),
      clsWithInput: Number(shifts.reduce((sum, s) => sum + s.value, 0).toFixed(4)),
      shiftSources: [...new Set(shifts.flatMap((s) => s.sources))].slice(0, 4),
      stillBusy: samples.at(-1).busy,
      gutter: samples.at(-1).gutter,
      scrollY: samples.at(-1).scrollY,
    });
  }
  // The frame must sit at the same place on every page of the area.
  const xs = new Set(rows.filter((r) => r.header).map((r) => r.header.x));
  const ys = new Set(rows.filter((r) => r.header).map((r) => r.header.y));
  return { name, rows, sameFrame: xs.size <= 1 && ys.size <= 1, frameX: [...xs], frameY: [...ys] };
}

async function auditLogin(b) {
  await b.goto(`${BASE}/login`);
  await b.waitFor('document.querySelector(".login-card")');
  await sleep(1500);
  const card = () => b.evaluate('(() => { const r = document.querySelector(".login-card").getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; })()');
  const first = await card();
  const loadShifts = await b.evaluate('window.__shifts || []');
  const tabs = await b.evaluate('document.querySelectorAll("[role=tab]").length');
  const positions = [first];
  for (const index of [1, 0]) {
    if (index < tabs) { await b.evaluate(`document.querySelectorAll("[role=tab]")[${index}].click()`); await sleep(1200); positions.push(await card()); }
  }
  const lateShifts = await b.evaluate('(window.__shifts || []).filter((s) => !s.input && s.t > 2500)');
  return {
    cardMoves: Math.max(...positions.map((p) => p.y)) - Math.min(...positions.map((p) => p.y)),
    loadCls: Number(loadShifts.filter((s) => !s.input).reduce((sum, s) => sum + s.value, 0).toFixed(4)),
    lateCls: Number(lateShifts.reduce((sum, s) => sum + s.value, 0).toFixed(4)),
    sources: [...new Set([...loadShifts, ...lateShifts].flatMap((s) => s.sources))].slice(0, 4),
  };
}

function verdict(area) {
  const problems = [];
  if (!area.sameFrame) problems.push(`frame differs between pages (x ${area.frameX.join('/')}, y ${area.frameY.join('/')})`);
  for (const r of area.rows) {
    if (r.error) { problems.push(`${r.route}: ${r.error}`); continue; }
    if (r.swapMs === null) problems.push(`${r.route}: the previous page never left the screen`);
    else if (r.swapMs > SWAP_FAIL_MS) problems.push(`${r.route}: previous page stayed ${r.swapMs}ms after the click`);
    if (r.drift > DRIFT_PX) problems.push(`${r.route}: frame moved ${r.drift}px while loading`);
    if (r.cls > CLS_FAIL) problems.push(`${r.route}: CLS ${r.cls} (${r.shiftSources.join(', ')})`);
    if (r.gutter && r.gutter !== 'stable') problems.push(`${r.route}: scrollbar-gutter is ${r.gutter}`);
    if (r.scrollY !== 0) problems.push(`${r.route}: opened at scrollY ${r.scrollY}`);
  }
  return problems;
}

const b = await launch();
const report = { width: WIDTH, slow: Boolean(args.get('slow')), areas: [], login: null, problems: [], warnings: [] };
try {
  report.login = await auditLogin(b);
  if (report.login.cardMoves > DRIFT_PX) report.problems.push(`/login: card moved ${report.login.cardMoves}px when switching role`);
  if (report.login.loadCls + report.login.lateCls > CLS_WARN) report.warnings.push(`/login: CLS ${report.login.loadCls} + late ${report.login.lateCls} (${report.login.sources.join(', ')})`);

  if (process.env.AUDIT_ADMIN_EMAIL && process.env.AUDIT_ADMIN_PASSWORD) {
    await signIn(b, process.env.AUDIT_ADMIN_EMAIL, process.env.AUDIT_ADMIN_PASSWORD, '/admin');
    const area = await auditArea(b, 'admin', ADMIN_ROUTES, { nav: '.adm-shell-nav', openNav: WIDTH < 1024 ? 'button[aria-controls="admin-navigation"]' : null, root: '#admin-main .adm-page', header: '.adm-page-header', next: '.adm-page-header + *' });
    report.areas.push(area);
    report.problems.push(...verdict(area));
    await b.evaluate('localStorage.clear(); sessionStorage.clear()');
    await b.send('Network.clearBrowserCookies');
  } else report.warnings.push('Admin skipped: AUDIT_ADMIN_EMAIL / AUDIT_ADMIN_PASSWORD not set');

  if (process.env.AUDIT_STAFF_EMAIL && process.env.AUDIT_STAFF_PASSWORD) {
    await signIn(b, process.env.AUDIT_STAFF_EMAIL, process.env.AUDIT_STAFF_PASSWORD, '/staff');
    const area = await auditArea(b, 'staff', STAFF_ROUTES, { nav: '.sp-nav', root: '.sp-main > .sp-page', header: '.sp-page > :first-child', next: '.sp-page > :nth-child(2)' });
    // Staff pages open with different blocks by design (hero, Event bar, title): only the start point must match.
    report.areas.push(area);
    report.problems.push(...verdict(area));
  } else report.warnings.push('Staff skipped: AUDIT_STAFF_EMAIL / AUDIT_STAFF_PASSWORD not set');

  for (const area of report.areas) for (const r of area.rows) if (!r.error && r.cls > CLS_WARN && r.cls <= CLS_FAIL) report.warnings.push(`${r.route}: CLS ${r.cls} (${r.shiftSources.join(', ')})`);
} finally {
  await b.close();
}

if (args.get('json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Layout audit ${BASE} @ ${WIDTH}px${report.slow ? ' (slow network)' : ''}`);
  console.log(`/login: card moves ${report.login.cardMoves}px, CLS load ${report.login.loadCls}, late ${report.login.lateCls}`);
  for (const area of report.areas) {
    console.log(`\n${area.name}: frame at x ${area.frameX.join('/')} · y ${area.frameY.join('/')}`);
    for (const r of area.rows) console.log(`  ${r.route.padEnd(22)} ${r.error ?? `switch ${r.swapMs ?? '-'}ms · drift ${r.drift}px · CLS ${r.cls} (with input ${r.clsWithInput})${r.stillBusy ? ' · still loading' : ''}${r.shiftSources.length ? ' · ' + r.shiftSources.join(', ') : ''}`}`);
  }
  for (const w of report.warnings) console.log(`WARN  ${w}`);
  for (const p of report.problems) console.log(`FAIL  ${p}`);
  console.log(report.problems.length ? `\n${report.problems.length} problem(s).` : '\nNo layout-stability problem found.');
}
process.exit(report.problems.length ? 1 : 0);
