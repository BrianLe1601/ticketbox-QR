import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { env } from "../config/env.js";
import { syncEventLifecycleStatuses } from "../modules/events/event-lifecycle.service.js";
import { pool } from "./pool.js";

const DEMO_EVENT_PREFIX = "demo-admin-";
const COVER_URL = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

interface IdRow extends RowDataPacket { id: number }
interface PasswordRow extends RowDataPacket { passwordHash: string | null }
interface CountRow extends RowDataPacket { total: number }
interface AdminSeed { id: number; passwordHash: string }

type DatabaseValue = string | number | boolean | Date | null;

type ApprovalStatus = "pending" | "approved" | "rejected";

interface CategoryFixture {
  key: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  active: boolean;
}

interface StaffFixture {
  key: string;
  fullName: string;
  email: string;
  googleSub: string | null;
  approvalStatus: ApprovalStatus;
  finalActive: boolean;
  createdDaysAgo: number;
}

interface EventFixture {
  key: string;
  categoryKey: string;
  name: string;
  slug: string;
  capacity: number;
  start: Date;
  end: Date;
  salesStart: Date;
  salesEnd: Date;
  checkinStart: Date;
  checkinEnd: Date;
  cover: boolean;
  scheduledPublishAt?: Date;
}

interface TicketFixture {
  eventKey: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  maxPerOrder: number;
  salesStart?: Date;
  salesEnd?: Date;
}

function fromNow(days: number, hours = 0): Date {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
}

const categories: CategoryFixture[] = [
  {
    key: "music",
    name: "[DEMO] Âm nhạc & Biểu diễn",
    slug: "demo-admin-music",
    description: "Category active để kiểm thử Event âm nhạc và trạng thái được tham chiếu.",
    icon: "music",
    sortOrder: 910,
    active: true,
  },
  {
    key: "technology",
    name: "[DEMO] Công nghệ & Hội nghị",
    slug: "demo-admin-technology",
    description: "Category active cho hội nghị, workshop và Event có nhiều Ticket Type.",
    icon: "monitor",
    sortOrder: 920,
    active: true,
  },
  {
    key: "community",
    name: "[DEMO] Cộng đồng & Trải nghiệm",
    slug: "demo-admin-community",
    description: "Category active để kiểm thử Event đang diễn ra và check-in.",
    icon: "users",
    sortOrder: 930,
    active: true,
  },
  {
    key: "archived",
    name: "[DEMO] Danh mục đã ngưng",
    slug: "demo-admin-archived",
    description: "Category inactive, không được chọn cho Event mới.",
    icon: "archive",
    sortOrder: 940,
    active: false,
  },
];

const staffFixtures: StaffFixture[] = [
  {
    key: "google-pending",
    fullName: "[DEMO] Google Chờ Duyệt",
    email: "demo.staff.google.pending@ticketbox.local",
    googleSub: "demo-google-staff-pending",
    approvalStatus: "pending",
    finalActive: false,
    createdDaysAgo: 1,
  },
  {
    key: "google-rejected",
    fullName: "[DEMO] Google Đã Từ Chối",
    email: "demo.staff.google.rejected@ticketbox.local",
    googleSub: "demo-google-staff-rejected",
    approvalStatus: "rejected",
    finalActive: false,
    createdDaysAgo: 8,
  },
  {
    key: "google-active",
    fullName: "[DEMO] Google Đang Hoạt Động",
    email: "demo.staff.google.active@ticketbox.local",
    googleSub: "demo-google-staff-active",
    approvalStatus: "approved",
    finalActive: true,
    createdDaysAgo: 18,
  },
  {
    key: "google-inactive",
    fullName: "[DEMO] Google Đã Vô Hiệu Hóa",
    email: "demo.staff.google.inactive@ticketbox.local",
    googleSub: "demo-google-staff-inactive",
    approvalStatus: "approved",
    finalActive: false,
    createdDaysAgo: 35,
  },
  {
    key: "local-active",
    fullName: "[DEMO] Staff Local Đang Hoạt Động",
    email: "demo.staff.local.active@ticketbox.local",
    googleSub: null,
    approvalStatus: "approved",
    finalActive: true,
    createdDaysAgo: 60,
  },
  {
    key: "local-inactive",
    fullName: "[DEMO] Staff Local Đã Vô Hiệu Hóa",
    email: "demo.staff.local.inactive@ticketbox.local",
    googleSub: null,
    approvalStatus: "approved",
    finalActive: false,
    createdDaysAgo: 90,
  },
];

