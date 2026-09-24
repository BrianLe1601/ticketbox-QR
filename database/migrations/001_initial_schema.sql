-- TicketBoxQR - Consolidated clean-install schema for MySQL 8.0.16+
-- WARNING: This script permanently deletes the existing ticketboxqr database.
-- This file already includes Event lifecycle, visibility, mandatory operational
-- windows, Ticket inventory protection, authentication sessions, managed
-- Categories, cancellation refunds, and retryable email delivery.
-- Run this entire file once after intentionally resetting the local database.

DROP DATABASE IF EXISTS ticketboxqr;

CREATE DATABASE ticketboxqr
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
-- 2. AUTH_SESSIONS
-- Only the SHA-256 hash of the refresh-token secret is stored.
-- Rotated, revoked and expired sessions are retained temporarily for audit.
-- =========================================================
CREATE TABLE auth_sessions (
    id              CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id         BIGINT UNSIGNED NOT NULL,
    token_hash      CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at      DATETIME(3) NOT NULL,
    last_used_at    DATETIME(3) NULL,
    revoked_at      DATETIME(3) NULL,
    replaced_by     CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    user_agent      VARCHAR(500) NULL,
    ip_address      VARCHAR(45) NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_auth_sessions PRIMARY KEY (id),
    CONSTRAINT uq_auth_sessions_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_auth_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_auth_sessions_replaced_by
        FOREIGN KEY (replaced_by) REFERENCES auth_sessions(id)
        ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT chk_auth_sessions_hash CHECK (
        token_hash REGEXP '^[0-9A-Fa-f]{64}$'
    ),
    CONSTRAINT chk_auth_sessions_expiry CHECK (expires_at > created_at),
    CONSTRAINT chk_auth_sessions_revocation CHECK (
        revoked_at IS NULL OR revoked_at >= created_at
    )
) ENGINE = InnoDB;

CREATE INDEX idx_auth_sessions_user_active
    ON auth_sessions(user_id, revoked_at, expires_at);
CREATE INDEX idx_auth_sessions_revoked_at
    ON auth_sessions(revoked_at);
CREATE INDEX idx_auth_sessions_expires_at
    ON auth_sessions(expires_at);

