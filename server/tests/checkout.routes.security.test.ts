import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';

const checkout = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrderByLookupToken: vi.fn(),
  payOrder: vi.fn(),
}));
vi.mock('../src/modules/checkout/checkout.service.js', () => checkout);
vi.mock('../src/services/email-verification.service.js', () => ({
  requestEmailVerification: vi.fn(),
  confirmEmailVerification: vi.fn(),
}));

import { checkoutRouter } from '../src/modules/checkout/checkout.routes.js';

const app = express();
app.use(express.json());
app.use('/api/checkout', checkoutRouter);
app.use((error: { statusCode?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(error.statusCode ?? 500).json({ success: false, code: error.code });
});

beforeEach(() => {
  vi.resetAllMocks();
  checkout.getOrderByLookupToken.mockResolvedValue({ id: 9, status: 'pending_payment' });
});

it('accepts the lookup credential only in a POST body', async () => {
  const response = await request(app).post('/api/checkout/orders/9/lookup').send({ token: 'secret-token' });
  expect(response.status).toBe(200);
  expect(checkout.getOrderByLookupToken).toHaveBeenCalledWith(9, 'secret-token');

  const legacy = await request(app).get('/api/checkout/orders/9?token=secret-token');
  expect(legacy.status).toBe(404);
  expect(checkout.getOrderByLookupToken).toHaveBeenCalledOnce();
});

it('rejects a missing lookup credential before reaching the service', async () => {
  expect((await request(app).post('/api/checkout/orders/9/lookup').send({})).status).toBe(400);
  expect(checkout.getOrderByLookupToken).not.toHaveBeenCalled();
});