const events: EventFixture[] = [
  {
    key: "draft-incomplete",
    categoryKey: "music",
    name: "[DEMO] Draft — Thiếu ảnh và loại vé",
    slug: "demo-admin-draft-incomplete",
    capacity: 120,
    start: fromNow(30),
    end: fromNow(30, 4),
    salesStart: fromNow(1),
    salesEnd: fromNow(30, 3),
    checkinStart: fromNow(29, 23),
    checkinEnd: fromNow(30, 4),
    cover: false,
  },
  {
    key: "draft-ready",
    categoryKey: "technology",
    name: "[DEMO] Draft — Sẵn sàng xuất bản",
    slug: "demo-admin-draft-ready",
    capacity: 200,
    start: fromNow(20),
    end: fromNow(20, 6),
    salesStart: fromNow(-1),
    salesEnd: fromNow(20, 5),
    checkinStart: fromNow(19, 23),
    checkinEnd: fromNow(20, 6),
    cover: true,
    scheduledPublishAt: fromNow(2),
  },
  {
    key: "published-on-sale",
    categoryKey: "music",
    name: "[DEMO] Published — Đang mở bán",
    slug: "demo-admin-published-on-sale",
    capacity: 300,
    start: fromNow(14),
    end: fromNow(14, 5),
    salesStart: fromNow(-2),
    salesEnd: fromNow(14, 4),
    checkinStart: fromNow(13, 23),
    checkinEnd: fromNow(14, 5),
    cover: true,
  },
  {
    key: "published-coming-soon",
    categoryKey: "technology",
    name: "[DEMO] Published — Sắp mở bán",
    slug: "demo-admin-published-coming-soon",
    capacity: 100,
    start: fromNow(45),
    end: fromNow(45, 4),
    salesStart: fromNow(7),
    salesEnd: fromNow(45, 3),
    checkinStart: fromNow(44, 23),
    checkinEnd: fromNow(45, 4),
    cover: true,
  },
  {
    key: "published-hidden",
    categoryKey: "community",
    name: "[DEMO] Published — Đang ẩn và tạm dừng bán",
    slug: "demo-admin-published-hidden",
    capacity: 80,
    start: fromNow(25),
    end: fromNow(25, 3),
    salesStart: fromNow(-1),
    salesEnd: fromNow(25, 2),
    checkinStart: fromNow(24, 23),
    checkinEnd: fromNow(25, 3),
    cover: true,
  },
  {
    key: "ongoing",
    categoryKey: "community",
    name: "[DEMO] Ongoing — Đang mở cổng check-in",
    slug: "demo-admin-ongoing-checkin",
    capacity: 150,
    start: fromNow(0, -1),
    end: fromNow(0, 4),
    salesStart: fromNow(-10),
    salesEnd: fromNow(0, 3),
    checkinStart: fromNow(0, -2),
    checkinEnd: fromNow(0, 4),
    cover: true,
  },
  {
    key: "completed",
    categoryKey: "music",
    name: "[DEMO] Completed — Lịch sử chỉ đọc",
    slug: "demo-admin-completed-history",
    capacity: 90,
    start: fromNow(-5),
    end: fromNow(-5, 3),
    salesStart: fromNow(-20),
    salesEnd: fromNow(-5, 2),
    checkinStart: fromNow(-5, -1),
    checkinEnd: fromNow(-5, 3),
    cover: true,
  },
  {
    key: "cancelled",
    categoryKey: "technology",
    name: "[DEMO] Cancelled — Đã hủy và đóng bán",
    slug: "demo-admin-cancelled-history",
    capacity: 120,
    start: fromNow(35),
    end: fromNow(35, 4),
    salesStart: fromNow(-2),
    salesEnd: fromNow(35, 3),
    checkinStart: fromNow(34, 23),
    checkinEnd: fromNow(35, 4),
    cover: true,
  },
];

