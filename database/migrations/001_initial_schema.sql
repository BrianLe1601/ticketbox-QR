-- TicketBoxQR - MySQL 8.0.16+
-- Run this entire script in MySQL Workbench.

CREATE DATABASE IF NOT EXISTS ticketboxqr
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ticketboxqr;

SET NAMES utf8mb4;
SET time_zone = '+07:00';

-- =========================================================
-- 1. USERS
-- =========================================================
CREATE TABLE users (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('admin', 'staff') NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_name CHECK (CHAR_LENGTH(TRIM(full_name)) > 0),
    CONSTRAINT chk_users_email CHECK (CHAR_LENGTH(TRIM(email)) >= 3)
) ENGINE = InnoDB;

-- =========================================================
-- 2. EVENTS
-- =========================================================
CREATE TABLE events (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(220) NOT NULL,
    description         TEXT NULL,
    location           VARCHAR(255) NOT NULL,
    cover_image_url     VARCHAR(500) NULL,
    start_time          DATETIME(3) NOT NULL,
    end_time            DATETIME(3) NOT NULL,
    sales_start_at      DATETIME(3) NULL,
    sales_end_at        DATETIME(3) NULL,
    checkin_start_at    DATETIME(3) NULL,
    checkin_end_at      DATETIME(3) NULL,
    status              ENUM('draft', 'published', 'ended', 'cancelled')
                        NOT NULL DEFAULT 'draft',
    created_by          BIGINT UNSIGNED NOT NULL,
    created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                      ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_events PRIMARY KEY (id),
    CONSTRAINT uq_events_slug UNIQUE (slug),
    CONSTRAINT fk_events_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_events_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
    CONSTRAINT chk_events_location CHECK (CHAR_LENGTH(TRIM(location)) > 0),
    CONSTRAINT chk_events_duration CHECK (start_time < end_time),
    CONSTRAINT chk_events_sales_window CHECK (
        sales_start_at IS NULL OR sales_end_at IS NULL
        OR sales_start_at < sales_end_at
    ),
    CONSTRAINT chk_events_checkin_window CHECK (
        checkin_start_at IS NULL OR checkin_end_at IS NULL
        OR checkin_start_at < checkin_end_at
    )
) ENGINE = InnoDB;

CREATE INDEX idx_events_status_sales
    ON events(status, sales_start_at, sales_end_at);

-- =========================================================
-- 3. EVENT_STAFF
-- =========================================================
CREATE TABLE event_staff (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id        BIGINT UNSIGNED NOT NULL,
    staff_id        BIGINT UNSIGNED NOT NULL,
    assigned_by     BIGINT UNSIGNED NOT NULL,
    assigned_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    revoked_at      DATETIME(3) NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_event_staff PRIMARY KEY (id),
    CONSTRAINT uq_event_staff_event_staff UNIQUE (event_id, staff_id),
    CONSTRAINT fk_event_staff_event
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_event_staff_staff
        FOREIGN KEY (staff_id) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_event_staff_assigned_by
        FOREIGN KEY (assigned_by) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_event_staff_revoke CHECK (
        revoked_at IS NULL OR revoked_at >= assigned_at
    )
) ENGINE = InnoDB;

CREATE INDEX idx_event_staff_staff_active
    ON event_staff(staff_id, is_active);

-- =========================================================
-- 4. TICKET_TYPES
-- reserved_quantity: held by non-expired pending orders
-- sold_quantity: confirmed quantity (including later-cancelled tickets unless
-- the business transaction explicitly returns them to inventory)
-- =========================================================
CREATE TABLE ticket_types (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id            BIGINT UNSIGNED NOT NULL,
    name                VARCHAR(100) NOT NULL,
    description         VARCHAR(500) NULL,
    price               DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    capacity            INT UNSIGNED NOT NULL,
    reserved_quantity   INT UNSIGNED NOT NULL DEFAULT 0,
    sold_quantity       INT UNSIGNED NOT NULL DEFAULT 0,
    max_per_order       INT UNSIGNED NOT NULL DEFAULT 10,
    sales_start_at      DATETIME(3) NULL,
    sales_end_at        DATETIME(3) NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                      ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_ticket_types PRIMARY KEY (id),
    CONSTRAINT uq_ticket_types_event_name UNIQUE (event_id, name),
    CONSTRAINT fk_ticket_types_event
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_ticket_types_price CHECK (price >= 0),
    CONSTRAINT chk_ticket_types_capacity CHECK (
        reserved_quantity + sold_quantity <= capacity
    ),
    CONSTRAINT chk_ticket_types_max_per_order CHECK (max_per_order > 0),
    CONSTRAINT chk_ticket_types_sales_window CHECK (
        sales_start_at IS NULL OR sales_end_at IS NULL
        OR sales_start_at < sales_end_at
    )
) ENGINE = InnoDB;

