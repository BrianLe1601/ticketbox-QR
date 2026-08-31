USE ticketboxqr;

CREATE TABLE refunds (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id        BIGINT UNSIGNED NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    status          ENUM('not_required','pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
    reason          VARCHAR(500) NOT NULL,
    requested_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at    DATETIME(3) NULL,
    failure_reason  VARCHAR(500) NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT pk_refunds PRIMARY KEY (id),
    CONSTRAINT uq_refunds_order UNIQUE (order_id),
    CONSTRAINT fk_refunds_order FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_refunds_amount CHECK (amount >= 0),
    CONSTRAINT chk_refunds_result CHECK (
      (status <> 'completed' OR completed_at IS NOT NULL)
      AND (status <> 'failed' OR failure_reason IS NOT NULL)
    )
) ENGINE=InnoDB;

CREATE INDEX idx_refunds_status_requested ON refunds(status, requested_at);

ALTER TABLE email_logs
    MODIFY COLUMN status ENUM('pending','processing','sent','failed') NOT NULL DEFAULT 'pending',
    ADD COLUMN attempt_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER error_message,
    ADD COLUMN next_attempt_at DATETIME(3) NULL AFTER attempt_count;

CREATE INDEX idx_email_logs_delivery
    ON email_logs(email_type, status, next_attempt_at, created_at);