const ticketTypes: TicketFixture[] = [
  { eventKey: "draft-ready", name: "Community Free", description: "Vé miễn phí để kiểm tra price = 0.", price: 0, capacity: 120, maxPerOrder: 4 },
  { eventKey: "draft-ready", name: "VIP Workshop", description: "Vé trả phí giới hạn số lượng.", price: 450_000, capacity: 80, maxPerOrder: 2 },
  { eventKey: "published-on-sale", name: "General Admission", description: "Tier chính đang mở bán.", price: 200_000, capacity: 180, maxPerOrder: 5 },
  { eventKey: "published-on-sale", name: "VIP Front Row", description: "Tier VIP giá cao.", price: 650_000, capacity: 80, maxPerOrder: 2 },
  { eventKey: "published-on-sale", name: "Late Release", description: "Tier có sales window riêng trong tương lai.", price: 250_000, capacity: 40, maxPerOrder: 3, salesStart: fromNow(10), salesEnd: fromNow(14, 4) },
  { eventKey: "published-coming-soon", name: "Early Bird", description: "Tier active nhưng chưa tới giờ bán.", price: 120_000, capacity: 100, maxPerOrder: 4 },
  { eventKey: "published-hidden", name: "Paused Pass", description: "Tier sẽ được tạm dừng sau khi Event bị ẩn.", price: 90_000, capacity: 80, maxPerOrder: 4 },
  { eventKey: "ongoing", name: "Gate Pass", description: "Tier của Event đang check-in.", price: 50_000, capacity: 150, maxPerOrder: 5 },
  { eventKey: "completed", name: "Archived Pass", description: "Tier lịch sử của Event completed.", price: 75_000, capacity: 90, maxPerOrder: 4 },
  { eventKey: "cancelled", name: "Cancelled Pass", description: "Tier sẽ đóng khi Event bị hủy.", price: 300_000, capacity: 120, maxPerOrder: 4 },
];

async function findAdmin(connection: PoolConnection): Promise<AdminSeed> {
  const [rows] = await connection.execute<(IdRow & PasswordRow)[]>(
    `SELECT id,password_hash AS passwordHash FROM users
      WHERE email=? AND role='admin' AND is_active=TRUE LIMIT 1`,
    [env.SEED_ADMIN_EMAIL.toLowerCase()],
  );
  const admin = rows[0];
  if (!admin?.passwordHash) {
    throw new Error(`Run npm run seed first; missing password Admin ${env.SEED_ADMIN_EMAIL}`);
  }
  return { id: admin.id, passwordHash: admin.passwordHash };
}

async function count(connection: PoolConnection, sql: string, params: DatabaseValue[] = []) {
  const [rows] = await connection.execute<CountRow[]>(sql, params);
  return Number(rows[0]?.total ?? 0);
}

async function cleanupDemoEvents(connection: PoolConnection, adminId: number) {
  const [rows] = await connection.execute<IdRow[]>(
    "SELECT id FROM events WHERE slug LIKE ? ORDER BY id",
    [`${DEMO_EVENT_PREFIX}%`],
  );
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");

  await connection.execute(
    `UPDATE events SET visibility='hidden',hidden_at=NOW(3),hidden_by=?,
       hidden_reason='Resetting isolated Admin demo fixtures'
     WHERE id IN (${placeholders}) AND visibility='visible'`,
    [adminId, ...ids],
  );
  await connection.execute(`DELETE FROM checkin_logs WHERE event_id IN (${placeholders})`, ids);
  await connection.execute(
    `DELETE el FROM email_logs el JOIN orders o ON o.id=el.order_id
      WHERE o.event_id IN (${placeholders})`, ids,
  );
  await connection.execute(
    `DELETE r FROM refunds r JOIN orders o ON o.id=r.order_id
      WHERE o.event_id IN (${placeholders})`, ids,
  );
  await connection.execute(
    `DELETE p FROM payments p JOIN orders o ON o.id=p.order_id
      WHERE o.event_id IN (${placeholders})`, ids,
  );
  await connection.execute(
    `DELETE t FROM tickets t JOIN order_items oi ON oi.id=t.order_item_id
      JOIN orders o ON o.id=oi.order_id WHERE o.event_id IN (${placeholders})`, ids,
  );
  await connection.execute(
    `DELETE oi FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE o.event_id IN (${placeholders})`, ids,
  );
  await connection.execute(`DELETE FROM orders WHERE event_id IN (${placeholders})`, ids);
  await connection.execute(`DELETE FROM event_staff WHERE event_id IN (${placeholders})`, ids);
  await connection.execute(`DELETE FROM ticket_types WHERE event_id IN (${placeholders})`, ids);
  await connection.execute(`DELETE FROM events WHERE id IN (${placeholders})`, ids);
}

