// Run: node --test tests/recaptcha.test.cjs (no browser/test dependency installation).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');

function fixture() {
    const scripts = [], timers = new Map(), readyCallbacks = [], requests = [], executions = [];
    let timerId = 0;
    const window = {
        setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
        clearTimeout(id) { timers.delete(id); },
        grecaptcha: {
            ready(fn) { readyCallbacks.push(fn); },
            execute(key, { action }) {
                executions.push({ key, action });
                // Deliberately not a native Promise: neither catch nor finally exists.
                return { then(resolve) { resolve(`token-${action}`); } };
            },
        },
    };
    const globals = {
        window, document: {
            createElement() { return { remove() { this.removed = true; } }; },
            head: { appendChild(script) { scripts.push(script); } },
        },
        testEnv: { VITE_RECAPTCHA_SITE_KEY: 'site-key' },
        crypto: { randomUUID }, Headers, URL,
        fetch: async (url, options) => {
            requests.push({ url, body: JSON.parse(options.body), headers: options.headers });
            return { ok: true, json: async () => ({ success: true, data: { message: 'Accepted' } }) };
        },
    };
    function load(file, dependencies = {}) {
        const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8').replaceAll('import.meta.env', 'testEnv');
        const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
        const exports = {};
        vm.runInNewContext(outputText, { ...globals, exports, require(name) {
            assert.ok(name in dependencies, `Unexpected import: ${name}`);
            return dependencies[name];
        } }, { filename: file });
        return exports;
    }
    const captcha = load('services/recaptcha.ts');
    const flushReady = () => readyCallbacks.splice(0).forEach(fn => fn());
    async function initialize() {
        const promise = captcha.loadRecaptcha(); scripts.at(-1).onload(); flushReady(); await promise;
        window.grecaptcha.ready = fn => fn();
    }
    return { captcha, scripts, timers, window, requests, executions, flushReady, initialize, load };
}

test('single script; waits for onload and ready; execute waits for ready on each call', async () => {
    const f = fixture();
    const first = f.captcha.loadRecaptcha();
    assert.equal(f.captcha.loadRecaptcha(), first);
    assert.equal(f.scripts.length, 1);
    assert.match(f.scripts[0].src, /api\.js\?render=site-key/);
    assert.equal(f.captcha.getRecaptchaState().ready, false);
    f.scripts[0].onload();
    assert.equal(f.captcha.getRecaptchaState().ready, false);
    f.flushReady(); await first;
    assert.equal(f.captcha.getRecaptchaState().ready, true);
    const token = f.captcha.getRecaptchaToken('ticket_retrieval');
    await Promise.resolve();
    assert.equal(f.executions.length, 0);
    f.flushReady();
    assert.equal(await token, 'token-ticket_retrieval');
    assert.equal(f.timers.size, 0);
});

test('script failure can retry, successful initialization is reused', async () => {
    const f = fixture();
    const failed = f.captcha.loadRecaptcha();
    f.scripts[0].onerror();
    await assert.rejects(failed, /Không tải được/);
    assert.equal(f.scripts[0].removed, true);
    f.captcha.retryRecaptcha();
    assert.equal(f.scripts.length, 2);
    await f.initialize();
    await f.captcha.loadRecaptcha();
    assert.equal(f.scripts.length, 2);
});

test('timeout ignores late ready callback and clears timers', async () => {
    const f = fixture(); await f.initialize();
    f.window.grecaptcha.ready = () => {};
    const pending = f.captcha.getRecaptchaToken('checkout_email');
    await Promise.resolve();
    [...f.timers.values()].forEach(fn => fn());
    await assert.rejects(pending, /Không lấy được/);
    assert.equal(f.executions.length, 0);
    assert.equal(f.timers.size, 0);
});

