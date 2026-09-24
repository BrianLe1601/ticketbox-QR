import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/middlewares/authenticate.js', () => ({
    authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (!req.headers.authorization) { res.status(401).json({ success: false }); return; }
        req.authUser = { id: 1, fullName: 'Test', email: 'test@example.com', role: req.headers.authorization === 'admin' ? 'admin' : 'staff' };
        next();
    },
}));
const service = vi.hoisted(() => ({ getOrderStats: vi.fn(), listOrders: vi.fn(), getOrderDetail: vi.fn(), cancelOrder: vi.fn(), resendTicketEmail: vi.fn(), retryOrderEmail: vi.fn() }));
vi.mock('../src/modules/orders/admin-orders.service.js', () => service);
import { adminOrdersRouter } from '../src/modules/orders/admin-orders.routes.js';
const app = express();
app.use(express.json()); app.use('/api/admin/orders', adminOrdersRouter);
app.use((error: { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(error.statusCode ?? 500).json({ success: false }); });
beforeEach(() => {
    vi.resetAllMocks();
    service.retryOrderEmail.mockResolvedValue({ orderId: 1, jobId: 3, queued: true, status: 'pending', message: 'Đã xếp lịch thử gửi lại email.' });
});
it('requires authentication and administrator authorization for retry', async () => {
    const path = '/api/admin/orders/1/email-logs/2/retry';
    expect((await request(app).post(path)).status).toBe(401);
    expect((await request(app).post(path).set('Authorization', 'staff')).status).toBe(403);
    expect(service.retryOrderEmail).not.toHaveBeenCalled();
});
it.each(['/0/email-logs/2/retry', '/1/email-logs/abc/retry', '/1/email-logs/-2/retry'])('validates retry identifiers %s', async path => {
    expect((await request(app).post(`/api/admin/orders${path}`).set('Authorization', 'admin')).status).toBe(400);
    expect(service.retryOrderEmail).not.toHaveBeenCalled();
});
it('returns an enqueue acknowledgement for Admin retry', async () => {
    const response = await request(app).post('/api/admin/orders/1/email-logs/2/retry').set('Authorization', 'admin');
    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ success: true, data: { queued: true, jobId: 3, status: 'pending' } });
    expect(service.retryOrderEmail).toHaveBeenCalledWith(1, 2);
});
