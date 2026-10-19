// Run: node --test tests/public-workflows.test.cjs. No additional test dependencies.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, globals = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } });
    const exports = {};
    vm.runInNewContext(outputText, { exports, URLSearchParams, console, ...globals, require(name) {
        assert.ok(name in dependencies, `Unexpected import: ${name}`);
        return dependencies[name];
    } }, { filename: file });
    return exports;
}

// Controlled hooks/timers exercise the page's actual event handlers and async effects.
function pageFixture(file, exportName, dependencies, globals = {}) {
    let cursor = 0;
    const slots = [], effects = [], timeouts = new Map(), intervals = new Map();
    let timerId = 0;
    const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
    const react = {
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
            return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
        },
        useRef(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = { current: initial };
            return slots[index];
        },
        useMemo(fn, deps) {
            const index = cursor++;
            if (!same(slots[index]?.deps, deps)) slots[index] = { value: fn(), deps };
            return slots[index].value;
        },
        useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
        useEffect(fn, deps) {
            const index = cursor++;
            if (!same(slots[index]?.deps, deps)) effects.push(() => {
                slots[index]?.cleanup?.();
                slots[index] = { deps, cleanup: fn() };
            });
        },
    };
    const jsx = (type, props) => ({ type, props });
    const timers = {
        setTimeout(fn) { timeouts.set(++timerId, fn); return timerId; },
        clearTimeout(id) { timeouts.delete(id); },
        setInterval(fn) { intervals.set(++timerId, fn); return timerId; },
        clearInterval(id) { intervals.delete(id); },
    };
    const component = load(file, {
        react, 'react/jsx-runtime': { jsx, jsxs: jsx },
        'lucide-react': new Proxy({}, { get: (_target, key) => key }),
        ...dependencies,
    }, { ...timers, window: timers, ...globals })[exportName];
    const render = () => {
        cursor = 0;
        const tree = component();
        effects.splice(0).forEach(fn => fn());
        return tree;
    };
    return {
        render, intervals,
        async settle() { let tree; for (let i = 0; i < 8; i++) { await Promise.resolve(); tree = render(); } return tree; },
        fireTimeouts() { const current = [...timeouts.values()]; timeouts.clear(); current.forEach(fn => fn()); },
    };
}
function find(tree, predicate) {
    if (!tree || typeof tree !== 'object') return;
    if (predicate(tree)) return tree;
    for (const child of [tree.props?.children].flat(Infinity)) {
        const match = find(child, predicate); if (match) return match;
    }
}
function text(tree) {
    if (tree == null || typeof tree === 'boolean') return '';
    if (typeof tree !== 'object') return String(tree);
    return [tree.props?.children].flat(Infinity).map(text).join(' ');
}
const pendingOrder = () => ({
    id: 1, orderCode: 'QA-ORDER', status: 'pending_payment', buyerEmail: 'buyer@example.com',
    totalAmount: 100000, expiresAt: new Date(Date.now() + 600000).toISOString(),
    items: [{ ticketTypeId: 1, ticketTypeName: 'Vé thường', quantity: 1, lineTotal: 100000 }],
});
function paymentFixture(fetchOrder, payOrder = async () => { throw new Error('Unexpected payment'); }) {
    const stored = new Map([['ticketbox-order-1', 'private-lookup-token']]);
    const retrieval = () => null;
    return { stored, retrieval, ...pageFixture('pages/public/OrderPaymentPage.tsx', 'OrderPaymentPage', {
        'react-router-dom': { useParams: () => ({ id: '1' }), useLocation: () => ({ state: null }), Navigate: 'Navigate' },
        '@/services/api': { ApiRequestError: class ApiRequestError extends Error {} },
        '@/services/order.service': { fetchOrder, payOrder },
        '@/lib/utils': { formatPrice: String },
        '@/components/event/TicketRetrievalForm': { TicketRetrievalForm: retrieval },
    }, { sessionStorage: { getItem: key => stored.get(key), removeItem: key => stored.delete(key) } }) };
}
const paymentButton = tree => find(tree, node => node.type === 'button' && text(node).includes('Xác nhận thanh toán mô phỏng'));