CREATE INDEX idx_ticket_types_event_active
    ON ticket_types(event_id, is_active);

-- =========================================================
-- 5. ORDERS
-- lookup_token_hash should contain SHA-256 hex (64 characters), not raw token.
-- =========================================================
CREATE TABLE orders (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_code          VARCHAR(30) NOT NULL,
    event_id            BIGINT UNSIGNED NOT NULL,
    buyer_name          VARCHAR(100) NOT NULL,
    buyer_email         VARCHAR(150) NOT NULL,
    buyer_phone         VARCHAR(20) NULL,
    total_quantity      INT UNSIGNED NOT NULL,
    subtotal_amount     DECIMAL(12,2) NOT NULL,
    discount_amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount        DECIMAL(12,2) NOT NULL,
    status              ENUM('pending_payment', 'confirmed', 'expired', 'cancelled')
                        NOT NULL DEFAULT 'pending_payment',
    lookup_token_hash   CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    idempotency_key     VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
    expires_at          DATETIME(3) NULL,
    confirmed_at        DATETIME(3) NULL,
    expired_at          DATETIME(3) NULL,
    cancelled_at        DATETIME(3) NULL,
    created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                      ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_orders PRIMARY KEY (id),
    CONSTRAINT uq_orders_order_code UNIQUE (order_code),
    CONSTRAINT uq_orders_lookup_token_hash UNIQUE (lookup_token_hash),
    CONSTRAINT uq_orders_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT fk_orders_event
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_orders_buyer_name CHECK (CHAR_LENGTH(TRIM(buyer_name)) > 0),
    CONSTRAINT chk_orders_buyer_email CHECK (CHAR_LENGTH(TRIM(buyer_email)) >= 3),
    CONSTRAINT chk_orders_quantity CHECK (total_quantity > 0),
    CONSTRAINT chk_orders_money CHECK (
        subtotal_amount >= 0
        AND discount_amount >= 0
        AND total_amount >= 0
        AND discount_amount <= subtotal_amount
        AND total_amount = subtotal_amount - discount_amount
    ),
    CONSTRAINT chk_orders_lookup_hash CHECK (
        lookup_token_hash REGEXP '^[0-9A-Fa-f]{64}$'
    ),
    CONSTRAINT chk_orders_status_dates CHECK (
        (status <> 'pending_payment' OR expires_at IS NOT NULL)
        AND (status <> 'confirmed' OR confirmed_at IS NOT NULL)
        AND (status <> 'expired' OR expired_at IS NOT NULL)
        AND (status <> 'cancelled' OR cancelled_at IS NOT NULL)
    )
) ENGINE = InnoDB;

CREATE INDEX idx_orders_event_status_created
    ON orders(event_id, status, created_at);
CREATE INDEX idx_orders_buyer_email
    ON orders(buyer_email);
CREATE INDEX idx_orders_expiration
    ON orders(status, expires_at);

-- =========================================================
-- 6. ORDER_ITEMS
-- The name and price are immutable purchase-time snapshots.
-- =========================================================
CREATE TABLE order_items (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id            BIGINT UNSIGNED NOT NULL,
    ticket_type_id      BIGINT UNSIGNED NOT NULL,
    ticket_type_name    VARCHAR(100) NOT NULL,
    unit_price          DECIMAL(12,2) NOT NULL,
    quantity            INT UNSIGNED NOT NULL,
    line_total          DECIMAL(12,2) NOT NULL,
    created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_items PRIMARY KEY (id),
    CONSTRAINT uq_order_items_order_ticket_type UNIQUE (order_id, ticket_type_id),
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_order_items_ticket_type
        FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_order_items_name CHECK (
        CHAR_LENGTH(TRIM(ticket_type_name)) > 0
    ),
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_items_money CHECK (
        unit_price >= 0
        AND line_total >= 0
        AND line_total = unit_price * quantity
    )
) ENGINE = InnoDB;