// Exercise the actual form handlers, helper and API fetch with a lightweight hook/JSX harness.
// These are simulated integrations, not a real Google token or browser layout test.
function renderForm(f, checkout) {
    const states = []; let cursor = 0;
    const react = {
        useState(initial) {
            const index = cursor++;
            if (!(index in states)) states[index] = checkout && index === 0
                ? { id: '1', shortTitle: 'Test', tickets: [{ id: '1', price: 100, name: 'VIP' }] } : initial;
            return [states[index], value => { states[index] = value; }];
        },
        useEffect() {}, useMemo: fn => fn(), useRef: value => ({ current: value }),
    };
    const api = f.load('services/api.ts', { '@/services/auth.service': {} });
    const orders = f.load('services/order.service.ts', { './api': api });
    const jsx = (type, props) => ({ type, props });
    const dependencies = {
        react, 'react/jsx-runtime': { jsx, jsxs: jsx },
        '@/hooks/useRecaptcha': { useRecaptcha: () => ({ ...f.captcha.getRecaptchaState(), getToken: f.captcha.getRecaptchaToken, retry: f.captcha.retryRecaptcha }) },
        '@/hooks/useEmailCooldown': { useEmailCooldown: () => ({ remaining: 0, start() {} }) },
        '@/services/api': api, '@/services/order.service': orders,
        '@/services/event.service': {}, '@/lib/utils': { formatPrice: String }, 'lucide-react': {},
        'react-router-dom': { useParams: () => ({ id: '1' }), useNavigate: () => () => {}, useLocation: () => ({ state: { selections: [{ ticketTypeId: '1', quantity: 1 }] } }) },
    };
    const component = checkout
        ? f.load('pages/public/CheckoutPlaceholder.tsx', dependencies).CheckoutPlaceholder
        : f.load('components/event/TicketRetrievalForm.tsx', dependencies).TicketRetrievalForm;
    const render = () => { cursor = 0; return component(); };
    const find = (tree, predicate) => {
        if (!tree || typeof tree !== 'object') return;
        if (predicate(tree)) return tree;
        for (const child of [tree.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
    };
    const submit = () => {
        const tree = render();
        return checkout ? find(tree, n => n.type === 'button' && n.props.children === 'Gửi mã')
            : find(tree, n => n.type === 'form');
    };
    find(render(), n => n.type === 'input' && n.props.type === 'email').props.onChange({ target: { value: 'buyer@example.com' } });
    return { render, find, submit: () => checkout ? submit().props.onClick() : submit().props.onSubmit({ preventDefault() {} }) };
}

for (const checkout of [false, true]) {
    const action = checkout ? 'checkout_email' : 'ticket_retrieval';
    test(`${action}: form sends token in actual fetch payload without finally`, async () => {
        const f = fixture(); const form = renderForm(f, checkout);
        await form.submit(); assert.equal(f.requests.length, 0);
        await f.initialize(); await form.submit();
        assert.equal(f.requests.length, 1);
        assert.equal(f.requests[0].body.recaptchaToken, `token-${action}`);
        assert.equal(f.requests[0].body.email, 'buyer@example.com');
        assert.ok(f.requests[0].url.endsWith(checkout ? '/orders/verify-email/request' : '/tickets/retrieval'));
        if (checkout) assert.ok(f.requests[0].headers.get('X-Checkout-Session'));
        assert.equal(f.timers.size, 0);
    });
    test(`${action}: rejected, empty and synchronous execute errors show alert, stop loading and send no request`, async () => {
        const f = fixture(); await f.initialize(); const form = renderForm(f, checkout);
        for (const execute of [() => ({ then(_resolve, reject) { reject(new Error('Google error')); } }), () => ({ then(resolve) { resolve(''); } }), () => { throw new Error('execute failed'); }]) {
            f.window.grecaptcha.execute = execute;
            await form.submit();
            assert.equal(f.requests.length, 0);
            assert.ok(form.find(form.render(), n => n.props?.role === 'alert'));
            assert.equal(f.timers.size, 0);
        }
        f.window.grecaptcha.execute = () => ({ then(resolve) { resolve('retry-token'); } });
        await form.submit(); assert.equal(f.requests.length, 1);
    });
}