for (const [status, label] of [
    ['confirmed', 'Đơn hàng đã thanh toán mô phỏng'],
    ['cancelled', 'Đơn hàng đã bị hủy'],
    ['expired', 'Đơn hàng đã hết hạn'],
]) test(`reload ${status}: correct state without payment or countdown`, async () => {
    const f = paymentFixture(async () => ({ ...pendingOrder(), status, expiresAt: null }));
    const tree = await f.settle();
    assert.ok(text(tree).includes(label));
    assert.equal(paymentButton(tree), undefined);
    assert.equal(f.intervals.size, 0);
    if (status === 'confirmed') {
        assert.ok(find(tree, node => node.type === f.retrieval));
        assert.ok(!text(tree).includes('Đơn hàng đã hết hạn'));
    }
});

test('pending order enables payment, confirmed result shows QR and retains tab lookup for refresh', async () => {
    let calls = 0;
    const f = paymentFixture(async () => pendingOrder(), async () => {
        calls++;
        return { orderCode: 'QA-ORDER', buyerEmail: 'buyer@example.com', emailSent: false, emailMessage: 'Đang gửi',
            tickets: [{ ticketCode: 'TKT-1', ticketTypeName: 'Vé thường', qrDataUrl: 'data:image/png;base64,AA==' }] };
    });
    const button = paymentButton(await f.settle());
    assert.equal(button.props.disabled, false);
    await button.props.onClick();
    const tree = await f.settle();
    assert.equal(calls, 1);
    assert.ok(text(tree).includes('Thanh toán mô phỏng thành công'));
    assert.ok(find(tree, node => node.type === 'img' && node.props.alt === 'QR TKT-1'));
    assert.equal(f.stored.get('ticketbox-order-1'), 'private-lookup-token');
    assert.equal(f.intervals.size, 0);
});

test('lost payment response reads confirmed state instead of offering a second payment', async () => {
    let lookups = 0, payments = 0;
    const f = paymentFixture(async () => ({ ...pendingOrder(), status: ++lookups === 1 ? 'pending_payment' : 'confirmed' }), async () => {
        payments++; throw new Error('Lost response after commit');
    });
    await paymentButton(await f.settle()).props.onClick();
    const tree = await f.settle();
    assert.ok(text(tree).includes('Đơn hàng đã thanh toán mô phỏng'));
    assert.equal(paymentButton(tree), undefined);
    assert.equal(lookups, 2);
    assert.equal(payments, 1);
});

test('unavailable recovery locks payment until the user reads the order again', async () => {
    let lookups = 0;
    const f = paymentFixture(async () => {
        lookups++;
        if (lookups === 2) throw new Error('Offline');
        return { ...pendingOrder(), status: lookups === 1 ? 'pending_payment' : 'confirmed' };
    }, async () => { throw new Error('Offline'); });
    await paymentButton(await f.settle()).props.onClick();
    let tree = await f.settle();
    assert.equal(paymentButton(tree).props.disabled, true);
    assert.ok(find(tree, node => node.props?.role === 'alert'));
    find(tree, node => node.type === 'button' && text(node) === 'Tải lại trạng thái').props.onClick();
    tree = await f.settle();
    assert.equal(paymentButton(tree), undefined);
    assert.ok(text(tree).includes('Đơn hàng đã thanh toán mô phỏng'));
});

test('initial network failure offers retry instead of redirecting a valid order', async () => {
    let lookups = 0;
    const f = paymentFixture(async () => { if (++lookups === 1) throw new Error('Offline'); return pendingOrder(); });
    let tree = await f.settle();
    assert.ok(find(tree, node => node.props?.role === 'alert'));
    assert.equal(find(tree, node => node.type === 'Navigate'), undefined);
    find(tree, node => node.type === 'button' && text(node) === 'Thử lại').props.onClick();
    tree = await f.settle();
    assert.equal(paymentButton(tree).props.disabled, false);
});