async function resetDemoStaffRelationships(connection: PoolConnection) {
  const emails = staffFixtures.map((fixture) => fixture.email);
  const placeholders = emails.map(() => "?").join(",");
  const [rows] = await connection.execute<IdRow[]>(
    `SELECT id FROM users WHERE email IN (${placeholders})`, emails,
  );
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return;
  const idPlaceholders = ids.map(() => "?").join(",");
  await connection.execute(`DELETE FROM auth_sessions WHERE user_id IN (${idPlaceholders})`, ids);
  await connection.execute(`DELETE FROM event_staff WHERE staff_id IN (${idPlaceholders})`, ids);
}

async function upsertCategories(connection: PoolConnection) {
  const ids = new Map<string, number>();
  for (const fixture of categories) {
    await connection.execute(
      `INSERT INTO categories(name,slug,description,icon,is_active,sort_order)
       VALUES (?,?,?,?,TRUE,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),
         icon=VALUES(icon),is_active=TRUE,sort_order=VALUES(sort_order)`,
      [fixture.name, fixture.slug, fixture.description, fixture.icon, fixture.sortOrder],
    );
    const [rows] = await connection.execute<IdRow[]>(
      "SELECT id FROM categories WHERE slug=? LIMIT 1", [fixture.slug],
    );
    const row = rows[0];
    if (!row) throw new Error(`Category was not created: ${fixture.slug}`);
    ids.set(fixture.key, row.id);
  }
  return ids;
}

async function upsertStaff(
  connection: PoolConnection,
  adminId: number,
  localPasswordHash: string,
) {
  const ids = new Map<string, number>();
  for (const fixture of staffFixtures) {
    const isApproved = fixture.approvalStatus === "approved";
    const initialActive = isApproved;
    const reviewedBy = fixture.approvalStatus === "pending" ? null : adminId;
    const reviewedAt = fixture.approvalStatus === "pending" ? null : fromNow(-fixture.createdDaysAgo + 1);
    const createdAt = fromNow(-fixture.createdDaysAgo);
    const passwordHash = fixture.googleSub === null ? localPasswordHash : null;

    await connection.execute(
      `INSERT INTO users
        (full_name,email,password_hash,google_sub,role,is_active,staff_approval_status,
         staff_reviewed_by,staff_reviewed_at,created_at)
       VALUES (?,?,?,?,'staff',?,?,?,?,?)
       ON DUPLICATE KEY UPDATE full_name=VALUES(full_name),password_hash=VALUES(password_hash),
         google_sub=VALUES(google_sub),role='staff',is_active=VALUES(is_active),
         staff_approval_status=VALUES(staff_approval_status),
         staff_reviewed_by=VALUES(staff_reviewed_by),staff_reviewed_at=VALUES(staff_reviewed_at),
         created_at=VALUES(created_at)`,
      [
        fixture.fullName, fixture.email, passwordHash, fixture.googleSub, initialActive,
        fixture.approvalStatus, reviewedBy, reviewedAt, createdAt,
      ],
    );
    const [rows] = await connection.execute<IdRow[]>(
      "SELECT id FROM users WHERE email=? LIMIT 1", [fixture.email],
    );
    const row = rows[0];
    if (!row) throw new Error(`Staff was not created: ${fixture.email}`);
    ids.set(fixture.key, row.id);
  }
  return ids;
}