-- =========================================================
-- 3. CATEGORIES
-- Admin-managed taxonomy. Public filters use slug; Events use category_id.
-- =========================================================
CREATE TABLE categories (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    description     VARCHAR(500) NULL,
    icon            VARCHAR(50) NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT UNSIGNED NOT NULL DEFAULT 0,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_categories PRIMARY KEY (id),
    CONSTRAINT uq_categories_name UNIQUE (name),
    CONSTRAINT uq_categories_slug UNIQUE (slug),
    CONSTRAINT chk_categories_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
    CONSTRAINT chk_categories_slug CHECK (
        slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
) ENGINE = InnoDB;

CREATE INDEX idx_categories_active_order
    ON categories(is_active, sort_order, name);

INSERT INTO categories(name, slug, description, icon, sort_order) VALUES
    ('Music & Concerts', 'music', 'Concerts, festivals and live music.', 'music', 10),
    ('Conferences', 'conference', 'Conferences, seminars and professional events.', 'monitor', 20),
    ('Food & Drinks', 'food', 'Food, beverage and culinary events.', 'utensils', 30),
    ('Sports & Fitness', 'sports', 'Sports, races and fitness activities.', 'dumbbell', 40),
    ('Art & Culture', 'art', 'Art, exhibitions and cultural events.', 'palette', 50);

-- =========================================================
-- 4. EVENTS
-- =========================================================
CREATE TABLE events (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(220) NOT NULL,
    description         TEXT NULL,
    category_id         BIGINT UNSIGNED NOT NULL,
    venue               VARCHAR(150) NOT NULL,
    address             VARCHAR(255) NOT NULL,
    city                VARCHAR(100) NOT NULL,
    venue_capacity      INT UNSIGNED NOT NULL,
    cover_image_url     VARCHAR(500) NULL,
    cover_image_public_id VARCHAR(255) NULL,
    cover_image_alt     VARCHAR(255) NULL,
    start_time          DATETIME(3) NOT NULL,
    end_time            DATETIME(3) NOT NULL,
    sales_start_at      DATETIME(3) NOT NULL,
    sales_end_at        DATETIME(3) NOT NULL,
    checkin_start_at    DATETIME(3) NOT NULL,
    checkin_end_at      DATETIME(3) NOT NULL,
    status              ENUM('draft', 'published', 'ongoing', 'completed', 'cancelled')
                        NOT NULL DEFAULT 'draft',
    visibility          ENUM('visible', 'hidden') NOT NULL DEFAULT 'visible',
    hidden_at           DATETIME(3) NULL,
    hidden_reason       VARCHAR(500) NULL,
    hidden_by           BIGINT UNSIGNED NULL,
    scheduled_publish_at DATETIME(3) NULL,
    published_at        DATETIME(3) NULL,
    cancelled_at        DATETIME(3) NULL,
    cancellation_reason VARCHAR(500) NULL,
    completed_at        DATETIME(3) NULL,
    last_publish_attempt_at DATETIME(3) NULL,
    publish_failure_reason VARCHAR(500) NULL,
    created_by          BIGINT UNSIGNED NOT NULL,
    created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                      ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_events PRIMARY KEY (id),
    CONSTRAINT uq_events_slug UNIQUE (slug),
    CONSTRAINT fk_events_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_events_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_events_hidden_by
        FOREIGN KEY (hidden_by) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_events_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
    CONSTRAINT chk_events_venue CHECK (CHAR_LENGTH(TRIM(venue)) > 0),
    CONSTRAINT chk_events_address CHECK (CHAR_LENGTH(TRIM(address)) > 0),
    CONSTRAINT chk_events_city CHECK (CHAR_LENGTH(TRIM(city)) > 0),
    CONSTRAINT chk_events_venue_capacity CHECK (
        venue_capacity > 0
    ),
    CONSTRAINT chk_events_duration CHECK (start_time < end_time),
    CONSTRAINT chk_events_sales_window CHECK (
        sales_start_at < sales_end_at
    ),
    CONSTRAINT chk_events_checkin_window CHECK (
        checkin_start_at < checkin_end_at
    ),
    CONSTRAINT chk_events_checkin_before_end CHECK (
        checkin_end_at <= end_time
    ),
    CONSTRAINT chk_events_sales_before_end CHECK (
        sales_end_at <= end_time
    ),
    CONSTRAINT chk_events_sales_start_before_event CHECK (
        sales_start_at < start_time
    ),
    CONSTRAINT chk_events_checkin_starts_early CHECK (
        checkin_start_at <= start_time - INTERVAL 30 MINUTE
    ),
    CONSTRAINT chk_events_scheduled_publish CHECK (
        (scheduled_publish_at IS NULL OR scheduled_publish_at < start_time)
        AND (status = 'draft' OR scheduled_publish_at IS NULL)
    ),
    CONSTRAINT chk_events_lifecycle_dates CHECK (
        (status = 'draft'
            AND published_at IS NULL AND cancelled_at IS NULL
            AND cancellation_reason IS NULL AND completed_at IS NULL)
        OR (status = 'published'
            AND published_at IS NOT NULL AND cancelled_at IS NULL
            AND cancellation_reason IS NULL AND completed_at IS NULL)
        OR (status = 'ongoing'
            AND published_at IS NOT NULL AND cancelled_at IS NULL
            AND cancellation_reason IS NULL AND completed_at IS NULL)
        OR (status = 'completed'
            AND published_at IS NOT NULL AND completed_at IS NOT NULL
            AND cancelled_at IS NULL AND cancellation_reason IS NULL)
        OR (status = 'cancelled'
            AND published_at IS NOT NULL AND cancelled_at IS NOT NULL
            AND cancellation_reason IS NOT NULL
            AND CHAR_LENGTH(TRIM(cancellation_reason)) >= 10
            AND completed_at IS NULL AND visibility = 'hidden')
    ),
    CONSTRAINT chk_events_visibility CHECK (
        (visibility = 'visible' AND hidden_at IS NULL AND hidden_by IS NULL)
        OR (visibility = 'hidden' AND hidden_at IS NOT NULL AND hidden_by IS NOT NULL
            AND hidden_reason IS NOT NULL AND CHAR_LENGTH(TRIM(hidden_reason)) >= 5)
    )
) ENGINE = InnoDB;

CREATE INDEX idx_events_status_sales
    ON events(status, visibility, sales_start_at, sales_end_at);
CREATE INDEX idx_events_category_status
    ON events(category_id, status);
CREATE INDEX idx_events_city
    ON events(city);
CREATE INDEX idx_events_publish_retry
    ON events(status, scheduled_publish_at, last_publish_attempt_at);

-- =========================================================
-- 5. EVENT_STAFF
-- =========================================================
CREATE TABLE event_staff (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id        BIGINT UNSIGNED NOT NULL,
    staff_id        BIGINT UNSIGNED NOT NULL,
    assigned_by     BIGINT UNSIGNED NOT NULL,
    assigned_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    revoked_at      DATETIME(3) NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    active_assignment_marker TINYINT
                    GENERATED ALWAYS AS (CASE WHEN is_active THEN 1 ELSE NULL END) STORED,

    CONSTRAINT pk_event_staff PRIMARY KEY (id),
    -- Multiple historical assignments are allowed; only one may be active for
    -- the same Staff/Event pair. MySQL UNIQUE permits multiple NULL markers.
    CONSTRAINT uq_event_staff_active UNIQUE (
        event_id, staff_id, active_assignment_marker
    ),
    CONSTRAINT fk_event_staff_event
        FOREIGN KEY (event_id) REFERENCES events(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_event_staff_staff
        FOREIGN KEY (staff_id) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_event_staff_assigned_by
        FOREIGN KEY (assigned_by) REFERENCES users(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_event_staff_state CHECK (
        (is_active = TRUE AND revoked_at IS NULL)
        OR (is_active = FALSE AND revoked_at IS NOT NULL
            AND revoked_at >= assigned_at)
    )
) ENGINE = InnoDB;

CREATE INDEX idx_event_staff_staff_active
    ON event_staff(staff_id, is_active, event_id);

-- =========================================================
-- 6. TICKET_TYPES
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
        capacity > 0
        AND reserved_quantity + sold_quantity <= capacity
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
-- 7. ORDERS
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
        (status = 'pending_payment' AND expires_at IS NOT NULL
            AND confirmed_at IS NULL AND expired_at IS NULL AND cancelled_at IS NULL)
        OR (status = 'confirmed' AND confirmed_at IS NOT NULL
            AND expired_at IS NULL AND cancelled_at IS NULL)
        OR (status = 'expired' AND expired_at IS NOT NULL
            AND confirmed_at IS NULL AND cancelled_at IS NULL)
        OR (status = 'cancelled' AND cancelled_at IS NOT NULL
            AND confirmed_at IS NULL AND expired_at IS NULL)
    )
) ENGINE = InnoDB;

CREATE INDEX idx_orders_event_status_created
    ON orders(event_id, status, created_at);
CREATE INDEX idx_orders_buyer_email
    ON orders(buyer_email);
CREATE INDEX idx_orders_expiration
    ON orders(status, expires_at);

-- =========================================================
-- 8. ORDER_ITEMS
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
-- 9. TICKETS
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

    qr_token_encrypted  VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NULL DEFAULT NULL,

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
-- 10. PAYMENTS
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
-- 11. REFUNDS
-- One auditable refund workflow per confirmed Order.
-- =========================================================
CREATE TABLE refunds (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id        BIGINT UNSIGNED NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    status          ENUM('not_required', 'pending', 'processing', 'completed', 'failed')
                    NOT NULL DEFAULT 'pending',
    reason          VARCHAR(500) NOT NULL,
    requested_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at    DATETIME(3) NULL,
    failure_reason  VARCHAR(500) NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_refunds PRIMARY KEY (id),
    CONSTRAINT uq_refunds_order UNIQUE (order_id),
    CONSTRAINT fk_refunds_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_refunds_amount CHECK (amount >= 0),
    CONSTRAINT chk_refunds_result CHECK (
        (status <> 'completed' OR completed_at IS NOT NULL)
        AND (status <> 'failed' OR failure_reason IS NOT NULL)
    )
) ENGINE = InnoDB;

CREATE INDEX idx_refunds_status_requested
    ON refunds(status, requested_at);

-- =========================================================
-- 12. CHECKIN_LOGS
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
-- 13. EMAIL_LOGS (retryable operational history)
-- =========================================================
CREATE TABLE email_logs (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id            BIGINT UNSIGNED NOT NULL,
    recipient           VARCHAR(150) NOT NULL,
    email_type          ENUM('ticket_issued', 'ticket_resent', 'order_cancelled')
                        NOT NULL,
    status              ENUM('pending', 'processing', 'sent', 'failed')
                        NOT NULL DEFAULT 'pending',
    provider_id         VARCHAR(255) NULL,
    error_message       VARCHAR(500) NULL,
    attempt_count       INT UNSIGNED NOT NULL DEFAULT 0,
    next_attempt_at     DATETIME(3) NULL,
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
CREATE INDEX idx_email_logs_delivery
    ON email_logs(email_type, status, next_attempt_at, created_at);

-- =========================================================
-- CROSS-TABLE INTEGRITY TRIGGERS
-- These checks supplement foreign keys where a normal FK cannot express the
-- business relationship.
-- =========================================================
DELIMITER $$

CREATE TRIGGER trg_users_active_assignment_bu
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    IF (NEW.role <> OLD.role OR NEW.is_active = FALSE)
       AND EXISTS (
           SELECT 1 FROM event_staff
           WHERE staff_id = OLD.id AND is_active = TRUE
           LIMIT 1
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Revoke active Event assignments before changing Staff access';
    END IF;
END$$

CREATE TRIGGER trg_categories_contract_bu
BEFORE UPDATE ON categories
FOR EACH ROW
BEGIN
    IF NEW.slug <> OLD.slug AND EXISTS (
        SELECT 1 FROM events WHERE category_id = OLD.id LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A Category slug referenced by Events is immutable';
    END IF;
END$$

CREATE TRIGGER trg_events_creator_admin_bi
BEFORE INSERT ON events
FOR EACH ROW
BEGIN
    IF NEW.status <> 'draft' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Events must be created as Drafts';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.created_by AND role = 'admin' AND is_active = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'events.created_by must be an active admin';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM categories
        WHERE id = NEW.category_id AND is_active = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'events.category_id must reference an active Category';
    END IF;

    IF NEW.visibility = 'hidden' AND NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.hidden_by AND role = 'admin' AND is_active = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'events.hidden_by must be an active admin';
    END IF;
END$$

CREATE TRIGGER trg_events_creator_admin_bu
BEFORE UPDATE ON events
FOR EACH ROW
BEGIN
    IF NEW.created_by <> OLD.created_by THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'events.created_by is immutable';
    END IF;

    IF NEW.category_id <> OLD.category_id AND NOT EXISTS (
        SELECT 1 FROM categories
        WHERE id = NEW.category_id AND is_active = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'events.category_id must reference an active Category';
    END IF;

    IF NOT (
        NEW.status = OLD.status
        OR (OLD.status = 'draft' AND NEW.status = 'published')
        OR (OLD.status = 'published' AND NEW.status IN ('ongoing', 'cancelled'))
        OR (OLD.status = 'ongoing' AND NEW.status IN ('completed', 'cancelled'))
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid Event lifecycle transition';
    END IF;

    IF (NEW.start_time <> OLD.start_time OR NEW.end_time <> OLD.end_time)
       AND EXISTS (
            SELECT 1 FROM event_staff
            WHERE event_id = OLD.id AND is_active = TRUE
            LIMIT 1
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Revoke active Staff assignments before changing Event schedule';
    END IF;

    IF NEW.venue_capacity < (
        SELECT COALESCE(SUM(capacity), 0)
        FROM ticket_types
        WHERE event_id = OLD.id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Event venue capacity cannot be below allocated Ticket capacity';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM ticket_types tt
        WHERE tt.event_id = OLD.id
          AND (
              COALESCE(tt.sales_start_at, NEW.sales_start_at)
                  >= COALESCE(tt.sales_end_at, NEW.sales_end_at)
              OR COALESCE(tt.sales_end_at, NEW.sales_end_at) > NEW.end_time
          )
        LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Event schedule would invalidate a Ticket sales window';
    END IF;

    -- A public Event must always have something that can become purchasable.
    -- The time window may still be in the future; is_active expresses that the
    -- tier is enabled, while the Public API computes scheduled/on-sale/closed.
    IF NEW.status IN ('published', 'ongoing')
       AND NEW.visibility = 'visible'
       AND NOT EXISTS (
            SELECT 1
            FROM ticket_types tt
            WHERE tt.event_id = OLD.id
              AND tt.is_active = TRUE
              AND tt.capacity > 0
              AND COALESCE(tt.sales_start_at, NEW.sales_start_at)
                    < COALESCE(tt.sales_end_at, NEW.sales_end_at)
              AND COALESCE(tt.sales_end_at, NEW.sales_end_at) <= NEW.end_time
            LIMIT 1
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A visible Published/Ongoing Event requires an active valid Ticket Type';
    END IF;

    IF NEW.status = 'cancelled' AND EXISTS (
        SELECT 1
        FROM ticket_types tt
        WHERE tt.event_id = OLD.id AND tt.is_active = TRUE
        LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Deactivate all Ticket Types before cancelling an Event';
    END IF;

    IF NEW.visibility = 'hidden' AND NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.hidden_by AND role = 'admin' AND is_active = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'events.hidden_by must be an active admin';
    END IF;
END$$

CREATE TRIGGER trg_event_staff_roles_bi
BEFORE INSERT ON event_staff
FOR EACH ROW
BEGIN
    DECLARE v_staff_role VARCHAR(10) DEFAULT NULL;
    DECLARE v_staff_active BOOLEAN DEFAULT FALSE;

    -- Locking the shared Staff row serializes concurrent assignments for the
    -- same person, so two requests cannot both pass the overlap check.
    SELECT role, is_active
      INTO v_staff_role, v_staff_active
      FROM users
     WHERE id = NEW.staff_id
     FOR UPDATE;

    IF v_staff_role IS NULL OR v_staff_role <> 'staff' OR v_staff_active = FALSE THEN
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

    IF NOT EXISTS (
        SELECT 1 FROM events
        WHERE id = NEW.event_id AND status IN ('draft', 'published', 'ongoing')
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Staff cannot be assigned to a closed Event';
    END IF;

    IF NEW.assigned_at > CURRENT_TIMESTAMP(3) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'event_staff.assigned_at cannot be in the future';
    END IF;

    IF NEW.is_active = TRUE AND EXISTS (
        SELECT 1
        FROM event_staff es
        JOIN events existing_event ON existing_event.id = es.event_id
        JOIN events target_event ON target_event.id = NEW.event_id
        WHERE es.staff_id = NEW.staff_id
          AND es.is_active = TRUE
          AND existing_event.status IN ('draft', 'published', 'ongoing')
          AND target_event.start_time < existing_event.end_time
          AND target_event.end_time > existing_event.start_time
        LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Staff is already assigned to an overlapping Event';
    END IF;
END$$

CREATE TRIGGER trg_event_staff_roles_bu
BEFORE UPDATE ON event_staff
FOR EACH ROW
BEGIN
    DECLARE v_staff_role VARCHAR(10) DEFAULT NULL;
    DECLARE v_staff_active BOOLEAN DEFAULT FALSE;

    IF NEW.event_id <> OLD.event_id
       OR NEW.staff_id <> OLD.staff_id
       OR NEW.assigned_by <> OLD.assigned_by
       OR NEW.assigned_at <> OLD.assigned_at THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Assignment identity is immutable; revoke and create a new assignment';
    END IF;

    IF NEW.is_active = TRUE THEN
        SELECT role, is_active
          INTO v_staff_role, v_staff_active
          FROM users
         WHERE id = NEW.staff_id
         FOR UPDATE;

        IF v_staff_role IS NULL OR v_staff_role <> 'staff' OR v_staff_active = FALSE THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Only an active Staff user can hold an active assignment';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM event_staff es
            JOIN events existing_event ON existing_event.id = es.event_id
            JOIN events target_event ON target_event.id = NEW.event_id
            WHERE es.staff_id = NEW.staff_id
              AND es.is_active = TRUE
              AND es.id <> OLD.id
              AND existing_event.status IN ('draft', 'published', 'ongoing')
              AND target_event.start_time < existing_event.end_time
              AND target_event.end_time > existing_event.start_time
            LIMIT 1
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Staff is already assigned to an overlapping Event';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_ticket_types_integrity_bi
BEFORE INSERT ON ticket_types
FOR EACH ROW
BEGIN
    DECLARE v_venue_capacity BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_event_sales_start DATETIME(3);
    DECLARE v_event_sales_end DATETIME(3);
    DECLARE v_event_end DATETIME(3);
    DECLARE v_event_status VARCHAR(12);
    DECLARE v_allocated BIGINT UNSIGNED DEFAULT 0;

    -- All Ticket allocation changes lock the parent Event first. This is the
    -- common serialization point for concurrent tier creation and resizing.
    SELECT venue_capacity, sales_start_at, sales_end_at, end_time, status
      INTO v_venue_capacity, v_event_sales_start, v_event_sales_end, v_event_end,
           v_event_status
      FROM events
     WHERE id = NEW.event_id
     FOR UPDATE;

    SELECT COALESCE(SUM(capacity), 0)
      INTO v_allocated
      FROM ticket_types
     WHERE event_id = NEW.event_id;

    IF v_venue_capacity IS NULL OR v_allocated + NEW.capacity > v_venue_capacity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ticket allocation exceeds Event venue capacity';
    END IF;

    IF v_event_status IN ('completed', 'cancelled') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ticket Types cannot be added to a closed Event';
    END IF;

    IF v_event_status <> 'draft' AND NEW.is_active = TRUE THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A Ticket Type added after publishing must start paused';
    END IF;

    IF COALESCE(NEW.sales_start_at, v_event_sales_start)
          >= COALESCE(NEW.sales_end_at, v_event_sales_end)
       OR COALESCE(NEW.sales_end_at, v_event_sales_end) > v_event_end THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ticket sales window is outside the Event operating window';
    END IF;
END$$

CREATE TRIGGER trg_ticket_types_integrity_bu
BEFORE UPDATE ON ticket_types
FOR EACH ROW
BEGIN
    DECLARE v_venue_capacity BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_event_sales_start DATETIME(3);
    DECLARE v_event_sales_end DATETIME(3);
    DECLARE v_event_end DATETIME(3);
    DECLARE v_event_status VARCHAR(12);
    DECLARE v_event_visibility VARCHAR(10);
    DECLARE v_allocated BIGINT UNSIGNED DEFAULT 0;

    IF NEW.event_id <> OLD.event_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'ticket_types.event_id is immutable';
    END IF;

    SELECT venue_capacity, sales_start_at, sales_end_at, end_time, status, visibility
      INTO v_venue_capacity, v_event_sales_start, v_event_sales_end, v_event_end,
           v_event_status, v_event_visibility
      FROM events
     WHERE id = NEW.event_id
     FOR UPDATE;

    SELECT COALESCE(SUM(capacity), 0)
      INTO v_allocated
      FROM ticket_types
     WHERE event_id = NEW.event_id AND id <> OLD.id;

    IF v_allocated + NEW.capacity > v_venue_capacity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ticket allocation exceeds Event venue capacity';
    END IF;

    IF v_event_status IN ('completed', 'cancelled') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ticket inventory for a closed Event is immutable';
    END IF;

    IF NEW.price <> OLD.price
       AND OLD.reserved_quantity + OLD.sold_quantity > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ticket price is immutable after reservation or sale';
    END IF;

    IF v_event_status <> 'draft' AND NEW.capacity < OLD.capacity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Published Ticket capacity may only increase';
    END IF;

    IF COALESCE(NEW.sales_start_at, v_event_sales_start)
          >= COALESCE(NEW.sales_end_at, v_event_sales_end)
       OR COALESCE(NEW.sales_end_at, v_event_sales_end) > v_event_end THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ticket sales window is outside the Event operating window';
    END IF;

    IF OLD.is_active = TRUE AND NEW.is_active = FALSE
       AND v_event_status IN ('published', 'ongoing')
       AND v_event_visibility = 'visible'
       AND NOT EXISTS (
           SELECT 1 FROM ticket_types
           WHERE event_id = OLD.event_id
             AND id <> OLD.id
             AND is_active = TRUE
             AND capacity > 0
             AND max_per_order > 0
           LIMIT 1
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A visible Event must retain an active Ticket Type';
    END IF;
END$$

CREATE TRIGGER trg_ticket_types_integrity_bd
BEFORE DELETE ON ticket_types
FOR EACH ROW
BEGIN
    DECLARE v_event_status VARCHAR(12);
    DECLARE v_event_visibility VARCHAR(10);

    SELECT status, visibility
      INTO v_event_status, v_event_visibility
      FROM events
     WHERE id = OLD.event_id
     FOR UPDATE;

    IF EXISTS (
        SELECT 1 FROM order_items
        WHERE ticket_type_id = OLD.id
        LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A Ticket Type referenced by Orders cannot be deleted';
    END IF;

    IF OLD.is_active = TRUE
       AND v_event_status IN ('published', 'ongoing')
       AND v_event_visibility = 'visible'
       AND NOT EXISTS (
           SELECT 1 FROM ticket_types
           WHERE event_id = OLD.event_id
             AND id <> OLD.id
             AND is_active = TRUE
             AND capacity > 0
             AND max_per_order > 0
           LIMIT 1
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A visible Event must retain an active Ticket Type';
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
    IF NEW.order_id <> OLD.order_id
       OR NEW.ticket_type_id <> OLD.ticket_type_id
       OR NEW.ticket_type_name <> OLD.ticket_type_name
       OR NEW.unit_price <> OLD.unit_price
       OR NEW.quantity <> OLD.quantity
       OR NEW.line_total <> OLD.line_total
       OR NEW.created_at <> OLD.created_at THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order item purchase snapshots are immutable';
    END IF;

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
    IF NEW.order_id <> OLD.order_id
       OR NEW.payment_code <> OLD.payment_code
       OR NEW.method <> OLD.method
       OR NEW.amount <> OLD.amount
       OR NEW.created_at <> OLD.created_at THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payment identity and amount are immutable';
    END IF;

    IF NOT (
        NEW.status = OLD.status
        OR (OLD.status = 'pending' AND NEW.status IN ('success', 'failed', 'cancelled'))
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid Payment status transition';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM orders
        WHERE id = NEW.order_id AND total_amount = NEW.amount
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payment amount must equal the order total';
    END IF;
END$$

CREATE TRIGGER trg_orders_integrity_bu
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
    IF NEW.order_code <> OLD.order_code
       OR NEW.event_id <> OLD.event_id
       OR NEW.total_quantity <> OLD.total_quantity
       OR NEW.subtotal_amount <> OLD.subtotal_amount
       OR NEW.discount_amount <> OLD.discount_amount
       OR NEW.total_amount <> OLD.total_amount
       OR NEW.lookup_token_hash <> OLD.lookup_token_hash
       OR NOT (NEW.idempotency_key <=> OLD.idempotency_key)
       OR NEW.created_at <> OLD.created_at THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order identity and financial snapshot are immutable';
    END IF;

    IF NOT (
        NEW.status = OLD.status
        OR (OLD.status = 'pending_payment'
            AND NEW.status IN ('confirmed', 'expired', 'cancelled'))
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid Order status transition';
    END IF;
END$$

CREATE TRIGGER trg_tickets_integrity_bu
BEFORE UPDATE ON tickets
FOR EACH ROW
BEGIN
    IF NEW.order_item_id <> OLD.order_item_id
       OR NEW.ticket_code <> OLD.ticket_code
       OR NEW.qr_token_hash <> OLD.qr_token_hash
       OR NEW.issued_at <> OLD.issued_at
       OR NEW.created_at <> OLD.created_at THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ticket identity and QR credential are immutable';
    END IF;

    IF OLD.qr_token_encrypted IS NOT NULL
       AND NOT (NEW.qr_token_encrypted <=> OLD.qr_token_encrypted) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'QR credential is immutable once encrypted';
    END IF;

    IF NOT (
        NEW.status = OLD.status
        OR (OLD.status = 'issued' AND NEW.status IN ('checked_in', 'cancelled'))
        OR (OLD.status = 'checked_in' AND NEW.status = 'cancelled')
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid Ticket status transition';
    END IF;
END$$

CREATE TRIGGER trg_refunds_integrity_bu
BEFORE UPDATE ON refunds
FOR EACH ROW
BEGIN
    IF NEW.order_id <> OLD.order_id
       OR NEW.amount <> OLD.amount
       OR NEW.requested_at <> OLD.requested_at
       OR NEW.created_at <> OLD.created_at THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Refund identity and amount are immutable';
    END IF;

    IF NOT (
        NEW.status = OLD.status
        OR (OLD.status = 'pending' AND NEW.status IN ('processing', 'completed', 'failed'))
        OR (OLD.status = 'processing' AND NEW.status IN ('completed', 'failed'))
        OR (OLD.status = 'failed' AND NEW.status IN ('pending', 'processing'))
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid Refund status transition';
    END IF;
END$$

CREATE TRIGGER trg_email_logs_integrity_bu
BEFORE UPDATE ON email_logs
FOR EACH ROW
BEGIN
    IF NEW.order_id <> OLD.order_id
       OR NEW.recipient <> OLD.recipient
       OR NEW.email_type <> OLD.email_type
       OR NEW.created_at <> OLD.created_at THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Email delivery identity is immutable';
    END IF;

    IF NOT (
        NEW.status = OLD.status
        OR (OLD.status = 'pending' AND NEW.status IN ('processing', 'sent', 'failed'))
        OR (OLD.status = 'processing' AND NEW.status IN ('pending', 'sent', 'failed'))
        OR (OLD.status = 'failed' AND NEW.status IN ('pending', 'processing'))
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid Email delivery status transition';
    END IF;
END$$

CREATE TRIGGER trg_checkin_staff_role_bi
BEFORE INSERT ON checkin_logs
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.staff_id AND role = 'staff' AND is_active = TRUE
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'checkin_logs.staff_id must reference an active Staff user';
    END IF;

    IF NEW.result_code = 'SUCCESS' AND NOT EXISTS (
        SELECT 1 FROM event_staff
        WHERE event_id = NEW.event_id
          AND staff_id = NEW.staff_id
          AND is_active = TRUE
        LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Successful check-in requires an active Event assignment';
    END IF;

    IF NEW.result_code = 'SUCCESS' AND NOT EXISTS (
        SELECT 1
        FROM tickets t
        JOIN order_items oi ON oi.id = t.order_item_id
        JOIN orders o ON o.id = oi.order_id
        WHERE t.id = NEW.ticket_id
          AND o.event_id = NEW.event_id
        LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Successful check-in Ticket must belong to the scanner Event';
    END IF;

    IF NEW.result_code = 'SUCCESS' AND NOT EXISTS (
        SELECT 1
        FROM events e
        WHERE e.id = NEW.event_id
          AND e.status IN ('published', 'ongoing')
          AND NEW.checked_at >= e.checkin_start_at
          AND NEW.checked_at <= e.checkin_end_at
        LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Successful check-in must be inside the Event check-in window';
    END IF;

    IF NEW.result_code = 'SUCCESS' AND NOT EXISTS (
        SELECT 1
        FROM tickets t
        WHERE t.id = NEW.ticket_id AND t.status = 'checked_in'
        LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Ticket must be marked checked_in before writing a SUCCESS log';
    END IF;
END$$

DELIMITER ;

-- End of schema.