function eventFixture(fetchEventList) {
    let params = new URLSearchParams('q=first&category=music');
    let refresh;
    const f = pageFixture('pages/public/EventListPage.tsx', 'EventListPage', {
        'react-router-dom': { useSearchParams: () => [params, (value) => { params = typeof value === 'function' ? value(params) : value; }] },
        '@/services/event.service': { fetchEventList },
        '@/services/category.service': { fetchCategories: async () => [{ slug: 'music', name: 'Âm nhạc' }] },
        '@/constants/eventconstants': { PAGE_SIZE: 3, EVENT_LIFECYCLE_FALLBACK_REFRESH_MS: 60000, CITY_OPTIONS: [], TIME_OPTIONS: [], SORT_OPTIONS: [] },
        '@/services/event-realtime.service': { subscribeToEventLifecycleUpdates: fn => { refresh = fn; return () => {}; } },
        '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
        '@/components/event/EventCard': { EventCard: 'EventCard' },
        '@/components/event/EventCardSkeleton': { EventCardSkeleton: 'EventCardSkeleton' },
        '@/components/shared/EmptyState': { EmptyState: 'EmptyState' },
        '@/components/shared/CategoryIcon': { CategoryIcon: 'CategoryIcon' },
        '@/components/shared/NativeSelect': { NativeSelect: 'NativeSelect' },
    });
    return { ...f, navigate(value) { params = new URLSearchParams(value); }, getParams: () => params, refresh: () => refresh() };
}
const searchInput = tree => find(tree, node => node.type === 'input');

test('same-route Header navigation and Back/Forward synchronize search/category and API requests', async () => {
    const requests = [];
    const f = eventFixture(async params => { requests.push(params); return { events: [], total: 0 }; });
    await f.settle(); f.fireTimeouts(); await f.settle();
    for (const value of ['q=second', 'q=first&category=music', 'q=second']) {
        f.navigate(value);
        let tree = await f.settle();
        assert.equal(searchInput(tree).props.value, new URLSearchParams(value).get('q'));
        f.fireTimeouts(); tree = await f.settle();
        assert.equal(requests.at(-1).q, new URLSearchParams(value).get('q'));
        assert.equal(requests.at(-1).category, new URLSearchParams(value).get('category') ?? undefined);
    }
    searchInput(f.render()).props.onChange({ target: { value: 'local search' } });
    assert.equal(f.getParams().get('q'), 'local search');
});

test('an old search response cannot overwrite a newer result', async () => {
    let resolveOld;
    const f = eventFixture(params => params.q === 'first'
        ? new Promise(resolve => { resolveOld = resolve; })
        : Promise.resolve({ events: [{ id: 'new' }], total: 1 }));
    f.render(); f.fireTimeouts();
    f.navigate('q=second'); f.render(); f.fireTimeouts();
    let tree = await f.settle();
    assert.equal(find(tree, node => node.type === 'EventCard').props.event.id, 'new');
    resolveOld({ events: [{ id: 'old' }], total: 1 });
    tree = await f.settle();
    assert.equal(find(tree, node => node.type === 'EventCard').props.event.id, 'new');
});

test('time filter reaches initial, load-more and realtime requests with API count preserved', async () => {
    const requests = [];
    const f = eventFixture(async params => {
        requests.push(params);
        // Even a date outside the browser clock's window must be trusted as server data.
        return { events: [{ id: String(params.page), startTime: '2099-01-01' }], total: 4 };
    });
    await f.settle(); f.fireTimeouts(); await f.settle();
    find(f.render(), node => node.props?.ariaLabel === 'Lọc thời gian').props.onChange('week');
    f.render(); f.fireTimeouts(); let tree = await f.settle();
    assert.equal(requests.at(-1).time, 'week');
    assert.ok(text(tree).includes('Hiển thị 1/4 sự kiện'));
    await find(tree, node => node.type === 'button' && text(node).includes('Xem thêm')).props.onClick();
    tree = await f.settle();
    assert.equal(requests.at(-1).page, 2);
    assert.equal(requests.at(-1).time, 'week');
    assert.ok(text(tree).includes('Hiển thị 2/4 sự kiện'));
    f.refresh(); await f.settle();
    assert.deepEqual(requests.slice(-2).map(params => [params.page, params.time]), [[1, 'week'], [2, 'week']]);
});

test('lookup error reporting distinguishes missing orders from network/service failures', async () => {
    class ApiRequestError extends Error { constructor(status) { super('Request failed'); this.status = status; } }
    let failure = new ApiRequestError(404);
    const service = load('services/order.service.ts', { './api': { ApiRequestError, apiPost: async () => { throw failure; } } });
    assert.equal(await service.fetchOrder('1', 'token', true), null);
    failure = new ApiRequestError(503);
    await assert.rejects(service.fetchOrder('1', 'token', true), error => error === failure);
    assert.equal(await service.fetchOrder('1', 'token'), null);
    failure = new Error('Network offline');
    await assert.rejects(service.fetchOrder('1', 'token', true), error => error === failure);
});
