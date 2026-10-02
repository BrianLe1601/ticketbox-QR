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
  checkout.createOrder.mockResolvedValue({ id: 10, status: 'pending_payment' });
  checkout.getOrderByLookupToken.mockResolvedValue({ id: 9, status: 'pending_payment' });
});

const orderPayload = {
  eventId: 1,
  emailVerificationToken: 'verified-token',
  items: [{ ticketTypeId: 2, quantity: 1 }],
  buyer: { name: 'Nguyễn Văn A', email: 'buyer@example.com', phone: '0912345678' },
};

it('requires a valid Vietnamese phone number before creating an order', async () => {
  const missingPhone = { ...orderPayload, buyer: { name: orderPayload.buyer.name, email: orderPayload.buyer.email } };
  const letters = { ...orderPayload, buyer: { ...orderPayload.buyer, phone: '09abc45678' } };

  expect((await request(app).post('/api/checkout/orders').set('Idempotency-Key', 'checkout-phone-test-1').send(missingPhone)).status).toBe(400);
  expect((await request(app).post('/api/checkout/orders').set('Idempotency-Key', 'checkout-phone-test-2').send(letters)).status).toBe(400);
  expect(checkout.createOrder).not.toHaveBeenCalled();

  const valid = await request(app).post('/api/checkout/orders').set('Idempotency-Key', 'checkout-phone-test-3').send(orderPayload);
  expect(valid.status).toBe(201);
  expect(checkout.createOrder).toHaveBeenCalledWith(orderPayload, 'checkout-phone-test-3', '');
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
