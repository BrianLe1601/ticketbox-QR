import crypto from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { env } from "../config/env.js";
import { syncEventLifecycleStatuses } from "../modules/events/event-lifecycle.service.js";
import { pool } from "./pool.js";

const QA_CATEGORY_SLUG = "qa-workflow";
const QA_STAFF_EMAIL = "qa.staff@ticketbox.local";
const COVER_URL = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

interface IdRow extends RowDataPacket { id: number }

interface EventFixture {
  name: string;
  slug: string;
  capacity: number;
  start: Date;
  end: Date;
  salesStart: Date;
  salesEnd: Date;
  checkinStart: Date;
  checkinEnd: Date;
  cover?: boolean;
}

function fromNow(days: number, hours = 0): Date {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function findUserId(connection: PoolConnection, email: string, role: "admin" | "staff") {
  const [rows] = await connection.execute<IdRow[]>(
    "SELECT id FROM users WHERE email=? AND role=? AND is_active=TRUE LIMIT 1",
    [email.toLowerCase(), role],
  );
  const row = rows[0];
  if (!row) throw new Error(`Run npm run seed first; missing active ${role}: ${email}`);
  return row.id;
}

async function cleanupPreviousFixtures(connection: PoolConnection, adminId: number) {
  const [categories] = await connection.execute<IdRow[]>(
    "SELECT id FROM categories WHERE slug=? LIMIT 1",
    [QA_CATEGORY_SLUG],
  );
  const category = categories[0];
  if (!category) return;

  const [eventRows] = await connection.execute<IdRow[]>(
    "SELECT id FROM events WHERE category_id=? ORDER BY id",
    [category.id],
  );
  const eventIds = eventRows.map((row) => row.id);
  if (eventIds.length === 0) {
    await connection.execute("DELETE FROM categories WHERE id=?", [category.id]);
    await connection.execute("DELETE FROM users WHERE email=?", [QA_STAFF_EMAIL]);
    return;
  }
  const eventPlaceholders = eventIds.map(() => "?").join(",");

  await connection.execute(
    `UPDATE events
       SET visibility='hidden', hidden_at=NOW(3), hidden_by=?,
           hidden_reason='Replacing local QA workflow fixtures'
     WHERE id IN (${eventPlaceholders}) AND visibility='visible'`,
    [adminId, ...eventIds],
  );
  await connection.execute(
    `DELETE FROM checkin_logs WHERE event_id IN (${eventPlaceholders})`,
    eventIds,
  );
  await connection.execute(
    `DELETE el FROM email_logs el
      JOIN orders o ON o.id=el.order_id
      WHERE o.event_id IN (${eventPlaceholders})`,
    eventIds,
  );
  await connection.execute(
    `DELETE r FROM refunds r
      JOIN orders o ON o.id=r.order_id
      WHERE o.event_id IN (${eventPlaceholders})`,
    eventIds,
  );
  await connection.execute(
    `DELETE p FROM payments p
      JOIN orders o ON o.id=p.order_id
      WHERE o.event_id IN (${eventPlaceholders})`,
    eventIds,
  );
  await connection.execute(
    `DELETE t FROM tickets t
      JOIN order_items oi ON oi.id=t.order_item_id
      JOIN orders o ON o.id=oi.order_id
      WHERE o.event_id IN (${eventPlaceholders})`,
    eventIds,
  );
  await connection.execute(
    `DELETE oi FROM order_items oi
      JOIN orders o ON o.id=oi.order_id
      WHERE o.event_id IN (${eventPlaceholders})`,
    eventIds,
  );
  await connection.execute(
    `DELETE FROM orders WHERE event_id IN (${eventPlaceholders})`,
    eventIds,
  );
  await connection.execute(
    `DELETE FROM event_staff WHERE event_id IN (${eventPlaceholders})`,
    eventIds,
  );
  await connection.execute(
    `DELETE FROM ticket_types WHERE event_id IN (${eventPlaceholders})`,
    eventIds,
  );
  await connection.execute(`DELETE FROM events WHERE id IN (${eventPlaceholders})`, eventIds);
  await connection.execute("DELETE FROM categories WHERE id=?", [category.id]);
  await connection.execute("DELETE FROM users WHERE email=?", [QA_STAFF_EMAIL]);
}

async function createQaStaff(connection: PoolConnection, passwordHash: string) {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO users(full_name,email,password_hash,role,is_active)
     VALUES ('QA Gate Staff',?,?,'staff',TRUE)`,
    [QA_STAFF_EMAIL, passwordHash],
  );
  return result.insertId;
}

async function createCategory(connection: PoolConnection) {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO categories(name,slug,description,icon,sort_order)
     VALUES ('QA Workflow Scenarios',?,'Local-only Event lifecycle fixtures.','flask-conical',999)`,
    [QA_CATEGORY_SLUG],
  );
  return result.insertId;
}