async function createEvents(
  connection: PoolConnection,
  adminId: number,
  categoryIds: Map<string, number>,
) {
  const ids = new Map<string, number>();
  for (const fixture of events) {
    const categoryId = categoryIds.get(fixture.categoryKey);
    if (!categoryId) throw new Error(`Missing Category key: ${fixture.categoryKey}`);
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO events
        (name,slug,description,category_id,venue,address,city,venue_capacity,
         cover_image_url,cover_image_alt,start_time,end_time,sales_start_at,sales_end_at,
         checkin_start_at,checkin_end_at,scheduled_publish_at,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        fixture.name, fixture.slug,
        `Dữ liệu Admin demo cô lập cho kịch bản ${fixture.key}. Không dùng ở production.`,
        categoryId, "TicketBox Demo Center", "18 Nguyễn Huệ", "Hồ Chí Minh",
        fixture.capacity, fixture.cover ? COVER_URL : null,
        fixture.cover ? `${fixture.name} cover` : null, fixture.start, fixture.end,
        fixture.salesStart, fixture.salesEnd, fixture.checkinStart, fixture.checkinEnd,
        fixture.scheduledPublishAt ?? null, adminId,
      ],
    );
    ids.set(fixture.key, result.insertId);
  }
  return ids;
}

async function createTicketTypes(connection: PoolConnection, eventIds: Map<string, number>) {
  for (const fixture of ticketTypes) {
    const eventId = eventIds.get(fixture.eventKey);
    if (!eventId) throw new Error(`Missing Event key: ${fixture.eventKey}`);
    await connection.execute(
      `INSERT INTO ticket_types
        (event_id,name,description,price,capacity,max_per_order,sales_start_at,sales_end_at,is_active)
       VALUES (?,?,?,?,?,?,?,?,TRUE)`,
      [
        eventId, fixture.name, fixture.description, fixture.price, fixture.capacity,
        fixture.maxPerOrder, fixture.salesStart ?? null, fixture.salesEnd ?? null,
      ],
    );
  }
}

async function createAssignment(
  connection: PoolConnection,
  eventId: number,
  staffId: number,
  adminId: number,
  active = true,
  assignedAt: Date = fromNow(0),
  revokedAt: Date | null = null,
) {
  await connection.execute(
    `INSERT INTO event_staff(event_id,staff_id,assigned_by,assigned_at,revoked_at,is_active)
     VALUES (?,?,?,?,?,?)`,
    [eventId, staffId, adminId, assignedAt, revokedAt, active],
  );
}

function requiredId(ids: Map<string, number>, key: string) {
  const id = ids.get(key);
  if (!id) throw new Error(`Missing fixture id: ${key}`);
  return id;
}

