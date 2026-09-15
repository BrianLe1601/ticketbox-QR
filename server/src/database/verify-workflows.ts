import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { env } from "../config/env.js";
import { pool } from "./pool.js";

interface CountRow extends RowDataPacket { total: number }
interface EventRow extends RowDataPacket {
  id: number;
  slug: string;
  status: string;
  visibility: string;
}

const results: { name: string; passed: boolean; detail?: string }[] = [];

function check(name: string, condition: boolean, detail?: string) {
  results.push({ name, passed: condition, ...(detail ? { detail } : {}) });
}

type DatabaseValue = string | number | boolean | Date | null;

async function count(connection: PoolConnection, sql: string, params: DatabaseValue[] = []) {
  const [rows] = await connection.execute<CountRow[]>(sql, params);
  return Number(rows[0]?.total ?? 0);
}

async function expectRejected(
  connection: PoolConnection,
  name: string,
  operation: () => Promise<unknown>,
  expectedError: string,
) {
  await connection.beginTransaction();
  let correctlyRejected = false;
  let detail = "";
  try {
    await operation();
  } catch (error) {
    const databaseError = error as { code?: string; sqlMessage?: string; message?: string };
    detail = `${databaseError.code ?? "DB_ERROR"}: ${databaseError.sqlMessage ?? databaseError.message ?? "rejected"}`;
    correctlyRejected = detail.includes(expectedError);
  } finally {
    await connection.rollback();
  }
  check(name, correctlyRejected, detail || "Unsafe operation unexpectedly succeeded");
}

