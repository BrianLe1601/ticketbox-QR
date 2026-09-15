import { expireStaleOrders } from '../modules/checkout/checkout.service.js';

const RUN_INTERVAL_MS = 30_000; // 30s/lần — đủ sát so với thời gian giữ vé 10 phút

export function startExpireOrdersJob(): NodeJS.Timeout {
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const count = await expireStaleOrders();
            if (count > 0) {
                console.log(`[expire-orders-job] Đã hết hạn ${count} đơn hàng`);
            }
        } catch (error) {
            console.error('[expire-orders-job] Lỗi khi hết hạn đơn hàng:', error);
        } finally {
            running = false;
        }
    };

    void tick(); // chạy ngay khi server start, không đợi interval đầu tiên
    return setInterval(tick, RUN_INTERVAL_MS);
}