CREATE INDEX idx_order_items_ticket_type
    ON order_items(ticket_type_id);

-- =========================================================
-- 7. TICKETS
-- A ticket belongs to exactly one order item. order_id and ticket_type_id are
-- intentionally not duplicated here.
-- =========================================================
CREATE TABLE tickets (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_item_id       BIGINT UNSIGNED NOT NULL,
    ticket_code         VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    qr_token_hash       CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    holder_name         VARCHAR(100) NULL,
    holder_email        VARCHAR(150) NULL,
    status              ENUM('issued', 'checked_in', 'cancelled')
                        NOT NULL DEFAULT 'issued',
    issued_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    checked_in_at       DATETIME(3) NULL,
    checked_in_by       BIGINT UNSIGNED NULL,
    cancelled_at        DATETIME(3) NULL,
    cancelled_by        BIGINT UNSIGNED NULL,
    cancel_reason       VARCHAR(255) NULL,
    created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                      ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_tickets PRIMARY KEY (id),
    CONSTRAINT uq_tickets_ticket_code UNIQUE (ticket_code),
    CONSTRAINT uq_tickets_qr_token_hash UNIQUE (qr_token_hash),
    CONSTRAINT fk_tickets_order_item
        FOREIGN KEY (order_item_id) REFERENCES order_items(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_checked_in_by
        FOREIGN KEY (checked_in_by) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_cancelled_by
        FOREIGN KEY (cancelled_by) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_tickets_code CHECK (CHAR_LENGTH(TRIM(ticket_code)) > 0),
    CONSTRAINT chk_tickets_qr_hash CHECK (
        qr_token_hash REGEXP '^[0-9A-Fa-f]{64}$'
    ),
    CONSTRAINT chk_tickets_status_data CHECK (
        (status <> 'issued'
            OR (checked_in_at IS NULL AND checked_in_by IS NULL
                AND cancelled_at IS NULL AND cancelled_by IS NULL))
        AND
        (status <> 'checked_in'
            OR (checked_in_at IS NOT NULL AND checked_in_by IS NOT NULL
                AND cancelled_at IS NULL AND cancelled_by IS NULL))
        AND
        (status <> 'cancelled'
            OR cancelled_at IS NOT NULL)
    )
) ENGINE = InnoDB;

CREATE INDEX idx_tickets_order_item_status
    ON tickets(order_item_id, status);

-- =========================================================
-- 8. PAYMENTS
-- Multiple attempts are allowed for one order.
-- =========================================================
CREATE TABLE payments (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id            BIGINT UNSIGNED NOT NULL,
    payment_code        VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    method              ENUM('free', 'simulated') NOT NULL,
    amount              DECIMAL(12,2) NOT NULL,
    status              ENUM('pending', 'success', 'failed', 'cancelled')
                        NOT NULL DEFAULT 'pending',
    failure_reason      VARCHAR(255) NULL,
    paid_at             DATETIME(3) NULL,
    created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                      ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_payments PRIMARY KEY (id),
    CONSTRAINT uq_payments_payment_code UNIQUE (payment_code),
    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_payments_amount CHECK (amount >= 0),
    CONSTRAINT chk_payments_status_data CHECK (
        (status <> 'success' OR paid_at IS NOT NULL)
        AND (status <> 'failed' OR failure_reason IS NOT NULL)
    )
) ENGINE = InnoDB;

CREATE INDEX idx_payments_order_status
    ON payments(order_id, status);

-- =========================================================
-- 9. CHECKIN_LOGS
-- event_id is the scanner context. ticket_id is nullable for invalid codes.
-- =========================================================
CREATE TABLE checkin_logs (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id               BIGINT UNSIGNED NULL,
    event_id                BIGINT UNSIGNED NOT NULL,
    staff_id                BIGINT UNSIGNED NOT NULL,
    result_code             ENUM(
                              'SUCCESS',
                              'ALREADY_CHECKED_IN',
                              'WRONG_EVENT',
                              'CANCELLED',
                              'UNPAID',
                              'INVALID',
                              'EVENT_NOT_AVAILABLE',
                              'STAFF_NOT_ASSIGNED'
                            ) NOT NULL,
    scanned_code_hash       CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    scanned_code_masked     VARCHAR(30) NULL,
    message                 VARCHAR(255) NULL,
    checked_at              DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_checkin_logs PRIMARY KEY (id),
    CONSTRAINT fk_checkin_logs_ticket
        FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_checkin_logs_event
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_checkin_logs_staff
        FOREIGN KEY (staff_id) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_checkin_logs_hash CHECK (
        scanned_code_hash IS NULL
        OR scanned_code_hash REGEXP '^[0-9A-Fa-f]{64}$'
    ),
    CONSTRAINT chk_checkin_logs_result_ticket CHECK (
        result_code NOT IN ('SUCCESS', 'ALREADY_CHECKED_IN',
                            'WRONG_EVENT', 'CANCELLED', 'UNPAID')
        OR ticket_id IS NOT NULL
    )
) ENGINE = InnoDB;

CREATE INDEX idx_checkin_logs_event_time
    ON checkin_logs(event_id, checked_at);
CREATE INDEX idx_checkin_logs_ticket_time
    ON checkin_logs(ticket_id, checked_at);
CREATE INDEX idx_checkin_logs_staff_time
    ON checkin_logs(staff_id, checked_at);

-- =========================================================
-- 10. EMAIL_LOGS (optional operational history)
-- =========================================================
CREATE TABLE email_logs (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id            BIGINT UNSIGNED NOT NULL,
    recipient           VARCHAR(150) NOT NULL,
    email_type          ENUM('ticket_issued', 'ticket_resent', 'order_cancelled')
                        NOT NULL,
    status              ENUM('pending', 'sent', 'failed')
                        NOT NULL DEFAULT 'pending',
    provider_id         VARCHAR(255) NULL,
    error_message       VARCHAR(500) NULL,
    sent_at             DATETIME(3) NULL,
    created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_email_logs PRIMARY KEY (id),
    CONSTRAINT fk_email_logs_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_email_logs_recipient CHECK (
        CHAR_LENGTH(TRIM(recipient)) >= 3
    ),
    CONSTRAINT chk_email_logs_status_data CHECK (
        (status <> 'sent' OR sent_at IS NOT NULL)
        AND (status <> 'failed' OR error_message IS NOT NULL)
    )
) ENGINE = InnoDB;

CREATE INDEX idx_email_logs_order_status
    ON email_logs(order_id, status, created_at);

-- =========================================================
-- CROSS-TABLE INTEGRITY TRIGGERS
-- These checks supplement foreign keys where a normal FK cannot express the
-- business relationship.
-- =========================================================
DELIMITER $$

CREATE TRIGGER trg_events_creator_admin_bi
BEFORE INSERT ON events
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.created_by AND role = 'admin' AND is_active = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'events.created_by must be an active admin';
    END IF;
END$$

CREATE TRIGGER trg_events_creator_admin_bu
BEFORE UPDATE ON events
FOR EACH ROW
BEGIN
    IF NEW.created_by <> OLD.created_by AND NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.created_by AND role = 'admin' AND is_active = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'events.created_by must be an active admin';
    END IF;
END$$

CREATE TRIGGER trg_event_staff_roles_bi
BEFORE INSERT ON event_staff
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.staff_id AND role = 'staff' AND is_active = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'event_staff.staff_id must be an active staff user';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.assigned_by AND role = 'admin' AND is_active = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'event_staff.assigned_by must be an active admin';
    END IF;
END$$

CREATE TRIGGER trg_event_staff_roles_bu
BEFORE UPDATE ON event_staff
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.staff_id AND role = 'staff'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'event_staff.staff_id must reference a staff user';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.assigned_by AND role = 'admin'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'event_staff.assigned_by must reference an admin';
    END IF;
END$$

CREATE TRIGGER trg_order_items_same_event_bi
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM orders o
        JOIN ticket_types tt ON tt.id = NEW.ticket_type_id
        WHERE o.id = NEW.order_id
          AND o.event_id = tt.event_id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order and ticket type must belong to the same event';
    END IF;
END$$

CREATE TRIGGER trg_order_items_same_event_bu
BEFORE UPDATE ON order_items
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM orders o
        JOIN ticket_types tt ON tt.id = NEW.ticket_type_id
        WHERE o.id = NEW.order_id
          AND o.event_id = tt.event_id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order and ticket type must belong to the same event';
    END IF;
END$$

CREATE TRIGGER trg_payments_match_order_bi
BEFORE INSERT ON payments
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM orders
        WHERE id = NEW.order_id AND total_amount = NEW.amount
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payment amount must equal the order total';
    END IF;
END$$

CREATE TRIGGER trg_payments_match_order_bu
BEFORE UPDATE ON payments
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM orders
        WHERE id = NEW.order_id AND total_amount = NEW.amount
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payment amount must equal the order total';
    END IF;
END$$

CREATE TRIGGER trg_checkin_staff_role_bi
BEFORE INSERT ON checkin_logs
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.staff_id AND role = 'staff'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'checkin_logs.staff_id must reference a staff user';
    END IF;
END$$

DELIMITER ;

-- =========================================================
-- REPORTING / CONSISTENCY VIEWS
-- =========================================================
CREATE OR REPLACE VIEW v_ticket_details AS
SELECT
    t.id AS ticket_id,
    t.ticket_code,
    t.status AS ticket_status,
    t.holder_name,
    t.holder_email,
    t.issued_at,
    t.checked_in_at,
    oi.id AS order_item_id,
    oi.ticket_type_id,
    oi.ticket_type_name,
    oi.unit_price,
    o.id AS order_id,
    o.order_code,
    o.status AS order_status,
    o.buyer_name,
    o.buyer_email,
    o.event_id
FROM tickets t
JOIN order_items oi ON oi.id = t.order_item_id
JOIN orders o ON o.id = oi.order_id;

CREATE OR REPLACE VIEW v_ticket_type_inventory AS
SELECT
    tt.id AS ticket_type_id,
    tt.event_id,
    tt.name,
    tt.capacity,
    tt.reserved_quantity,
    tt.sold_quantity,
    tt.capacity - tt.reserved_quantity - tt.sold_quantity AS available_quantity,
    COUNT(t.id) AS issued_ticket_rows
FROM ticket_types tt
LEFT JOIN order_items oi ON oi.ticket_type_id = tt.id
LEFT JOIN tickets t ON t.order_item_id = oi.id
GROUP BY
    tt.id, tt.event_id, tt.name, tt.capacity,
    tt.reserved_quantity, tt.sold_quantity;

-- End of schema.

USE ticketboxqr;

ALTER TABLE events
    ADD COLUMN category ENUM(
        'music', 'conference', 'food', 'sports', 'art'
    ) NOT NULL DEFAULT 'music'
    AFTER location;

CREATE INDEX idx_events_category_status
    ON events(category, status);


    ALTER TABLE events
    ADD COLUMN venue    VARCHAR(150) NOT NULL DEFAULT '' AFTER location,
    ADD COLUMN address  VARCHAR(255) NOT NULL DEFAULT '' AFTER venue,
    ADD COLUMN city     VARCHAR(100) NOT NULL DEFAULT '' AFTER address;

-- Giữ location tạm thời để migrate data cũ, sau khi backfill xong thì DROP
-- UPDATE events SET venue = ..., address = ..., city = ... WHERE ...;
-- ALTER TABLE events DROP COLUMN location;

CREATE INDEX idx_events_city ON events(city);

ALTER TABLE events
    ADD CONSTRAINT chk_events_venue   CHECK (CHAR_LENGTH(TRIM(venue)) > 0),
    ADD CONSTRAINT chk_events_address CHECK (CHAR_LENGTH(TRIM(address)) > 0),
    ADD CONSTRAINT chk_events_city    CHECK (CHAR_LENGTH(TRIM(city)) > 0);

USE ticketboxqr;

ALTER TABLE events
    DROP CONSTRAINT chk_events_location;

ALTER TABLE events
    DROP COLUMN location;