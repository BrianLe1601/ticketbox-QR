import { beforeEach, expect, it, vi } from 'vitest';

const checkout = vi.hoisted(() => ({
  withTransaction: vi.fn(),
  findOrderByIdForUpdate: vi.fn(),
  findOrderEventId: vi.fn(),
  lockEventRow: vi.fn(),
}));
const repo = vi.hoisted(() => ({
  findOrderStats: vi.fn(), findOrdersList: vi.fn(), findOrderDetail: vi.fn(), findOrderItems: vi.fn(),
  findOrderTickets: vi.fn(), findOrderPayments: vi.fn(), findOrderEmailLogs: vi.fn(), findOrderRefund: vi.fn(),
  findAdminOrderEventOptions: vi.fn(), cancelPendingOrder: vi.fn(), findRefundForUpdate: vi.fn(), transitionRefund: vi.fn(),
}));
vi.mock('../src/modules/checkout/checkout.repository.js', () => checkout);
vi.mock('../src/modules/orders/admin-orders.repository.js', () => repo);
vi.mock('../src/modules/tickets/ticket-email.repository.js', () => ({ enqueueTicketEmail: vi.fn() }));

import { cancelOrder, getOrderStats, updateRefundStatus } from '../src/modules/orders/admin-orders.service.js';

const connection = {};
beforeEach(() => {
  vi.resetAllMocks();
  checkout.withTransaction.mockImplementation(async (work: (conn: object) => Promise<unknown>) => work(connection));
  checkout.findOrderEventId.mockResolvedValue(3);
  checkout.lockEventRow.mockResolvedValue({ id: 3 });
  repo.findOrderDetail.mockResolvedValue({
    id: 8, order_code: 'ORDER-8', event_id: 3, event_name: 'Event', buyer_name: 'Buyer', buyer_email: 'buyer@example.com',
    buyer_phone: null, total_quantity: 1, subtotal_amount: '100', discount_amount: '0', total_amount: '100',
    status: 'pending_payment', expires_at: null, confirmed_at: null, expired_at: null, cancelled_at: null, created_at: new Date(),
  });
  repo.findOrderItems.mockResolvedValue([]); repo.findOrderTickets.mockResolvedValue([]); repo.findOrderPayments.mockResolvedValue([]);
  repo.findOrderEmailLogs.mockResolvedValue([]); repo.findOrderRefund.mockResolvedValue(null);
  repo.transitionRefund.mockResolvedValue(true);
});

it('cancels only pending_payment Orders and locks Event before Order', async () => {
  checkout.findOrderByIdForUpdate.mockResolvedValue({ id: 8, status: 'pending_payment' });
  await cancelOrder(8);
  expect(checkout.findOrderEventId).toHaveBeenCalledWith(connection, 8);
  expect(checkout.lockEventRow).toHaveBeenCalledWith(connection, 3);
  expect(repo.cancelPendingOrder).toHaveBeenCalledWith(connection, 8);

  checkout.findOrderByIdForUpdate.mockResolvedValue({ id: 8, status: 'confirmed' });
  await expect(cancelOrder(8)).rejects.toMatchObject({ statusCode: 409, code: 'ORDER_NOT_CANCELLABLE' });
  expect(repo.cancelPendingOrder).toHaveBeenCalledOnce();
});

it('enforces the simulated Refund state machine while preserving the confirmed Order', async () => {
  checkout.findOrderByIdForUpdate.mockResolvedValue({ id: 8, status: 'confirmed' });
  repo.findRefundForUpdate.mockResolvedValue({ id: 6, order_id: 8, status: 'pending' });
  await updateRefundStatus(8, { status: 'processing' });
  expect(repo.transitionRefund).toHaveBeenCalledWith(connection, 6, 'pending', 'processing', null);

  repo.findRefundForUpdate.mockResolvedValue({ id: 6, order_id: 8, status: 'pending' });
  await expect(updateRefundStatus(8, { status: 'completed' })).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_REFUND_TRANSITION' });

  repo.findRefundForUpdate.mockResolvedValue({ id: 6, order_id: 8, status: 'processing' });
  await updateRefundStatus(8, { status: 'failed', failureReason: 'Mô phỏng lỗi nhà cung cấp' });
  expect(repo.transitionRefund).toHaveBeenLastCalledWith(connection, 6, 'processing', 'failed', 'Mô phỏng lỗi nhà cung cấp');
});

it('passes the stable Event scope to Order aggregate counts', async () => {
  repo.findOrderStats.mockResolvedValue({ total: 0, pendingPayment: 0, confirmed: 0, expired: 0, cancelled: 0 });
  await getOrderStats(3);
  expect(repo.findOrderStats).toHaveBeenCalledWith(3);
});