async function createEvent(
  connection: PoolConnection,
  adminId: number,
  categoryId: number,
  fixture: EventFixture,
) {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO events
      (name,slug,description,category_id,venue,address,city,venue_capacity,
       cover_image_url,cover_image_alt,start_time,end_time,sales_start_at,
       sales_end_at,checkin_start_at,checkin_end_at,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      fixture.name, fixture.slug,
      `Automated local fixture for ${fixture.slug}. Do not use as production data.`,
      categoryId, "TicketBox QA Hall", "01 Workflow Street", "Ho Chi Minh City",
      fixture.capacity, fixture.cover === false ? null : COVER_URL,
      fixture.cover === false ? null : `${fixture.name} test cover`, fixture.start,
      fixture.end, fixture.salesStart, fixture.salesEnd, fixture.checkinStart,
      fixture.checkinEnd, adminId,
    ],
  );
  return result.insertId;
}

async function createTier(
  connection: PoolConnection,
  eventId: number,
  name: string,
  price: number,
  capacity: number,
  active = true,
  salesStart: Date | null = null,
  salesEnd: Date | null = null,
) {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO ticket_types
      (event_id,name,description,price,capacity,max_per_order,sales_start_at,sales_end_at,is_active)
     VALUES (?,?,?,?,?,5,?,?,?)`,
    [eventId, name, `${name} QA tier`, price, capacity, salesStart, salesEnd, active],
  );
  return result.insertId;
}

async function publish(connection: PoolConnection, eventId: number, publishedAt = new Date()) {
  await connection.execute(
    "UPDATE events SET status='published',published_at=? WHERE id=?",
    [publishedAt, eventId],
  );
}

async function createOrder(
  connection: PoolConnection,
  eventId: number,
  tierId: number,
  suffix: string,
  quantity: number,
  unitPrice: number,
  confirmed: boolean,
  staffId?: number,
) {
  const total = quantity * unitPrice;
  const [orderResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO orders
      (order_code,event_id,buyer_name,buyer_email,total_quantity,subtotal_amount,
       discount_amount,total_amount,lookup_token_hash,idempotency_key,expires_at)
     VALUES (?,?,?,?,?,?,0,?,?,?,DATE_ADD(NOW(3),INTERVAL 10 MINUTE))`,
    [
      `QA-${suffix}`, eventId, `QA Buyer ${suffix}`, `qa.${suffix.toLowerCase()}@example.test`,
      quantity, total, total, sha256(`lookup-${suffix}`), `qa-idempotency-${suffix}`,
    ],
  );
  const orderId = orderResult.insertId;
  const [itemResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO order_items
      (order_id,ticket_type_id,ticket_type_name,unit_price,quantity,line_total)
     SELECT ?,id,name,price,?,price*? FROM ticket_types WHERE id=?`,
    [orderId, quantity, quantity, tierId],
  );
  await connection.execute(
    "UPDATE ticket_types SET reserved_quantity=reserved_quantity+? WHERE id=?",
    [quantity, tierId],
  );

  if (!confirmed) {
    await connection.execute(
      `INSERT INTO payments(order_id,payment_code,method,amount,status)
       VALUES (?,?,'simulated',?,'pending')`,
      [orderId, `PAY-QA-${suffix}`, total],
    );
    return { orderId, ticketIds: [] as number[] };
  }

  await connection.execute(
    "UPDATE ticket_types SET reserved_quantity=reserved_quantity-?,sold_quantity=sold_quantity+? WHERE id=?",
    [quantity, quantity, tierId],
  );
  await connection.execute(
    "UPDATE orders SET status='confirmed',confirmed_at=NOW(3) WHERE id=?",
    [orderId],
  );
  await connection.execute(
    `INSERT INTO payments(order_id,payment_code,method,amount,status,paid_at)
     VALUES (?,?,'simulated',?,'success',NOW(3))`,
    [orderId, `PAY-QA-${suffix}`, total],
  );

  const ticketIds: number[] = [];
  for (let index = 1; index <= quantity; index += 1) {
    const [ticketResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO tickets
        (order_item_id,ticket_code,qr_token_hash,holder_name,holder_email)
       VALUES (?,?,?,?,?)`,
      [
        itemResult.insertId, `TKT-QA-${suffix}-${index}`,
        sha256(`qr-${suffix}-${index}`), `QA Holder ${index}`,
        `qa.${suffix.toLowerCase()}@example.test`,
      ],
    );
    ticketIds.push(ticketResult.insertId);
  }
  await connection.execute(
    `INSERT INTO email_logs(order_id,recipient,email_type,status,sent_at,attempt_count)
     VALUES (?,?,'ticket_issued','sent',NOW(3),1)`,
    [orderId, `qa.${suffix.toLowerCase()}@example.test`],
  );

  if (staffId !== undefined && ticketIds[0] !== undefined) {
    await connection.execute(
      `UPDATE tickets SET status='checked_in',checked_in_at=NOW(3),checked_in_by=?
       WHERE id=?`,
      [staffId, ticketIds[0]],
    );
    await connection.execute(
      `INSERT INTO checkin_logs(ticket_id,event_id,staff_id,result_code,scanned_code_hash,message)
       VALUES (?,?,?,'SUCCESS',?,'QA successful scan')`,
      [ticketIds[0], eventId, staffId, sha256(`scan-${suffix}-1`)],
    );
  }
  return { orderId, ticketIds };
}

