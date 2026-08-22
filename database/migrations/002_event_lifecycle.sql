-- TicketBoxQR - normalize the Event lifecycle.
USE ticketboxqr;

-- Keep the legacy value temporarily so existing databases can migrate safely.
ALTER TABLE events
  MODIFY status ENUM('draft', 'published', 'ongoing', 'completed', 'cancelled', 'ended')
    NOT NULL DEFAULT 'draft';

UPDATE events SET status = 'completed' WHERE status = 'ended';

ALTER TABLE events
  MODIFY status ENUM('draft', 'published', 'ongoing', 'completed', 'cancelled')
    NOT NULL DEFAULT 'draft',
  ADD COLUMN scheduled_publish_at DATETIME(3) NULL AFTER status,
  ADD COLUMN published_at DATETIME(3) NULL AFTER scheduled_publish_at,
  ADD COLUMN cancelled_at DATETIME(3) NULL AFTER published_at,
  ADD COLUMN cancellation_reason VARCHAR(500) NULL AFTER cancelled_at,
  ADD COLUMN completed_at DATETIME(3) NULL AFTER cancellation_reason,
  ADD CONSTRAINT chk_events_sales_before_start CHECK (
    sales_end_at IS NULL OR sales_end_at <= start_time
  ),
  ADD CONSTRAINT chk_events_scheduled_publish CHECK (
    scheduled_publish_at IS NULL OR scheduled_publish_at < start_time
  ),
  ADD CONSTRAINT chk_events_lifecycle_dates CHECK (
    (status <> 'published' OR published_at IS NOT NULL)
    AND (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL))
    AND (status <> 'completed' OR completed_at IS NOT NULL)
  );

CREATE INDEX idx_events_scheduled_publish
  ON events(status, scheduled_publish_at);