async function applyEventStatesAndAssignments(
  connection: PoolConnection,
  adminId: number,
  eventIds: Map<string, number>,
  staffIds: Map<string, number>,
) {
  await createAssignment(
    connection, requiredId(eventIds, "completed"), requiredId(staffIds, "google-inactive"),
    adminId, false, fromNow(-12), fromNow(-6),
  );
  await createAssignment(
    connection, requiredId(eventIds, "cancelled"), requiredId(staffIds, "local-inactive"),
    adminId, false, fromNow(-18), fromNow(-10),
  );
  await createAssignment(
    connection, requiredId(eventIds, "published-on-sale"), requiredId(staffIds, "google-active"), adminId,
  );
  await createAssignment(
    connection, requiredId(eventIds, "published-coming-soon"), requiredId(staffIds, "google-active"), adminId,
  );
  await createAssignment(
    connection, requiredId(eventIds, "ongoing"), requiredId(staffIds, "local-active"), adminId,
  );
  await createAssignment(
    connection, requiredId(eventIds, "draft-ready"), requiredId(staffIds, "local-active"), adminId,
  );

  for (const key of ["published-on-sale", "published-coming-soon", "published-hidden", "ongoing", "completed", "cancelled"]) {
    const publishedAt = key === "completed" ? fromNow(-20) : key === "ongoing" ? fromNow(-10) : fromNow(-2);
    await connection.execute(
      "UPDATE events SET status='published',published_at=? WHERE id=?",
      [publishedAt, requiredId(eventIds, key)],
    );
  }

  const hiddenId = requiredId(eventIds, "published-hidden");
  await connection.execute(
    `UPDATE events SET visibility='hidden',hidden_at=NOW(3),hidden_by=?,
       hidden_reason='Demo maintenance window' WHERE id=?`,
    [adminId, hiddenId],
  );
  await connection.execute("UPDATE ticket_types SET is_active=FALSE WHERE event_id=?", [hiddenId]);

  const ongoingId = requiredId(eventIds, "ongoing");
  await connection.execute("UPDATE events SET status='ongoing' WHERE id=?", [ongoingId]);

  const completedId = requiredId(eventIds, "completed");
  await connection.execute("UPDATE events SET status='ongoing' WHERE id=?", [completedId]);
  await connection.execute(
    "UPDATE events SET status='completed',completed_at=? WHERE id=?",
    [fromNow(-5, 3), completedId],
  );

  const cancelledId = requiredId(eventIds, "cancelled");
  await connection.execute(
    `UPDATE events SET visibility='hidden',hidden_at=NOW(3),hidden_by=?,
       hidden_reason='Demo cancellation' WHERE id=?`,
    [adminId, cancelledId],
  );
  await connection.execute("UPDATE ticket_types SET is_active=FALSE WHERE event_id=?", [cancelledId]);
  await connection.execute(
    `UPDATE events SET status='cancelled',cancelled_at=NOW(3),
       cancellation_reason='Demo Event cancellation' WHERE id=?`,
    [cancelledId],
  );

  for (const fixture of staffFixtures.filter((person) => !person.finalActive && person.approvalStatus === "approved")) {
    await connection.execute("UPDATE users SET is_active=FALSE WHERE id=?", [requiredId(staffIds, fixture.key)]);
  }
}

async function deactivateArchivedCategory(connection: PoolConnection) {
  const archived = categories.find((fixture) => fixture.key === "archived");
  if (!archived) return;
  await connection.execute("UPDATE categories SET is_active=FALSE WHERE slug=?", [archived.slug]);
}