async function seedWorkflows() {
  if (env.NODE_ENV === "production") {
    throw new Error("Workflow fixtures are disabled in production");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const adminId = await findUserId(connection, env.SEED_ADMIN_EMAIL, "admin");
    const baseStaffId = await findUserId(connection, env.SEED_STAFF_EMAIL, "staff");
    const [adminHashRows] = await connection.execute<(RowDataPacket & { password_hash: string })[]>(
      "SELECT password_hash FROM users WHERE id=?",
      [adminId],
    );
    const passwordHash = adminHashRows[0]?.password_hash;
    if (!passwordHash) throw new Error("Seed Admin password hash is unavailable");

    await cleanupPreviousFixtures(connection, adminId);
    const qaStaffId = await createQaStaff(connection, passwordHash);
    const categoryId = await createCategory(connection);

    const draftNeedsTicket = await createEvent(connection, adminId, categoryId, {
      name: "[QA] Draft — Missing Cover & Ticket", slug: "qa-draft-needs-ticket",
      capacity: 100, start: fromNow(30), end: fromNow(30, 4),
      salesStart: fromNow(1), salesEnd: fromNow(30, 3),
      checkinStart: fromNow(29, 23), checkinEnd: fromNow(30, 4), cover: false,
    });

    const onSaleStart = fromNow(20);
    const onSaleEnd = fromNow(20, 4);
    const draftReady = await createEvent(connection, adminId, categoryId, {
      name: "[QA] Draft — Ready To Publish", slug: "qa-draft-ready",
      capacity: 120, start: onSaleStart, end: onSaleEnd,
      salesStart: fromNow(-1), salesEnd: fromNow(20, 3),
      checkinStart: fromNow(19, 23), checkinEnd: onSaleEnd,
    });
    await createTier(connection, draftReady, "General Admission", 150_000, 120);

    const comingSoon = await createEvent(connection, adminId, categoryId, {
      name: "[QA] Published — Coming Soon", slug: "qa-published-coming-soon",
      capacity: 80, start: fromNow(45), end: fromNow(45, 3),
      salesStart: fromNow(5), salesEnd: fromNow(45, 2),
      checkinStart: fromNow(44, 23), checkinEnd: fromNow(45, 3),
    });
    await createTier(connection, comingSoon, "Scheduled Pass", 100_000, 80);
    await publish(connection, comingSoon);

    const onSale = await createEvent(connection, adminId, categoryId, {
      name: "[QA] Published — On Sale With Orders", slug: "qa-published-on-sale",
      capacity: 200, start: onSaleStart, end: onSaleEnd,
      salesStart: fromNow(-2), salesEnd: fromNow(20, 3),
      checkinStart: fromNow(19, 23), checkinEnd: onSaleEnd,
    });
    const onSaleGeneral = await createTier(connection, onSale, "General Sale", 200_000, 150);
    await createTier(connection, onSale, "Last Minute", 120_000, 50, true, fromNow(18), fromNow(20, 3));
    await publish(connection, onSale);
    await createOrder(connection, onSale, onSaleGeneral, "ONSALE-PENDING", 2, 200_000, false);
    await createOrder(connection, onSale, onSaleGeneral, "ONSALE-PAID", 3, 200_000, true);
    await connection.execute(
      "INSERT INTO event_staff(event_id,staff_id,assigned_by) VALUES (?,?,?)",
      [onSale, qaStaffId, adminId],
    );

    const hiddenPaused = await createEvent(connection, adminId, categoryId, {
      name: "[QA] Hidden — All Tiers Paused", slug: "qa-hidden-all-paused",
      capacity: 60, start: fromNow(35), end: fromNow(35, 3),
      salesStart: fromNow(-1), salesEnd: fromNow(35, 2),
      checkinStart: fromNow(34, 23), checkinEnd: fromNow(35, 3),
    });
    await createTier(connection, hiddenPaused, "Paused Tier", 90_000, 60);
    await publish(connection, hiddenPaused);
    await connection.execute(
      "UPDATE events SET visibility='hidden',hidden_at=NOW(3),hidden_by=?,hidden_reason='QA maintenance' WHERE id=?",
      [adminId, hiddenPaused],
    );
    await connection.execute("UPDATE ticket_types SET is_active=FALSE WHERE event_id=?", [hiddenPaused]);

    const ongoing = await createEvent(connection, adminId, categoryId, {
      name: "[QA] Ongoing — Check-in Active", slug: "qa-ongoing-checkin",
      capacity: 50, start: fromNow(0, -1), end: fromNow(0, 3),
      salesStart: fromNow(-10), salesEnd: fromNow(0, 2),
      checkinStart: fromNow(0, -2), checkinEnd: fromNow(0, 3),
    });
    const ongoingTier = await createTier(connection, ongoing, "Gate Pass", 50_000, 50);
    await publish(connection, ongoing, fromNow(-10));
    await connection.execute("UPDATE events SET status='ongoing' WHERE id=?", [ongoing]);
    await connection.execute(
      "INSERT INTO event_staff(event_id,staff_id,assigned_by) VALUES (?,?,?)",
      [ongoing, baseStaffId, adminId],
    );
    await createOrder(connection, ongoing, ongoingTier, "ONGOING-PAID", 2, 50_000, true, baseStaffId);

    const completed = await createEvent(connection, adminId, categoryId, {
      name: "[QA] Completed — Read-only History", slug: "qa-completed-history",
      capacity: 40, start: fromNow(-2), end: fromNow(-1),
      salesStart: fromNow(-20), salesEnd: fromNow(-1, -1),
      checkinStart: fromNow(-2, -1), checkinEnd: fromNow(-1),
    });
    await createTier(connection, completed, "Archived Pass", 75_000, 40);
    await publish(connection, completed, fromNow(-20));
    await connection.execute("UPDATE events SET status='ongoing' WHERE id=?", [completed]);
    await connection.execute("UPDATE events SET status='completed',completed_at=? WHERE id=?", [fromNow(-1), completed]);

    const cancelledEmpty = await createEvent(connection, adminId, categoryId, {
      name: "[QA] Cancelled — No Orders", slug: "qa-cancelled-no-orders",
      capacity: 30, start: fromNow(50), end: fromNow(50, 2),
      salesStart: fromNow(-1), salesEnd: fromNow(50, 1),
      checkinStart: fromNow(49, 23), checkinEnd: fromNow(50, 2),
    });
    await createTier(connection, cancelledEmpty, "Cancelled Pass", 60_000, 30);
    await publish(connection, cancelledEmpty);
    await connection.execute(
      "UPDATE events SET visibility='hidden',hidden_at=NOW(3),hidden_by=?,hidden_reason='QA unavoidable incident' WHERE id=?",
      [adminId, cancelledEmpty],
    );
    await connection.execute("UPDATE ticket_types SET is_active=FALSE WHERE event_id=?", [cancelledEmpty]);
    await connection.execute(
      "UPDATE events SET status='cancelled',cancelled_at=NOW(3),cancellation_reason='QA unavoidable incident' WHERE id=?",
      [cancelledEmpty],
    );

    const cancelledOrders = await createEvent(connection, adminId, categoryId, {
      name: "[QA] Cancelled — Orders & Refund", slug: "qa-cancelled-with-orders",
      capacity: 100, start: fromNow(55), end: fromNow(55, 3),
      salesStart: fromNow(-2), salesEnd: fromNow(55, 2),
      checkinStart: fromNow(54, 23), checkinEnd: fromNow(55, 3),
    });
    const cancelledTier = await createTier(connection, cancelledOrders, "Refundable Pass", 300_000, 100);
    await publish(connection, cancelledOrders);
    const pending = await createOrder(connection, cancelledOrders, cancelledTier, "CANCEL-PENDING", 2, 300_000, false);
    const paid = await createOrder(connection, cancelledOrders, cancelledTier, "CANCEL-PAID", 2, 300_000, true);
    await connection.execute(
      "UPDATE events SET visibility='hidden',hidden_at=NOW(3),hidden_by=?,hidden_reason='QA cancellation workflow' WHERE id=?",
      [adminId, cancelledOrders],
    );
    await connection.execute("UPDATE ticket_types SET reserved_quantity=reserved_quantity-2 WHERE id=?", [cancelledTier]);
    await connection.execute("UPDATE payments SET status='cancelled' WHERE order_id=? AND status='pending'", [pending.orderId]);
    await connection.execute("UPDATE orders SET status='cancelled',cancelled_at=NOW(3) WHERE id=?", [pending.orderId]);
    await connection.execute(
      `INSERT INTO refunds(order_id,amount,status,reason)
       SELECT id,total_amount,'pending','QA cancellation workflow' FROM orders WHERE id=?`,
      [paid.orderId],
    );
    await connection.execute(
      "UPDATE tickets SET status='cancelled',cancelled_at=NOW(3),cancelled_by=?,cancel_reason='QA cancellation workflow' WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id=?)",
      [adminId, paid.orderId],
    );
    await connection.execute(
      `INSERT INTO email_logs(order_id,recipient,email_type,status)
       SELECT id,buyer_email,'order_cancelled','pending' FROM orders WHERE id IN (?,?)`,
      [pending.orderId, paid.orderId],
    );
    await connection.execute("UPDATE ticket_types SET is_active=FALSE WHERE event_id=?", [cancelledOrders]);
    await connection.execute(
      "UPDATE events SET status='cancelled',cancelled_at=NOW(3),cancellation_reason='QA cancellation workflow' WHERE id=?",
      [cancelledOrders],
    );

    await connection.commit();
    const lifecycle = await syncEventLifecycleStatuses();
    console.log("[seed:workflows] 9 Event scenarios created in category qa-workflow");
    console.log("[seed:workflows] QA Staff uses the same local password as the seeded Admin");
    console.log(`[seed:workflows] Draft without tier id: ${draftNeedsTicket}`);
    console.log(`[seed:workflows] Lifecycle sync — started: ${lifecycle.started}; completed: ${lifecycle.completed}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

void seedWorkflows();