async function verify() {
  if (env.NODE_ENV === "production") {
    throw new Error("Database workflow verification is disabled in production");
  }

  const connection = await pool.getConnection();
  try {
    const [triggerRows] = await connection.query<RowDataPacket[]>("SHOW TRIGGERS");
    if (triggerRows.length === 0) {
      console.log("INFO  Trigger metadata is hidden from ticketbox_app; behavior is verified below.");
    } else {
      check("Schema installs all 18 integrity triggers", triggerRows.length === 18, `found ${triggerRows.length}`);
    }
    check("Schema contains exactly 13 base tables", await count(
      connection,
      "SELECT COUNT(*) total FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'",
    ) === 13);
    check("Category -> Event uses RESTRICT", await count(
      connection,
      `SELECT COUNT(*) total
         FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA=DATABASE()
          AND CONSTRAINT_NAME='fk_events_category'
          AND DELETE_RULE='RESTRICT'`,
    ) === 1);

    const [events] = await connection.query<EventRow[]>(
      `SELECT e.id,e.slug,e.status,e.visibility
         FROM events e JOIN categories c ON c.id=e.category_id
        WHERE c.slug='qa-workflow' ORDER BY e.id`,
    );
    const eventBySlug = new Map(events.map((event) => [event.slug, event]));
    check("Nine documented Event fixtures exist", events.length === 9, `found ${events.length}`);

    const expectedStates: Record<string, [string, string]> = {
      "qa-draft-needs-ticket": ["draft", "visible"],
      "qa-draft-ready": ["draft", "visible"],
      "qa-published-coming-soon": ["published", "visible"],
      "qa-published-on-sale": ["published", "visible"],
      "qa-hidden-all-paused": ["published", "hidden"],
      "qa-ongoing-checkin": ["ongoing", "visible"],
      "qa-completed-history": ["completed", "visible"],
      "qa-cancelled-no-orders": ["cancelled", "hidden"],
      "qa-cancelled-with-orders": ["cancelled", "hidden"],
    };
    for (const [slug, expected] of Object.entries(expectedStates)) {
      const event = eventBySlug.get(slug);
      check(`${slug} has ${expected[0]}/${expected[1]}`,
        event?.status === expected[0] && event.visibility === expected[1]);
    }

    check("Draft-not-ready has no Ticket Type", await count(
      connection,
      "SELECT COUNT(*) total FROM ticket_types WHERE event_id=?",
      [eventBySlug.get("qa-draft-needs-ticket")?.id ?? 0],
    ) === 0);
    check("Coming-soon tier starts in the future", await count(
      connection,
      `SELECT COUNT(*) total FROM ticket_types tt JOIN events e ON e.id=tt.event_id
        WHERE tt.event_id=? AND tt.is_active=TRUE
          AND COALESCE(tt.sales_start_at,e.sales_start_at)>NOW(3)`,
      [eventBySlug.get("qa-published-coming-soon")?.id ?? 0],
    ) === 1);
    check("On-sale fixture has one pending and one confirmed Order", await count(
      connection,
      "SELECT COUNT(DISTINCT status) total FROM orders WHERE event_id=? AND status IN ('pending_payment','confirmed')",
      [eventBySlug.get("qa-published-on-sale")?.id ?? 0],
    ) === 2);
    check("On-sale inventory records 2 reserved and 3 sold", await count(
      connection,
      "SELECT COUNT(*) total FROM ticket_types WHERE event_id=? AND reserved_quantity=2 AND sold_quantity=3",
      [eventBySlug.get("qa-published-on-sale")?.id ?? 0],
    ) === 1);
    check("Ongoing fixture has an auditable successful check-in", await count(
      connection,
      "SELECT COUNT(*) total FROM checkin_logs WHERE event_id=? AND result_code='SUCCESS'",
      [eventBySlug.get("qa-ongoing-checkin")?.id ?? 0],
    ) === 1);
    check("Cancelled-with-orders has one refund", await count(
      connection,
      "SELECT COUNT(*) total FROM refunds r JOIN orders o ON o.id=r.order_id WHERE o.event_id=? AND r.status='pending'",
      [eventBySlug.get("qa-cancelled-with-orders")?.id ?? 0],
    ) === 1);
    check("Cancelled-with-orders invalidates all issued QR Tickets", await count(
      connection,
      `SELECT COUNT(*) total FROM tickets t
        JOIN order_items oi ON oi.id=t.order_item_id
        JOIN orders o ON o.id=oi.order_id
       WHERE o.event_id=? AND t.status<>'cancelled'`,
      [eventBySlug.get("qa-cancelled-with-orders")?.id ?? 0],
    ) === 0);
    check("Cancelled-with-orders queues two cancellation emails", await count(
      connection,
      `SELECT COUNT(*) total FROM email_logs el JOIN orders o ON o.id=el.order_id
        WHERE o.event_id=? AND el.email_type='order_cancelled'`,
      [eventBySlug.get("qa-cancelled-with-orders")?.id ?? 0],
    ) === 2);

    const [retryMailRows] = await connection.execute<(RowDataPacket & { id: number })[]>(
      `SELECT el.id FROM email_logs el JOIN orders o ON o.id=el.order_id
        WHERE o.event_id=? AND el.email_type='order_cancelled' ORDER BY el.id LIMIT 1`,
      [eventBySlug.get("qa-cancelled-with-orders")?.id ?? 0],
    );
    const retryMailId = retryMailRows[0]?.id ?? 0;
    await connection.beginTransaction();
    let emailRetryAccepted = false;
    let emailRetryDetail = "";
    try {
      await connection.execute("UPDATE email_logs SET status='processing' WHERE id=?", [retryMailId]);
      await connection.execute(
        "UPDATE email_logs SET status='pending',attempt_count=attempt_count+1,next_attempt_at=DATE_ADD(NOW(3),INTERVAL 5 MINUTE) WHERE id=?",
        [retryMailId],
      );
      emailRetryAccepted = true;
    } catch (error) {
      const databaseError = error as { code?: string; sqlMessage?: string; message?: string };
      emailRetryDetail = `${databaseError.code ?? "DB_ERROR"}: ${databaseError.sqlMessage ?? databaseError.message ?? "rejected"}`;
    } finally {
      await connection.rollback();
    }
    check("Cancellation email supports processing -> pending retry", emailRetryAccepted, emailRetryDetail);

    const hiddenId = eventBySlug.get("qa-hidden-all-paused")?.id ?? 0;
    const onSaleId = eventBySlug.get("qa-published-on-sale")?.id ?? 0;
    const draftReadyId = eventBySlug.get("qa-draft-ready")?.id ?? 0;
    const completedId = eventBySlug.get("qa-completed-history")?.id ?? 0;
    const ongoingId = eventBySlug.get("qa-ongoing-checkin")?.id ?? 0;
    const [qaStaffRows] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM users WHERE email='qa.staff@ticketbox.local' LIMIT 1",
    );
    const qaStaffId = qaStaffRows[0]?.id ?? 0;
    const [adminRows] = await connection.execute<(RowDataPacket & { id: number })[]>(
      "SELECT id FROM users WHERE email=? LIMIT 1",
      [env.SEED_ADMIN_EMAIL.toLowerCase()],
    );
    const adminId = adminRows[0]?.id ?? 0;
    const [orderItemRows] = await connection.execute<(RowDataPacket & { id: number })[]>(
      `SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id
        WHERE o.event_id=? ORDER BY oi.id LIMIT 1`,
      [onSaleId],
    );
    const orderItemId = orderItemRows[0]?.id ?? 0;

    await expectRejected(connection, "Referenced Category cannot be deleted", () =>
      connection.execute("DELETE FROM categories WHERE slug='qa-workflow'"), "ER_ROW_IS_REFERENCED");
    await expectRejected(connection, "Overlapping Staff assignment is rejected", () =>
      connection.execute(
        "INSERT INTO event_staff(event_id,staff_id,assigned_by) VALUES (?,?,?)",
        [draftReadyId, qaStaffId, adminId],
      ), "Staff is already assigned to an overlapping Event");
    await expectRejected(connection, "Hidden Event with all tiers paused cannot be shown", () =>
      connection.execute(
        "UPDATE events SET visibility='visible',hidden_at=NULL,hidden_by=NULL,hidden_reason=NULL WHERE id=?",
        [hiddenId],
      ), "requires an active valid Ticket Type");
    await expectRejected(connection, "Ticket allocation beyond venue capacity is rejected", () =>
      connection.execute(
        "INSERT INTO ticket_types(event_id,name,price,capacity,max_per_order,is_active) VALUES (?,'Unsafe Overflow',1,999,1,FALSE)",
        [hiddenId],
      ), "Ticket allocation exceeds Event venue capacity");
    await expectRejected(connection, "Completed Event cannot return to Published", () =>
      connection.execute("UPDATE events SET status='published',completed_at=NULL WHERE id=?", [completedId]),
      "Invalid Event lifecycle transition");
    await expectRejected(connection, "Order Item purchase snapshot is immutable", () =>
      connection.execute(
        "UPDATE order_items SET ticket_type_name='Tampered Tier' WHERE id=?",
        [orderItemId],
      ), "Order item purchase snapshots are immutable");
    await expectRejected(connection, "Unassigned Staff cannot record SUCCESS check-in", () =>
      connection.execute(
        `INSERT INTO checkin_logs(ticket_id,event_id,staff_id,result_code,scanned_code_hash)
         SELECT t.id,?,?,'SUCCESS',REPEAT('a',64)
           FROM tickets t JOIN order_items oi ON oi.id=t.order_item_id
           JOIN orders o ON o.id=oi.order_id
          WHERE o.event_id=? LIMIT 1`,
        [ongoingId, qaStaffId, ongoingId],
      ), "Successful check-in requires an active Event assignment");
  } finally {
    connection.release();
    await pool.end();
  }

  for (const result of results) {
    console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
  }
  const failures = results.filter((result) => !result.passed);
  console.log(`\n[db:verify] ${results.length - failures.length}/${results.length} checks passed`);
  if (failures.length > 0) process.exitCode = 1;
}

void verify();