async function verifySummary(connection: PoolConnection) {
  const categorySlugs = categories.map((fixture) => fixture.slug);
  const categoryPlaceholders = categorySlugs.map(() => "?").join(",");
  const staffEmails = staffFixtures.map((fixture) => fixture.email);
  const staffPlaceholders = staffEmails.map(() => "?").join(",");
  const categoryCount = await count(
    connection, `SELECT COUNT(*) total FROM categories WHERE slug IN (${categoryPlaceholders})`, categorySlugs,
  );
  const eventCount = await count(connection, "SELECT COUNT(*) total FROM events WHERE slug LIKE ?", [`${DEMO_EVENT_PREFIX}%`]);
  const staffCount = await count(
    connection, `SELECT COUNT(*) total FROM users WHERE email IN (${staffPlaceholders})`, staffEmails,
  );
  const tierCount = await count(
    connection,
    `SELECT COUNT(*) total FROM ticket_types tt JOIN events e ON e.id=tt.event_id WHERE e.slug LIKE ?`,
    [`${DEMO_EVENT_PREFIX}%`],
  );
  const assignmentCount = await count(
    connection,
    `SELECT COUNT(*) total FROM event_staff es JOIN events e ON e.id=es.event_id WHERE e.slug LIKE ?`,
    [`${DEMO_EVENT_PREFIX}%`],
  );
  const inactiveCategoryCount = await count(
    connection,
    `SELECT COUNT(*) total FROM categories
      WHERE slug IN (${categoryPlaceholders}) AND is_active=FALSE`,
    categorySlugs,
  );
  const terminalEventCount = await count(
    connection,
    "SELECT COUNT(*) total FROM events WHERE slug LIKE ? AND status IN ('completed','cancelled')",
    [`${DEMO_EVENT_PREFIX}%`],
  );
  const pendingStaffCount = await count(
    connection,
    `SELECT COUNT(*) total FROM users
      WHERE email IN (${staffPlaceholders}) AND staff_approval_status='pending' AND is_active=FALSE`,
    staffEmails,
  );
  const rejectedStaffCount = await count(
    connection,
    `SELECT COUNT(*) total FROM users
      WHERE email IN (${staffPlaceholders}) AND staff_approval_status='rejected' AND is_active=FALSE`,
    staffEmails,
  );
  const activeStaffCount = await count(
    connection,
    `SELECT COUNT(*) total FROM users
      WHERE email IN (${staffPlaceholders}) AND staff_approval_status='approved' AND is_active=TRUE`,
    staffEmails,
  );
  const inactiveStaffCount = await count(
    connection,
    `SELECT COUNT(*) total FROM users
      WHERE email IN (${staffPlaceholders}) AND staff_approval_status='approved' AND is_active=FALSE`,
    staffEmails,
  );
  const activeAssignmentCount = await count(
    connection,
    `SELECT COUNT(*) total FROM event_staff es JOIN events e ON e.id=es.event_id
      WHERE e.slug LIKE ? AND es.is_active=TRUE`,
    [`${DEMO_EVENT_PREFIX}%`],
  );
  if (categoryCount !== 4 || eventCount !== 8 || staffCount !== 6 || tierCount !== 10 || assignmentCount !== 6) {
    throw new Error(
      `Admin demo verification failed: categories=${categoryCount}, events=${eventCount}, `
      + `staff=${staffCount}, ticketTypes=${tierCount}, assignments=${assignmentCount}`,
    );
  }
  if (
    inactiveCategoryCount !== 1 || terminalEventCount !== 2
    || pendingStaffCount !== 1 || rejectedStaffCount !== 1
    || activeStaffCount !== 2 || inactiveStaffCount !== 2
    || activeAssignmentCount !== 4
  ) {
    throw new Error(
      `Admin demo state verification failed: inactiveCategories=${inactiveCategoryCount}, `
      + `terminalEvents=${terminalEventCount}, pending=${pendingStaffCount}, rejected=${rejectedStaffCount}, `
      + `activeStaff=${activeStaffCount}, inactiveStaff=${inactiveStaffCount}, `
      + `activeAssignments=${activeAssignmentCount}`,
    );
  }
  return { categoryCount, eventCount, staffCount, tierCount, assignmentCount };
}

async function seedAdminDemo() {
  if (env.NODE_ENV === "production") {
    throw new Error("Admin demo seed is disabled in production");
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const admin = await findAdmin(connection);
    await cleanupDemoEvents(connection, admin.id);
    await resetDemoStaffRelationships(connection);
    const categoryIds = await upsertCategories(connection);
    const staffIds = await upsertStaff(connection, admin.id, admin.passwordHash);
    const eventIds = await createEvents(connection, admin.id, categoryIds);
    await createTicketTypes(connection, eventIds);
    await applyEventStatesAndAssignments(connection, admin.id, eventIds, staffIds);
    await deactivateArchivedCategory(connection);
    const summary = await verifySummary(connection);
    await connection.commit();
    const lifecycle = await syncEventLifecycleStatuses();

    console.log("[seed:admin-demo] completed: 18 primary demo records");
    console.log(`[seed:admin-demo] Categories: ${summary.categoryCount}; Events: ${summary.eventCount}; Staff: ${summary.staffCount}`);
    console.log(`[seed:admin-demo] Ticket Types: ${summary.tierCount}; Assignments: ${summary.assignmentCount}`);
    console.log(`[seed:admin-demo] Lifecycle sync — started: ${lifecycle.started}; completed: ${lifecycle.completed}`);
    console.log(`[seed:admin-demo] Re-run safely replaces only ${DEMO_EVENT_PREFIX}* Events and resets demo.staff.* accounts`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

void seedAdminDemo().catch((error: unknown) => {
  console.error("[seed:admin-demo] failed", error);
  process.exitCode = 1;
});
